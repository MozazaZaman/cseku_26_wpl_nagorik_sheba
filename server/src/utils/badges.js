/**
 * Civic achievement badges for staff (positive-only, normalized).
 *
 * Design decisions (see docs in the task spec):
 *   - Attribution is CONTRIBUTED-TO-RESOLUTION: a staff member is credited
 *     with a complaint when they performed one of the advancing actions
 *     (approved / assigned / resolved) on it AND it reached "resolved".
 *     This keeps junior / senior / WIT / field all measurable, since only
 *     field staff perform the final resolve action.
 *   - Rolling badges cover a trailing window (default 90 days) and are
 *     re-evaluated periodically: the row for a badge type is replaced with
 *     the latest verdict, so tiers track recent performance and a badge
 *     quietly disappears (neutral) when the staff member stops qualifying.
 *   - Milestone badges are lifetime totals, awarded once and permanent.
 *   - The mayor role is never eligible for badges (approval-only role).
 *   - Percentile badges rank only against eligible peers (>= MIN_RESOLVED)
 *     within role + district, falling back to role + division when a
 *     district group is too sparse to rank meaningfully.
 *
 * There is deliberately no "rules engine" abstraction — one function per
 * badge type, called from one scheduled job (rolling) plus a lightweight
 * resolution hook (milestones).
 */

import { db } from '../db.js';
import { effectiveSlaDays } from './sla.js';

export const ROLLING_WINDOW_DAYS = 90;

// Eligibility floors — a staff member must have done this much in the window
// to enter any ranking / threshold comparison.
export const MIN_RESOLVED = 10;      // volume / SLA / accuracy
export const MIN_RATED = 10;         // satisfaction (rated complaints only)
export const MIN_CATEGORY_RESOLVED = 20;   // category specialist volume
export const MIN_CATEGORY_SAT = 4.0;       // category specialist satisfaction

// Percentile cut-offs for the volume badge (percent of eligible peers beaten).
const VOLUME_GOLD_PCT = 95, VOLUME_SILVER_PCT = 85, VOLUME_BRONZE_PCT = 70;

// Threshold badges: minimum metric value per tier.
const SAT_TIERS = { gold: 4.5, silver: 4.0, bronze: 3.5 };
const SLA_TIERS = { gold: 95, silver: 85, bronze: 70 };   // % acted on time
const ACC_TIERS = { gold: 98, silver: 92, bronze: 85 };   // % not disputed

// Milestone lifetimes.
const FIRST_10_COUNT = 10;
const CENTURY_COUNT = 100;
const VETERAN_MONTHS = 6;
const VETERAN_RECENT_MONTHS = 3;

// Only these workflow actions count as "advanced the complaint".
const CREDITED_ACTIONS = ['approved', 'assigned', 'resolved'];

// The step's stage -> the SLA budget stage (reuses sla.js budgets).
// wit_assign logs stage 'assignment' but happens during the wit_review status,
// whose SLA budget is the wit_inspection window.
const STEP_STAGE_TO_SLA_STAGE = {
  junior_review: 'junior_review',
  senior_review: 'senior_review',
  mayor_review: 'mayor_review',
  assignment: 'wit_inspection',
  execution: 'execution'
};

export const ROLLING_BADGE_TYPES = ['volume', 'satisfaction', 'sla', 'accuracy'];
export const MILESTONE_BADGE_TYPES = ['first10', 'century', 'veteran'];
export const SPECIALIST_BADGE_TYPES = ['road', 'electricity', 'water', 'gas', 'sanitation',
  'encroachment', 'environment', 'public_assets', 'animals', 'markets', 'drugs']
  .map((c) => `specialist_${c}`);

/* ------------------------------------------------------------------ *
 * Shared attribution query
 * ------------------------------------------------------------------ */

/**
 * Every (staff, resolved complaint) credit in a window.
 * Returns rows of { staff_id, complaint_id, category, satisfaction_score,
 * resolved_at, priority_score, authority_id }.
 */
async function creditedResolutions({ since } = {}) {
  const rows = db.prepare(
    `SELECT ws.actor_staff_id AS staff_id,
            c.complaint_id, c.category, c.satisfaction_score, c.resolved_at,
            c.priority_score, c.authority_id
       FROM workflow_steps ws
       JOIN complaints c ON c.complaint_id = ws.complaint_id
       JOIN staff s ON s.staff_id = ws.actor_staff_id
      WHERE ws.action IN (${CREDITED_ACTIONS.map(() => '?').join(',')})
        AND ws.actor_staff_id IS NOT NULL
        AND s.staff_role != 'mayor'
        AND c.status = 'resolved'
        AND c.resolved_at IS NOT NULL
        ${since ? 'AND c.resolved_at >= ?' : ''}`
  );
  const args = [...CREDITED_ACTIONS];
  if (since) args.push(since);
  return await rows.all(...args);
}

