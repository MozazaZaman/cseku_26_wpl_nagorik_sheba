import 'express-async-errors';
import express from 'express';
import 'dotenv/config';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDb, db, logWorkflowStep, notify } from './db.js';
import authRoutes from './routes/auth.js';
import complaintRoutes from './routes/complaints.js';
import notificationRoutes from './routes/notifications.js';
import assistantRoutes from './routes/assistant.js';
import serviceRoutes from './routes/services.js';
import analyticsRoutes from './routes/analytics.js';
import staffRoutes from './routes/staff.js';
import billingRoutes from './routes/billing.js';
import { requireAuth } from './middleware/auth.js';
import { initFaceEngine } from './agents/faceEngine.js';
import { initEmailer } from './utils/emailer.js';
import { SLA_STAGES, SLA_FORWARD_MAP, SLA_GRACE_DAYS, SLA_REPING_HOURS, graceDeadline, armSla } from './utils/sla.js';
import { computeRollingBadges } from './utils/badges.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.set('trust proxy', 1);

const allowedOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : true,
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use('/geo', express.static(path.join(__dirname, '..', '..', 'uploads')));

await initDb();
initFaceEngine();
initEmailer();

async function cleanupOldNotifications() {
  const r = await db.prepare("DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '90 days'").run();
  if (r.changes > 0) console.log(`Auto-deleted ${r.changes} notification(s) older than 90 days`);
}

/**
 * Resolution confirmation sweep: resolved complaints with a proof photo where
 * the citizen neither confirmed nor disputed within N days are auto-reopened
 * (escalated back to the Work Inspection Team for re-inspection).
 */
async function autoReopenUnconfirmed() {
  const rows = await db.prepare(
    `SELECT * FROM complaints
     WHERE status = 'resolved'
       AND resolved_confirmed_by_citizen = 0
       AND confirmation_deadline IS NOT NULL
       AND confirmation_deadline < NOW()`
  ).all();
  for (const c of rows) {
    await db.prepare(
      `UPDATE complaints SET status = 'wit_review', current_stage = 'wit_inspection', stage_owner_role = 'wit',
         resolved_at = NULL, confirmation_deadline = NULL, updated_at = NOW()
       WHERE complaint_id = ?`
    ).run(c.complaint_id);
    await db.prepare(
      `INSERT INTO status_history (complaint_id, old_status, new_status, note, changed_by)
       VALUES (?, 'resolved', 'wit_review', 'Auto-reopened: citizen did not confirm the resolution in time.', 'System')`
    ).run(c.complaint_id);
    // escalate to WIT + oversight roles
    for (const role of ['wit', 'senior', 'mayor']) {
      const staff = await db.prepare(
        `SELECT staff_id FROM staff WHERE authority_id = ? AND staff_role = ? ORDER BY staff_id LIMIT 1`
      ).get(c.authority_id, role);
      if (staff) {
        await notify(staff.staff_id, c.complaint_id, 'Unconfirmed resolution auto-reopened',
          `#${c.complaint_id} "${c.title}" â€” the citizen did not confirm within the deadline. Re-inspect the work.`, 'staff');
      }
    }
    console.log(`Auto-reopened unconfirmed complaint #${c.complaint_id}`);
  }
  if (rows.length > 0) console.log(`Auto-reopen sweep: ${rows.length} complaint(s) escalated`);
}

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'nagorik-sheba-api' }));

app.get('/api/stats', async (_req, res) => {
  const count = async (sql) => (await db.prepare(sql).get()).n;
  res.json({
    complaints_total: await count("SELECT COUNT(*) n FROM complaints WHERE status != 'merged'"),
    resolved: await count("SELECT COUNT(*) n FROM complaints WHERE status = 'resolved'"),
    in_process: await count("SELECT COUNT(*) n FROM complaints WHERE status IN ('assigned','in_process')"),
    in_review: await count("SELECT COUNT(*) n FROM complaints WHERE status IN ('verified','under_field_review','mid_review','mayor_review','approved')"),
    citizens: await count('SELECT COUNT(*) n FROM users'),
    votes: await count('SELECT COALESCE(SUM(vote_count),0) n FROM complaints'),
    authorities: await count('SELECT COUNT(*) n FROM authorities')
  });
});

app.get('/api/geo', (_req, res) => {
  const geo = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'bd-geo.json'), 'utf-8'));
  res.json(geo);
});

// Server-side geocoding proxy (Nominatim requires an identifying User-Agent,
// which browsers cannot send - so the web/mobile apps route through us).
const geoCache = new Map();
const GEO_TTL = 24 * 60 * 60 * 1000;

