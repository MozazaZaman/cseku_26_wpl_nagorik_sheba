/**
 * Badge seed data — builds realistic multi-authority workloads so every badge
 * type can be observed in the UI, then runs the badge computation.
 *
 * What it creates (all idempotent — safe to re-run):
 *
 *   Dhaka South CC (authority 2)   — busy city authority
 *     - 5 extra field staff + varied juniors/seniors, one "gold in multiple"
 *       performer, one borderline-threshold performer, one below-eligibility
 *       performer, plus category-concentrated work for a Specialist badge.
 *   Savar Pourashava (authority 107)  — mid-volume, Dhaka district
 *   Ruhitpur Union Parishad (authority 3643) — quiet rural, low volume
 *
 * Full workflow chains are written so the badge attribution queries (which
 * read workflow_steps) see real approved/assigned/resolved actions.
 *
 * Run with:  npm run seed:badges
 */

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db, closeDb } from '../src/db.js';
import { computeAllBadges } from '../src/utils/badges.js';

const BADGE_SEED_MARKER = '__badge_seed__';

const ROLES = ['junior', 'senior', 'wit', 'field'];

const CATEGORIES = ['road', 'electricity', 'water', 'gas', 'sanitation'];
const CAT_TITLES = {
  road: 'Pothole repair needed',
  electricity: 'Street light not working',
  water: 'Water supply disruption',
  gas: 'Gas line leak reported',
  sanitation: 'Garbage collection missed'
};

/* ------------------------------- helpers ------------------------------- */

function iso(daysAgo, hour = 9) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

const rand = (seed => () => {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
})(20260922);

const pick = (arr) => arr[Math.floor(rand() * arr.length)];

async function markerExists() {
  return !!(await db.prepare('SELECT 1 FROM notifications WHERE title = ?').get(BADGE_SEED_MARKER));
}

/**
 * Write one fully-resolved complaint with its workflow chain, so every
 * eligible role gets a credited action (approved/assigned/resolved).
 *
 * staffByRole: { junior: staffId, senior: staffId, wit: staffId, field: staffId }
 * opts: { category, daysAgoResolved, satisfaction, slaOnTime, disputed,
 *         reopenedAfter, priority, fieldStaffOf }
 */