/** Complaint ids that were disputed / reopened at any point (negative signal). */
async function reopenedComplaintIds() {
  const a = (await db.prepare("SELECT DISTINCT complaint_id FROM workflow_steps WHERE action = 'returned'")
    .all()).map((r) => r.complaint_id);
  const b = (await db.prepare("SELECT DISTINCT complaint_id FROM status_history WHERE old_status = 'resolved'")
    .all()).map((r) => r.complaint_id);
  return new Set([...a, ...b]);
}

/**
 * SLA timing for every credited action in a window. The per-step budget is
 * reconstructed from the SLA rules in sla.js: the clock for a stage starts
 * when the complaint ENTERED that stage (the previous workflow step, or
 * complaint creation for the first step) and the deadline is that moment
 * plus effectiveSlaDays(stage, priority).
 */
async function creditedStepTiming({ since } = {}) {
  const rows = db.prepare(
    `SELECT ws.actor_staff_id AS staff_id,
            ws.step_id, ws.stage, ws.action, ws.created_at AS acted_at,
            (SELECT MAX(prev.created_at)
               FROM workflow_steps prev
              WHERE prev.complaint_id = ws.complaint_id
                AND prev.created_at < ws.created_at) AS stage_entered_at,
            c.created_at AS complaint_created_at,
            c.priority_score
       FROM workflow_steps ws
       JOIN complaints c ON c.complaint_id = ws.complaint_id
       JOIN staff s ON s.staff_id = ws.actor_staff_id
      WHERE ws.action IN (${CREDITED_ACTIONS.map(() => '?').join(',')})
        AND ws.actor_staff_id IS NOT NULL
        AND s.staff_role != 'mayor'
        AND c.status = 'resolved'
        AND c.resolved_at IS NOT NULL
        ${since ? 'AND c.resolved_at >= ?' : ''}`
  );
  const args = [...CREDITED_ACTIONS];
  if (since) args.push(since);
  return await rows.all(...args);
}

/* ------------------------------------------------------------------ *
 * Badge writes
 * ------------------------------------------------------------------ */

function earnedTier(thresholds, value) {
  if (value == null || Number.isNaN(value)) return null;
  if (value >= thresholds.gold) return 'gold';
  if (value >= thresholds.silver) return 'silver';
  if (value >= thresholds.bronze) return 'bronze';
  return null;
}

/**
 * Replace a rolling badge with the latest verdict. Deleting first means a
 * staff member who stops qualifying simply loses the badge (neutral absence)
 * and a tier change overwrites the old row rather than stacking history.
 * The insert is unconditional (tier is NULL for the tierless specialist).
 */
async function replaceRollingBadge({ staff_id, badge_type, tier, period_start, period_end }) {
  await db.prepare('DELETE FROM staff_badges WHERE staff_id = ? AND badge_type = ?')
    .run(staff_id, badge_type);
  await db.prepare(
    `INSERT INTO staff_badges (staff_id, badge_type, tier, period_start, period_end)
     VALUES (?, ?, ?, ?, ?)`
  ).run(staff_id, badge_type, tier, period_start, period_end);
}

/** Milestones are permanent: insert only if not already awarded. */
async function awardMilestone({ staff_id, badge_type }) {
  const existing = await db.prepare(
    `SELECT 1 FROM staff_badges
      WHERE staff_id = ? AND badge_type = ? AND period_end IS NULL`
  ).get(staff_id, badge_type);
  if (existing) return false;
  await db.prepare(
    `INSERT INTO staff_badges (staff_id, badge_type, tier, period_start, period_end)
     VALUES (?, ?, NULL, NULL, NULL)`
  ).run(staff_id, badge_type);
  return true;
}

/* ------------------------------------------------------------------ *
 * Rolling badge computations (one per type)
 * ------------------------------------------------------------------ */

/**
 * Per-staff aggregates over the credited resolutions in the window.
 * A complaint is counted ONCE per staff member even if it was resolved,
 * disputed and re-resolved within the window — the dispute is accounted
 * for separately via the reopened flag, not as a second resolution.
 */