app.get('/api/geocode', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'q parameter required' });

  const cached = geoCache.get(q);
  if (cached && Date.now() - cached.at < GEO_TTL) {
    return res.json(cached.result);
  }

  let result = { found: false, source: 'none' };
  try {
    const googleKey = process.env.GOOGLE_GEOCODE_KEY;
    if (googleKey) {
      const r = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?region=bd&key=${googleKey}&address=${encodeURIComponent(q)}`
      );
      const j = await r.json();
      if (j.status === 'OK' && j.results?.length) {
        result = {
          found: true, source: 'Google',
          lat: j.results[0].geometry.location.lat,
          lng: j.results[0].geometry.location.lng
        };
      }
    } else {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=bd&q=${encodeURIComponent(q)}`,
        { headers: { 'User-Agent': 'NagorikSheba/1.0 (student civic-tech project)' } }
      );
      if (r.ok) {
        const list = await r.json();
        if (list.length > 0) {
          result = { found: true, source: 'OpenStreetMap', lat: parseFloat(list[0].lat), lng: parseFloat(list[0].lon) };
        }
      } else {
        console.log(`Geocode upstream ${r.status} for: ${q.slice(0, 60)}`);
      }
    }
  } catch (e) {
    console.log('Geocode error:', e.message);
  }

  geoCache.set(q, { at: Date.now(), result });
  res.json(result);
});

app.get('/api/authorities', async (req, res) => {
  const { division, district, type, upazila } = req.query;
  let sql = `SELECT a.*, (SELECT COUNT(*) FROM complaints c WHERE c.authority_id = a.authority_id) AS complaint_count
             FROM authorities a WHERE 1=1`;
  const args = [];
  if (division) { sql += ' AND a.division = ?'; args.push(division); }
  if (district) { sql += ' AND a.district = ?'; args.push(district); }
  if (type) { sql += ' AND a.type = ?'; args.push(type); }
  if (upazila) { sql += ' AND a.upazila = ?'; args.push(upazila); }
  sql += ' ORDER BY a.name';
  res.json({ authorities: await db.prepare(sql).all(...args) });
});

app.get('/api/authorities/types', async (req, res) => {
  const { district } = req.query;
  if (!district) return res.json({ types: [] });
  const types = (await db.prepare(
    'SELECT DISTINCT type FROM authorities WHERE district = ?'
  ).all(district)).map(r => r.type);
  res.json({ types });
});

app.get('/api/authorities/upazilas', async (req, res) => {
  const { district } = req.query;
  if (!district) return res.json({ upazilas: [] });
  const rows = await db.prepare(
    "SELECT DISTINCT upazila FROM authorities WHERE district = ? AND type='UNION_PARISHAD' AND upazila IS NOT NULL ORDER BY upazila"
  ).all(district);
  res.json({ upazilas: rows.map(r=>r.upazila) });
});

// Direct JSON access for Report page (uses bangladesh_local_government_units.json)
app.get('/api/lg/units', (req, res) => {
  try {
    const p = path.join(__dirname, '..', '..', 'uploads', 'bangladesh_local_government_units.json');
    const j = JSON.parse(fs.readFileSync(p, 'utf-8'));
    res.json(j);
  } catch(e){ res.status(500).json({error:'LG file not found'}); }
});