async function resolvedComplaint(authorityId, userId, staffByRole, opts = {}) {
  const cat = opts.category || pick(CATEGORIES);
  const created = iso(opts.daysAgoResolved + 2 + Math.floor(rand() * 3));
  const resolved = iso(opts.daysAgoResolved);
  const id = (await db.prepare(
    `INSERT INTO complaints
      (user_id, authority_id, category, title, description, status,
       current_stage, stage_owner_role, priority_score, created_at, updated_at,
       resolved_at, executor_staff_id, executor_name, eta_hours,
       latitude, longitude, address_text,
       satisfaction_score, satisfaction_comment, satisfaction_submitted_at)
     VALUES (?, ?, ?, ?, ?, 'resolved', 'execution', 'field', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    userId, authorityId, cat,
    `${CAT_TITLES[cat]} #${Math.floor(rand() * 9000 + 1000)}`,
    `Citizen reported an issue in the ${cat} sector. Verified and resolved by the field team.`,
    opts.priority ?? Math.floor(rand() * 70),
    created, resolved, resolved,
    staffByRole.field, opts.fieldName || 'Field Staff', opts.eta ?? 48,
    opts.lat ?? 23.675, opts.lng ?? 90.375, opts.address || 'Seeded location',
    opts.satisfaction ?? null,
    opts.satisfaction != null ? (opts.satisfactionComment || 'Thanks for the quick work!') : null,
    opts.satisfaction != null ? resolved : null
  )).lastInsertRowid;

  // Junior -> senior -> mayor -> (senior) WIT -> WIT assigns -> field resolves.
  // Each credited action is the SLA-relevant step for that role.
  const jr = iso(opts.daysAgoResolved + 2);
  const sr = iso(opts.daysAgoResolved + 1, 11);
  const my = iso(opts.daysAgoResolved + 1, 13);
  const wit = iso(opts.daysAgoResolved + 1, 15);
  // Field: on time resolves well inside the 7-day execution budget; late ones
  // breach it so the SLA badge has a realistic mix.
  const fieldResolved = opts.slaOnTime
    ? iso(opts.daysAgoResolved, 9)
    : iso(Math.max(0, opts.daysAgoResolved - 3), 9); // resolved "later" than budget allows

  const step = db.prepare(
    `INSERT INTO workflow_steps (complaint_id, stage, action, actor_staff_id, actor_name, actor_role, comment, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  await step.run(id, 'junior_review', 'approved', staffByRole.junior, opts.names?.junior || 'Junior Officer', 'junior', 'Verified and forwarded', jr);
  await step.run(id, 'senior_review', 'approved', staffByRole.senior, opts.names?.senior || 'Senior Officer', 'senior', 'Genuine and solvable', sr);
  await step.run(id, 'mayor_review', 'approved', staffByRole.mayor, opts.names?.mayor || 'Mayor', 'mayor', 'Approved', my);
  await step.run(id, 'wit_inspection', 'pending', staffByRole.senior, opts.names?.senior || 'Senior Officer', 'senior', 'Sent to Work Inspection Team', wit);
  await step.run(id, 'assignment', 'assigned', staffByRole.wit, opts.names?.wit || 'WIT Officer', 'wit', 'Field staff assigned', wit);
  await step.run(id, 'execution', 'resolved', staffByRole.field, opts.names?.field || 'Field Staff', 'field', 'Work completed', fieldResolved);

  const hist = db.prepare(
    `INSERT INTO status_history (complaint_id, old_status, new_status, note, changed_by, changed_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  await hist.run(id, 'submitted', 'verified', 'AI pipeline classified', 'System', created);
  await hist.run(id, 'verified', 'resolved', 'Full workflow completed', opts.names?.field || 'Field Staff', resolved);

  if (opts.disputed) {
    await step.run(id, 'execution', 'returned', null, 'Citizen', 'citizen', 'Citizen disputed the resolution', iso(Math.max(0, opts.daysAgoResolved - 1), 20));
    await hist.run(id, 'resolved', 'wit_review', 'Citizen disputed the fix', 'Citizen', iso(Math.max(0, opts.daysAgoResolved - 1), 20));
    if (opts.reopenedAfter !== false) {
      // re-resolved, so the complaint ends resolved but carries a reopen mark
      await hist.run(id, 'wit_review', 'resolved', 'Re-inspected and re-resolved', opts.names?.field || 'Field Staff', iso(Math.max(0, opts.daysAgoResolved - 2), 9));
      await step.run(id, 'execution', 'resolved', staffByRole.field, opts.names?.field || 'Field Staff', 'field', 'Re-resolved after re-inspection', iso(Math.max(0, opts.daysAgoResolved - 2), 9));
    }
  }
  return id;
}

/* ------------------------------- main ------------------------------- */

async function seed() {
  if ((await markerExists()) && !process.argv.includes('--reset')) {
    console.log('Badge seed already applied — nothing to do.');
    console.log('To re-run from scratch: npm run seed:badges:reset');
    return;
  }
  if (process.argv.includes('--reset')) {
    console.log('--reset: removing previously seeded badge data...');
    let removed = 0;
    // Seeded complaints carry a distinctive description marker; delete only
    // those (never the demo complaints from src/seed.js).
    const ids = (await db.prepare(
      `SELECT complaint_id FROM complaints
        WHERE description LIKE 'Citizen reported an issue in the%'`
    ).all()).map((r) => r.complaint_id);
    removed = ids.length;
    if (ids.length) {
      const placeholders = ids.map(() => '?').join(',');
      await db.prepare(`DELETE FROM workflow_steps WHERE complaint_id IN (${placeholders})`).run(...ids);
      await db.prepare(`DELETE FROM status_history WHERE complaint_id IN (${placeholders})`).run(...ids);
      await db.prepare(`DELETE FROM complaints WHERE complaint_id IN (${placeholders})`).run(...ids);
    }
    await db.prepare(`DELETE FROM staff_badges`).run();
    await db.prepare(`DELETE FROM staff_recognitions`).run();
    await db.prepare(`DELETE FROM notifications WHERE title = ?`).run(BADGE_SEED_MARKER);
    // Only the extra staff this script created (never the original roster).
    await db.prepare(
      `DELETE FROM staff WHERE email IN (
         'rafiq.field.dhaka.2@nagorik.bd','sabina.field.dhaka.2@nagorik.bd',
         'tariq.field.dhaka.2@nagorik.bd','nasrin.field.dhaka.2@nagorik.bd',
         'belal.junior.dhaka.2@nagorik.bd','roksana.senior.dhaka.2@nagorik.bd')`
    ).run();
    console.log(`Reset complete (${removed} seeded complaints removed).`);
  }

  const authorities = await db.prepare(
    `SELECT authority_id, name, type FROM authorities
      WHERE authority_id IN (2, 107, 3643)
      ORDER BY authority_id`
  ).all();
  if (authorities.length !== 3) {
    throw new Error('Expected authorities 2, 107 and 3643 to exist. Run `npm run seed` first.');
  }
  const byId = Object.fromEntries(authorities.map((a) => [a.authority_id, a]));
  console.log('Seeding badge data for:',
    authorities.map((a) => `${a.name} (${a.type})`).join(', '));

  const passwordHash = bcrypt.hashSync('staff123', 10);
  const newStaff = [];

  /**
   * Dhaka South CC — the busy authority. We add 5 field staff so the
   * role+district peer group has enough members for percentiles to be
   * meaningful, plus extra junior/senior officers.
   */
  const dhaka = {
    junior: [], senior: [], wit: [], mayor: null, field: []
  };
  // existing staff of authority 2
  const existing = await db.prepare('SELECT staff_id, staff_role FROM staff WHERE authority_id = 2').all();
  for (const s of existing) {
    if (s.staff_role === 'mayor') dhaka.mayor = s.staff_id;
    else if (dhaka[s.staff_role]) dhaka[s.staff_role].push(s.staff_id);
  }

  const mkStaff = async (role, name, email) => {
    const id = (await db.prepare(
      `INSERT INTO staff (full_name, email, password_hash, department, staff_role, authority_id)
       VALUES (?, ?, ?, 'general', ?, 2)`
    ).run(name, email, passwordHash, role)).lastInsertRowid;
    newStaff.push(id);
    return id;
  };
  // extra staff to make peer groups realistic
  // extra staff to make peer groups realistic
  const rafiqField = await mkStaff('field', 'Rafiqul Islam — Field Staff', 'rafiq.field.dhaka.2@nagorik.bd');
  const sabinaField = await mkStaff('field', 'Sabina Yasmin — Field Staff', 'sabina.field.dhaka.2@nagorik.bd');
  const tariqField = await mkStaff('field', 'Tariq Aziz — Field Staff', 'tariq.field.dhaka.2@nagorik.bd');
  const nasrinField = await mkStaff('field', 'Nasrin Sultana — Field Staff', 'nasrin.field.dhaka.2@nagorik.bd');
  dhaka.field.push(rafiqField, sabinaField, tariqField, nasrinField);
  dhaka.junior.push(await mkStaff('junior', 'Belal Hossain — Junior Officer', 'belal.junior.dhaka.2@nagorik.bd'));
  dhaka.senior.push(await mkStaff('senior', 'Roksana Khatun — Senior Officer', 'roksana.senior.dhaka.2@nagorik.bd'));

  const dhakaUsers = [1, 2, 3];
  const dhakaStaff = {
    junior: dhaka.junior[0], senior: dhaka.senior[0], wit: dhaka.wit[0],
    mayor: dhaka.mayor, field: dhaka.field[0]
  };
  const dhakaNames = {
    junior: 'Kamrul Hasan', senior: 'Kamrul Hasan — Senior Officer',
    wit: 'Shirin Akter — Work Inspection Team', mayor: 'Mayor of Dhaka South',
    field: 'Habibur Rahman — Field Staff'
  };

  /**
   * STAR PERFORMER — Habibur (field, existing staff 5):
   * 40 resolved in the window, high satisfaction, on-time, not disputed,
   * and concentrated in "road" for the Category Specialist badge.
   * Should earn: volume gold (top of the field peer group), satisfaction
   * gold, SLA gold, accuracy gold, Road Specialist.
   */
  const starField = 5; // existing Habibur
  for (let i = 0; i < 40; i++) {
    await resolvedComplaint(2, dhakaUsers[i % 3], { ...dhakaStaff, field: starField }, {
      category: i < 22 ? 'road' : pick(CATEGORIES),
      daysAgoResolved: Math.floor(i / 2) + 1,
      satisfaction: i < 8 ? 5 : (i < 30 ? 5 : 4),
      slaOnTime: true,
      disputed: i === 15, // one dispute keeps accuracy high but not perfect
      names: dhakaNames
    });
  }

  /**
   * BORDERLINE PERFORMER — Sabina (field):
   * 12 resolved (above the 10 minimum), satisfaction hovering near the
   * 3.5 bronze floor, mixed SLA timing -> mid-tier badges only.
   */
  for (let i = 0; i < 12; i++) {
    await resolvedComplaint(2, dhakaUsers[i % 3], { ...dhakaStaff, field: sabinaField }, {
      daysAgoResolved: i * 4 + 2,
      satisfaction: i % 3 === 0 ? 3 : 4,
      slaOnTime: i % 2 === 0,
      disputed: i === 5,
      names: dhakaNames
    });
  }

  /**
   * BELOW-ELIGIBILITY PERFORMER — Tariq (field):
   * only 6 resolved in the window (below the 10 minimum). Must earn NO
   * rolling badges, verifying the neutral "not eligible" state.
   */
  for (let i = 0; i < 6; i++) {
    await resolvedComplaint(2, dhakaUsers[i % 3], { ...dhakaStaff, field: tariqField }, {
      daysAgoResolved: i * 6 + 3,
      satisfaction: 5, slaOnTime: true,
      names: dhakaNames
    });
  }

  // Two more Dhaka field staff with mid volumes to enrich the peer group.
  for (let i = 0; i < 14; i++) {
    await resolvedComplaint(2, dhakaUsers[i % 3], { ...dhakaStaff, field: rafiqField }, {
      daysAgoResolved: i * 3 + 1, satisfaction: 4, slaOnTime: true, names: dhakaNames
    });
  }
  for (let i = 0; i < 9; i++) {
    await resolvedComplaint(2, dhakaUsers[i % 3], { ...dhakaStaff, field: nasrinField }, {
      daysAgoResolved: i * 5 + 2, satisfaction: 3, slaOnTime: false, names: dhakaNames
    });
  }

  // Dhaka junior/senior/WIT also need volume across the same complaints:
  // their credited actions are the approve/assign steps written above, so
  // they already accrue. A couple of extra chains for the extra officers.
  for (let i = 0; i < 20; i++) {
    await resolvedComplaint(2, dhakaUsers[i % 3], {
      junior: dhaka.junior[1], senior: dhaka.senior[1], wit: dhaka.wit[0],
      mayor: dhaka.mayor, field: starField
    }, {
      daysAgoResolved: i + 1, satisfaction: 5, slaOnTime: true, names: dhakaNames
    });
  }

  /**
   * SAVAR POURASHAVA (107) — mid-volume, same Dhaka district so it joins
   * the same peer group as Dhaka South (realistic cross-LGI comparison).
   */
  const savarStaff = {};
  const savarExisting = await db.prepare('SELECT staff_id, staff_role FROM staff WHERE authority_id = 107').all();
  for (const s of savarExisting) savarStaff[s.staff_role] = s.staff_id;
  const savarNames = {
    junior: 'Junior Officer — Savar', senior: 'Senior Officer — Savar',
    wit: 'WIT Officer — Savar', mayor: 'Mayor of Savar', field: 'Field Staff — Savar'
  };
  for (let i = 0; i < 16; i++) {
    await resolvedComplaint(107, dhakaUsers[i % 3], savarStaff, {
      daysAgoResolved: i * 3 + 1,
      satisfaction: i % 4 === 0 ? 3 : 4,
      slaOnTime: i % 5 !== 0,
      names: savarNames
    });
  }

  /**
   * RUHITPUR UNION PARISHAD (3643) — quiet rural authority, low volume.
   * Its staff fall below the eligibility minimums, demonstrating that a
   * sparse LGI produces no badges (neutral, not a penalty).
   */
  const ruhitpurStaff = {};
  const ruhExisting = await db.prepare('SELECT staff_id, staff_role FROM staff WHERE authority_id = 3643').all();
  for (const s of ruhExisting) ruhitpurStaff[s.staff_role] = s.staff_id;
  const ruhNames = {
    junior: 'Junior Officer — Ruhitpur', senior: 'Senior Officer — Ruhitpur',
    wit: 'WIT Officer — Ruhitpur', mayor: 'Chairman of Ruhitpur', field: 'Field Staff — Ruhitpur'
  };
  for (let i = 0; i < 5; i++) {
    await resolvedComplaint(3643, dhakaUsers[i % 3], ruhitpurStaff, {
      daysAgoResolved: i * 8 + 2, satisfaction: 4, slaOnTime: true, names: ruhNames
    });
  }

  /**
   * CENTURY CLUB + VETERAN — Habibur again: backdate ~90 more resolved
   * complaints beyond the rolling window (lifetime totals, old months)
   * with activity spread across the last 3 calendar months.
   */
  for (let i = 0; i < 90; i++) {
    await resolvedComplaint(2, dhakaUsers[i % 3], { ...dhakaStaff, field: starField }, {
      daysAgoResolved: 120 + i * 2,        // 4-10 months ago: beyond the 90d window
      satisfaction: null,                  // old complaints, unrated
      slaOnTime: true,
      names: dhakaNames
    });
  }
  // recent-month activity so the Veteran "active in last 3 months" rule
  // holds — one resolution in each of the last three calendar months.
  for (const ago of [5, 35, 65]) {
    await resolvedComplaint(2, dhakaUsers[0], { ...dhakaStaff, field: starField }, {
      daysAgoResolved: ago, satisfaction: 5, slaOnTime: true, names: dhakaNames
    });
  }

  // Mayor's Commendation: the Dhaka South mayor commends the star performer.
  const mayorId = dhaka.mayor;
  if (mayorId && starField) {
    await db.prepare(
      `INSERT INTO staff_recognitions (staff_id, awarded_by, note)
       VALUES (?, ?, ?)`
    ).run(starField, mayorId, 'Outstanding service during the monsoon road repair drive.');
  }

  // marker so re-runs are no-ops
  await db.prepare(
    `INSERT INTO notifications (user_id, recipient_type, complaint_id, type, title, message, is_read)
     VALUES (?, 'staff', NULL, 'status_change', ?, ?, 1)`
  ).run(mayorId || 1, BADGE_SEED_MARKER, 'Badge seed marker — do not delete');

  console.log('Seed data written. Running badge computation...');

  // compute badges immediately so they are visible without waiting a week
  const result = await computeAllBadges();
  console.log('Badge computation complete:', JSON.stringify(result, null, 2));

  // summary
  const summary = await db.prepare(
    `SELECT s.full_name, s.staff_role, b.badge_type, b.tier, b.period_end
       FROM staff_badges b JOIN staff s ON s.staff_id = b.staff_id
      ORDER BY s.staff_role, s.full_name, b.badge_type`
  ).all();
  console.log(`\nAwarded ${summary.length} badge row(s):`);
  for (const r of summary) {
    console.log(`  ${r.full_name} [${r.staff_role}] — ${r.badge_type}${r.tier ? ` (${r.tier})` : ''}${r.period_end ? ' [rolling]' : ' [lifetime]'}`);
  }
}

seed().then(async () => {
  await closeDb();
  process.exit(0);
}).catch((e) => {
  console.error('Badge seed failed:', e);
  process.exit(1);
});