function aggregateStaff(rows, reopened) {
  const byStaff = new Map();
  for (const r of rows) {
    let s = byStaff.get(r.staff_id);
    if (!s) {
      s = {
        staff_id: r.staff_id,
        resolved: 0,
        rated: 0,
        satSum: 0,
        byCategory: new Map(),
        reopenedCount: 0,
        seenComplaints: new Set()
      };
      byStaff.set(r.staff_id, s);
    }
    if (s.seenComplaints.has(r.complaint_id)) continue; // count each complaint once
    s.seenComplaints.add(r.complaint_id);

    s.resolved += 1;
    if (reopened.has(r.complaint_id)) s.reopenedCount += 1;
    if (r.satisfaction_score != null) {
      s.rated += 1;
      s.satSum += r.satisfaction_score;
    }
    const cat = r.category || 'other';
    let c = s.byCategory.get(cat);
    if (!c) { c = { resolved: 0, rated: 0, satSum: 0 }; s.byCategory.set(cat, c); }
    c.resolved += 1;
    if (r.satisfaction_score != null) { c.rated += 1; c.satSum += r.satisfaction_score; }
  }
  return byStaff;
}

/**
 * a) RESOLUTION VOLUME — percentile-ranked within role + district
 * (falls back to role + division for sparse districts), among eligible
 * peers only. top 5% gold / top 15% silver / top 30% bronze.
 */
async function computeVolumeBadges(eligible, staffMeta, period_start, period_end) {
  if (eligible.size === 0) return;

  // Attach role + geography to each eligible staff member.
  const members = [];
  for (const s of eligible.values()) {
    const m = staffMeta.get(s.staff_id);
    if (!m || m.staff_role === 'mayor') continue;
    members.push({ s, role: m.staff_role, district: m.district, division: m.division });
  }
  if (members.length === 0) return;

  // Bucket by role+district; districts with fewer than 3 eligible peers are
  // too sparse to rank meaningfully, so their members fall back to a
  // role+division bucket (which also collapses to nothing useful when tiny).
  const byDistrict = new Map();
  for (const m of members) {
    const key = `${m.role}|${m.district}`;
    if (!byDistrict.has(key)) byDistrict.set(key, []);
    byDistrict.get(key).push(m);
  }
  const groups = [];
  const byDivision = new Map();
  for (const g of byDistrict.values()) {
    if (g.length >= 3) {
      groups.push(g);
    } else {
      for (const m of g) {
        const key = `${m.role}|${m.division}`;
        if (!byDivision.has(key)) byDivision.set(key, []);
        byDivision.get(key).push(m);
      }
    }
  }
  for (const g of byDivision.values()) groups.push(g);

  for (const g of groups) {
    if (g.length < 2) continue; // cannot percentile-rank a lone staff member
    for (const m of g) {
      const { s } = m;
      const peersBelow = g.filter((o) => o.s.staff_id !== s.staff_id && o.s.resolved < s.resolved).length;
      const pct = (peersBelow / (g.length - 1)) * 100;
      let tier = null;
      if (pct >= VOLUME_GOLD_PCT) tier = 'gold';
      else if (pct >= VOLUME_SILVER_PCT) tier = 'silver';
      else if (pct >= VOLUME_BRONZE_PCT) tier = 'bronze';
      if (tier) {
        await replaceRollingBadge({
          staff_id: s.staff_id, badge_type: 'volume', tier, period_start, period_end
        });
      } else {
        // below the bronze cut-off: no badge this period (neutral)
        await db.prepare('DELETE FROM staff_badges WHERE staff_id = ? AND badge_type = ?')
          .run(s.staff_id, 'volume');
      }
    }
  }
}

/** b) SATISFACTION — threshold tiers over rated complaints only. */
async function computeSatisfactionBadges(byStaff, period_start, period_end) {
  for (const s of byStaff.values()) {
    if (s.rated < MIN_RATED) {
      await db.prepare('DELETE FROM staff_badges WHERE staff_id = ? AND badge_type = ?')
        .run(s.staff_id, 'satisfaction');
      continue;
    }
    const avg = s.satSum / s.rated;
    const tier = earnedTier(SAT_TIERS, avg);
    await replaceRollingBadge({
      staff_id: s.staff_id, badge_type: 'satisfaction', tier, period_start, period_end
    });
  }
}

/** c) SLA COMPLIANCE — % of credited actions taken within the stage budget.
 *  Each complaint counts once per staff member, using the earliest credited
 *  action on it (a disputed-then-re-resolved complaint is one measurement). */