// Emergency services: osmium extracts are seeded into DB; this reverse proxy gives accurate nearby addresses via public Nominatim (English for district matching)
const reverseCache = new Map();
app.get('/api/reverse', async (req, res) => {
  const lat = parseFloat(req.query.lat), lng = parseFloat(req.query.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return res.status(400).json({error:'lat/lng required'});
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const hit = reverseCache.get(key);
  if (hit && Date.now() - hit.at < 24*60*60*1000) return res.json(hit.data);
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=en`, {headers:{'User-Agent':'NagorikSheba/1.0 (emergency osmium+Nominatim)'}});
    if (!r.ok) return res.json({found:false});
    const j = await r.json();
    const data = {found:true, display_name: j.display_name, address: j.address, source:'OpenStreetMap'};
    reverseCache.set(key,{at:Date.now(), data});
    res.json(data);
  } catch(e){ res.json({found:false}); }
});

app.get('/api/my/notifications', requireAuth, async (req, res) => {
  await cleanupOldNotifications();
  const rows = req.auth.role === 'staff'
    ? await db.prepare(
        `SELECT * FROM notifications
         WHERE recipient_type = 'staff' AND user_id = ? ORDER BY created_at DESC LIMIT 50`
      ).all(req.auth.id)
    : await db.prepare(
        `SELECT * FROM notifications
         WHERE recipient_type = 'citizen' AND user_id = ? ORDER BY created_at DESC LIMIT 50`
      ).all(req.auth.id);
  res.json({ notifications: rows });
});

app.patch('/api/my/notifications/read-all', requireAuth, async (req, res) => {
  if (req.auth.role === 'citizen') {
    await db.prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND recipient_type = 'citizen'").run(req.auth.id);
  } else {
    await db.prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND recipient_type = 'staff'").run(req.auth.id);
  }
  res.json({ ok: true });
});

app.use('/api/auth', authRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/billing', billingRoutes);

// Serve the built web app (production single-service deployment)
const distDir = path.join(__dirname, '..', '..', 'web', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^\/(?!api|uploads).*/, (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

/**
 * SLA sweep — time pressure for the hierarchical workflow.
 *
 * Tier 1: sla_deadline passed & not yet flagged -> mark overdue, notify the
 *         stage owner + their superior (junior->senior, senior->mayor).
 * Tier 2: sla_deadline + grace period passed with no action ->
 *         junior/senior/mayor stages: AUTO-FORWARD past the stalled staff
 *         member (trail names who was bypassed). WIT/field stages cannot be
 *         sensibly auto-decided (human judgement / physical work) so they get
 *         a repeat escalation ping every SLA_REPING_HOURS instead.
 */
const STAGE_LABELS = {
  junior_review: 'Junior Staff Check',
  senior_review: 'Senior Staff Feasibility',
  mayor_review: 'Mayor / Chairman Permission',
  wit_inspection: 'Work Inspection Team',
  execution: 'Execution'
};

async function staffOfRole(authorityId, role) {
  return await db.prepare(
    `SELECT staff_id, full_name, email FROM staff
     WHERE authority_id = ? AND staff_role = ? ORDER BY staff_id LIMIT 1`
  ).get(authorityId, role);
}

async function autoForward(complaint, cfg) {
  const id = complaint.complaint_id;
  const owner = await staffOfRole(complaint.authority_id, cfg.ownerRole);
  const bypassedName = owner ? `${owner.full_name} (${cfg.ownerRole} staff)` : `${cfg.ownerRole} staff`;
  const idleDays = complaint.stage_entered_at
    ? Math.max(1, Math.round((Date.now() - new Date(complaint.stage_entered_at + 'Z').getTime()) / 86400000))
    : SLA_GRACE_DAYS + 1;

  const fwd = SLA_FORWARD_MAP[cfg.stage];
  if (!fwd) return;

  await db.prepare(
    `UPDATE complaints
     SET status = ?, current_stage = ?, stage_owner_role = ?, overdue_flag = 0, updated_at = NOW()
     WHERE complaint_id = ?`
  ).run(fwd.nextStatus, fwd.nextStage, fwd.nextOwnerRole, id);

  await logWorkflowStep({
    complaintId: id, stage: cfg.stage, action: 'approved',
    actorName: 'SLA System', actorRole: 'system',
    comment: `SLA breach: auto-escalated past ${bypassedName} (idle ${idleDays}d) — ${fwd.nextOwnerRole} now owns this`
  });
  await db.prepare(
    `INSERT INTO status_history (complaint_id, old_status, new_status, note, changed_by)
     VALUES (?, ?, ?, 'SLA breach: auto-escalated due to overdue stage', 'SLA System')`
  ).run(id, complaint.status, fwd.nextStatus);

  // notifications: the bypassed staff (transparency), the next owner, the citizen
  if (owner) {
    await notify(owner.staff_id, id, 'Your queue was auto-escalated (SLA breach)',
      `#${id} "${complaint.title}" sat idle past its SLA deadline and was forwarded automatically.`, 'staff');
  }
  const next = await staffOfRole(complaint.authority_id, fwd.nextOwnerRole);
  if (next) {
    await notify(next.staff_id, id, 'Complaint auto-forwarded to you (SLA breach)',
      `#${id} "${complaint.title}" was escalated past the ${cfg.ownerRole} stage — please act on it now.`, 'staff');
  }
  await notify(complaint.user_id, id, 'Your complaint was escalated for faster action',
    `#${id} "${complaint.title}" exceeded its review deadline at the ${STAGE_LABELS[cfg.stage]} stage and was automatically escalated.`);

  // Re-arm the SLA clock for the stage the complaint lands in
  await armSla(id);
  console.log(`[SLA] auto-forwarded #${id} past ${cfg.stage} (idle ${idleDays}d) -> ${fwd.nextStatus}`);
}

async function slaSweep() {
  const rows = await db.prepare(
    `SELECT * FROM complaints
     WHERE status IN ('verified','junior_review','senior_review','mayor_review','wit_review','assigned','in_process')
       AND sla_deadline IS NOT NULL`
  ).all();
  let flagged = 0, forwarded = 0, pinged = 0;

  for (const c of rows) {
    const cfg = SLA_STAGES[c.status];
    if (!cfg) continue;
    const now = Date.now();
    const deadline = new Date(c.sla_deadline + 'Z').getTime();
    const grace = graceDeadline(c)?.getTime() ?? deadline;

    // Tier 1: first deadline miss -> flag + notify owner & superior
    if (now > deadline && !c.overdue_flag) {
      await db.prepare('UPDATE complaints SET overdue_flag = 1, updated_at = NOW() WHERE complaint_id = ?').run(c.complaint_id);
      await db.prepare(
        `INSERT INTO status_history (complaint_id, old_status, new_status, note, changed_by)
         VALUES (?, ?, ?, ?, 'SLA System')`
      ).run(c.complaint_id, c.status, c.status, `Auto-flagged OVERDUE at ${STAGE_LABELS[cfg.stage]} stage (SLA deadline passed)`);
      const owner = await staffOfRole(c.authority_id, cfg.ownerRole);
      if (owner) {
        await notify(owner.staff_id, c.complaint_id, 'SLA breach: complaint is OVERDUE in your queue',
          `#${c.complaint_id} "${c.title}" passed its review deadline. Act now or it will be auto-escalated in ${SLA_GRACE_DAYS} day(s).`, 'staff');
      }
      if (cfg.superiorRole) {
        const sup = await staffOfRole(c.authority_id, cfg.superiorRole);
        if (sup) {
          await notify(sup.staff_id, c.complaint_id, `Overdue complaint under your ${cfg.ownerRole} staff`,
            `#${c.complaint_id} "${c.title}" is overdue at the ${STAGE_LABELS[cfg.stage]} stage and will auto-escalate if not handled.`, 'staff');
        }
      }
      flagged++;
    }

    // Tier 2: grace period over -> auto-forward (or repeat ping for WIT/field)
    if (now > grace) {
      if (cfg.forward) {
        await autoForward(c, cfg);
        forwarded++;
      } else {
        const lastPing = await db.prepare(
          `SELECT created_at FROM notifications
           WHERE complaint_id = ? AND recipient_type = 'staff' AND title LIKE 'SLA%' ORDER BY notification_id DESC LIMIT 1`
        ).get(c.complaint_id);
        const lastAt = lastPing ? new Date(lastPing.created_at + 'Z').getTime() : 0;
        if (now - lastAt > SLA_REPING_HOURS * 3600000) {
          for (const role of [cfg.ownerRole, cfg.superiorRole, 'senior', 'mayor'].filter(Boolean)) {
            const s = await staffOfRole(c.authority_id, role);
            if (s) {
              await notify(s.staff_id, c.complaint_id, 'SLA breach: overdue work needs your action',
                `#${c.complaint_id} "${c.title}" is overdue at the ${STAGE_LABELS[cfg.stage]} stage. This cannot be auto-forwarded — it needs human action.`, 'staff');
            }
          }
          pinged++;
        }
      }
    }
  }
  if (flagged || forwarded || pinged) {
    console.log(`[SLA] sweep: ${flagged} flagged, ${forwarded} auto-forwarded, ${pinged} re-pinged`);
  }
}

await cleanupOldNotifications();
setInterval(() => { cleanupOldNotifications().catch(e => console.error('cleanupOldNotifications failed:', e.message)); }, 24 * 60 * 60 * 1000);

await autoReopenUnconfirmed();
setInterval(() => { autoReopenUnconfirmed().catch(e => console.error('autoReopenUnconfirmed failed:', e.message)); }, 6 * 60 * 60 * 1000); // check every 6 hours

await slaSweep();
setInterval(() => { slaSweep().catch(e => console.error('slaSweep failed:', e.message)); }, 60 * 60 * 1000); // every hour

// Rolling achievement badges: recompute the trailing window weekly. The
// milestone badges are evaluated immediately at resolution time (hook in
// workflow.js), so this sweep only refreshes the windowed badges.
try {
  const r = await computeRollingBadges();
  console.log(`Badge sweep: ${r.creditedResolutions} credited resolutions, ${r.eligibleStaff} eligible staff`);
} catch (e) {
  console.error('Initial badge sweep failed:', e.message);
}
setInterval(() => {
  computeRollingBadges().catch(e => console.error('Badge sweep failed:', e.message));
}, 7 * 24 * 60 * 60 * 1000); // weekly

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Nagorik Sheba API listening on http://localhost:${PORT}`);
});