async function computeSlaBadges(timing, period_start, period_end) {
  const byStaff = new Map();
  for (const t of timing) {
    let s = byStaff.get(t.staff_id);
    if (!s) { s = { staff_id: t.staff_id, onTime: 0, total: 0, firstAction: new Map() }; byStaff.set(t.staff_id, s); }
    // keep the earliest credited action for each complaint
    const prev = s.firstAction.get(t.complaint_id);
    if (!prev || t.acted_at < prev.acted_at) s.firstAction.set(t.complaint_id, t);
  }
  for (const s of byStaff.values()) {
    for (const t of s.firstAction.values()) {
      s.total += 1;
      const slaStage = STEP_STAGE_TO_SLA_STAGE[t.stage];
      if (!slaStage) continue;
      const budgetDays = effectiveSlaDays(slaStage, t.priority_score);
      const entered = t.stage_entered_at || t.complaint_created_at;
      if (!entered || !t.acted_at) continue;
      const deadline = new Date(new Date(entered + 'Z').getTime() + budgetDays * 86400000);
      const acted = new Date(t.acted_at + 'Z');
      if (acted <= deadline) s.onTime += 1;
    }
    if (s.total < MIN_RESOLVED) {
      await db.prepare('DELETE FROM staff_badges WHERE staff_id = ? AND badge_type = ?')
        .run(s.staff_id, 'sla');
      continue;
    }
    const pct = (s.onTime / s.total) * 100;
    const tier = earnedTier(SLA_TIERS, pct);
    await replaceRollingBadge({
      staff_id: s.staff_id, badge_type: 'sla', tier, period_start, period_end
    });
  }
}

/** d) ACCURACY — % of credited resolutions never disputed / reopened. */
async function computeAccuracyBadges(byStaff, period_start, period_end) {
  for (const s of byStaff.values()) {
    if (s.resolved < MIN_RESOLVED) {
      await db.prepare('DELETE FROM staff_badges WHERE staff_id = ? AND badge_type = ?')
        .run(s.staff_id, 'accuracy');
      continue;
    }
    const ok = s.resolved - s.reopenedCount;
    const pct = (ok / s.resolved) * 100;
    const tier = earnedTier(ACC_TIERS, pct);
    await replaceRollingBadge({
      staff_id: s.staff_id, badge_type: 'accuracy', tier, period_start, period_end
    });
  }
}

/**
 * e) CATEGORY SPECIALIST — one non-tiered badge per category, earned with
 * 20+ resolved in a single category AND a 4.0+ satisfaction average there.
 * Multiple categories can be held at once; each is re-evaluated per period.
 */
async function computeSpecialistBadges(eligible, period_start, period_end) {
  for (const s of eligible.values()) {
    for (const [category, c] of s.byCategory) {
      if (!SPECIALIST_BADGE_TYPES.includes(`specialist_${category}`)) continue;
      const avg = c.rated > 0 ? c.satSum / c.rated : null;
      const qualifies = c.resolved >= MIN_CATEGORY_RESOLVED && avg != null && avg >= MIN_CATEGORY_SAT;
      const badge_type = `specialist_${category}`;
      if (qualifies) {
        await replaceRollingBadge({
          staff_id: s.staff_id, badge_type, tier: null, period_start, period_end
        });
      } else {
        await db.prepare('DELETE FROM staff_badges WHERE staff_id = ? AND badge_type = ?')
          .run(s.staff_id, badge_type);
      }
    }
  }
}

/* ------------------------------------------------------------------ *
 * Milestone computations (lifetime, permanent)
 * ------------------------------------------------------------------ */

/** Staff ids with a credited action on a given complaint. */
async function contributorsForComplaint(complaintId) {
  return (await db.prepare(
    `SELECT DISTINCT actor_staff_id AS staff_id
       FROM workflow_steps
      WHERE complaint_id = ?
        AND action IN (${CREDITED_ACTIONS.map(() => '?').join(',')})
        AND actor_staff_id IS NOT NULL`
  ).all(complaintId, ...CREDITED_ACTIONS)).map((r) => r.staff_id);
}

async function lifetimeStatsFor(staffIds) {
  if (staffIds.length === 0) return new Map();
  const rows = await creditedResolutions({});
  const byStaff = new Map();
  for (const r of rows) {
    if (!staffIds.includes(r.staff_id)) continue;
    let s = byStaff.get(r.staff_id);
    if (!s) {
      s = { staff_id: r.staff_id, resolved: 0, firstResolvedAt: null, months: new Set(), seen: new Set() };
      byStaff.set(r.staff_id, s);
    }
    if (s.seen.has(r.complaint_id)) continue; // count each complaint once
    s.seen.add(r.complaint_id);
    s.resolved += 1;
    if (!s.firstResolvedAt || r.resolved_at < s.firstResolvedAt) s.firstResolvedAt = r.resolved_at;
    s.months.add(r.resolved_at.slice(0, 7)); // YYYY-MM
  }
  return byStaff;
}

async function computeMilestonesFor(staffIds, now = new Date()) {
  const stats = await lifetimeStatsFor(staffIds);
  let awarded = 0;
  for (const s of stats.values()) {
    // "First 10" — first 10 lifetime credited resolutions.
    if (s.resolved >= FIRST_10_COUNT && await awardMilestone({ staff_id: s.staff_id, badge_type: 'first10' })) awarded += 1;
    // "Century Club" — 100 lifetime credited resolutions.
    if (s.resolved >= CENTURY_COUNT && await awardMilestone({ staff_id: s.staff_id, badge_type: 'century' })) awarded += 1;
    // "Veteran" — 6+ months since first resolution AND at least one
    // resolution in each of the last 3 calendar months (consistent activity).
    if (s.firstResolvedAt) {
      const first = new Date(s.firstResolvedAt + 'Z');
      const ageMonths = (now.getFullYear() - first.getFullYear()) * 12 + (now.getMonth() - first.getMonth());
      if (ageMonths >= VETERAN_MONTHS) {
        let active = true;
        for (let i = 0; i < VETERAN_RECENT_MONTHS; i++) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          if (!s.months.has(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)) {
            active = false;
            break;
          }
        }
        if (active && await awardMilestone({ staff_id: s.staff_id, badge_type: 'veteran' })) awarded += 1;
      }
    }
  }
  return awarded;
}

/* ------------------------------------------------------------------ *
 * Entry points
 * ------------------------------------------------------------------ */

/** Staff role + geography, for peer grouping. */
async function staffMetaMap() {
  const rows = await db.prepare(
    `SELECT s.staff_id, s.staff_role, a.district, a.division
       FROM staff s JOIN authorities a ON a.authority_id = s.authority_id`
  ).all();
  return new Map(rows.map((r) => [r.staff_id, r]));
}

/**
 * Recompute every rolling badge for the trailing window. Safe to run
 * repeatedly — each badge row is replaced with the current verdict.
 */
export async function computeRollingBadges(now = new Date()) {
  const period_end = now.toISOString().slice(0, 19).replace('T', ' ');
  const since = new Date(now.getTime() - ROLLING_WINDOW_DAYS * 86400000)
    .toISOString().slice(0, 19).replace('T', ' ');

  const rows = await creditedResolutions({ since });
  const reopened = await reopenedComplaintIds();
  const byStaff = aggregateStaff(rows, reopened);

  const eligible = new Map();
  for (const s of byStaff.values()) if (s.resolved >= MIN_RESOLVED) eligible.set(s.staff_id, s);

  const staffMeta = await staffMetaMap();
  await computeVolumeBadges(eligible, staffMeta, since, period_end);
  await computeSatisfactionBadges(byStaff, since, period_end);
  await computeSlaBadges(await creditedStepTiming({ since }), since, period_end);
  await computeAccuracyBadges(byStaff, since, period_end);
  await computeSpecialistBadges(byStaff, since, period_end);

  return {
    window: { start: since, end: period_end },
    creditedResolutions: rows.length,
    eligibleStaff: eligible.size
  };
}

/** Rolling + milestone sweep over every staff member (seed / manual run). */
export async function computeAllBadges(now = new Date()) {
  const rolling = await computeRollingBadges(now);
  const staffIds = (await db.prepare('SELECT staff_id FROM staff').all()).map((r) => r.staff_id);
  const milestones = await computeMilestonesFor(staffIds, now);
  return { ...rolling, milestonesAwarded: milestones };
}

/**
 * Lightweight milestone check triggered when a complaint is resolved.
 * Evaluates only the staff who contributed to that complaint.
 */
export async function checkMilestonesOnResolution(complaintId, now = new Date()) {
  const staffIds = await contributorsForComplaint(complaintId);
  if (staffIds.length === 0) return 0;
  return await computeMilestonesFor(staffIds, now);
}
