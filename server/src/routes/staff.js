/**
 * Staff achievement badge endpoints.
 *
 * Visibility rules (positive-only, authority-scoped):
 *   - A staff member can see their own badges and recognitions.
 *   - Staff can see the badge roster of their OWN authority only
 *     (req.auth.authority_id from the JWT — never a URL parameter).
 *   - The mayor/chairman sees the full team roster of their authority and is
 *     the only role that can issue a Mayor's Commendation.
 *   - Badge data is never exposed on public endpoints — citizens cannot see
 *     staff badges, and no badge ranks or "worst performer" lists exist.
 */

import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireStaff, requireMayor } from '../middleware/auth.js';

const router = Router();

/* ------------------------- Mayor's Commendation ------------------------- */

/**
 * POST /api/staff/:staffId/recognize
 * Mayor-only. The target must be a staff member of the mayor's OWN authority
 * (cross-authority attempts are rejected). A short positive note is required.
 */
router.post('/:staffId/recognize', requireAuth, requireMayor, async (req, res) => {
  const targetId = parseInt(req.params.staffId, 10);
  if (!Number.isInteger(targetId)) {
    return res.status(400).json({ error: 'Invalid staff id' });
  }
  const note = (req.body?.note || '').toString().trim();
  if (!note) return res.status(400).json({ error: 'A short note is required' });
  if (note.length > 300) return res.status(400).json({ error: 'Note must be 300 characters or fewer' });

  const target = await db.prepare('SELECT staff_id, full_name, authority_id FROM staff WHERE staff_id = ?').get(targetId);
  if (!target) return res.status(404).json({ error: 'Staff member not found' });

  // Authority scoping: the mayor may only commend within their own office.
  if (target.authority_id !== req.auth.authority_id) {
    return res.status(403).json({ error: 'You can only commend staff in your own authority' });
  }
  // A mayor commending themselves would be odd; keep it to other staff.
  if (target.staff_id === req.auth.id) {
    return res.status(400).json({ error: 'You cannot commend yourself' });
  }

  const info = await db.prepare(
    `INSERT INTO staff_recognitions (staff_id, awarded_by, note)
     VALUES (?, ?, ?)`
  ).run(target.staff_id, req.auth.id, note);

  const recognition = await db.prepare(
    `SELECT r.recognition_id, r.staff_id, r.note, r.awarded_at,
            s.full_name AS awarded_by_name
       FROM staff_recognitions r JOIN staff s ON s.staff_id = r.awarded_by
      WHERE r.recognition_id = ?`
  ).get(info.lastInsertRowid);

  res.status(201).json(recognition);
});

/* ----------------------------- Badge reads ----------------------------- */

/** Badge rows for one staff member, newest first. */
async function badgesFor(staffId) {
  return await db.prepare(
    `SELECT badge_id, staff_id, badge_type, tier, awarded_at, period_start, period_end
       FROM staff_badges
      WHERE staff_id = ?
      ORDER BY
        CASE badge_type
          WHEN 'volume' THEN 1 WHEN 'satisfaction' THEN 2 WHEN 'sla' THEN 3
          WHEN 'accuracy' THEN 4 ELSE 5
        END,
        CASE WHEN tier IS NULL THEN 2 ELSE 1 END,
        awarded_at DESC`
  ).all(staffId);
}

/** Recognitions received by one staff member, newest first. */
async function recognitionsFor(staffId) {
  return await db.prepare(
    `SELECT r.recognition_id, r.staff_id, r.note, r.awarded_at,
            s.full_name AS awarded_by_name
       FROM staff_recognitions r
       JOIN staff s ON s.staff_id = r.awarded_by
      WHERE r.staff_id = ?
      ORDER BY r.awarded_at DESC`
  ).all(staffId);
}

/**
 * GET /api/staff/badges — the caller's own badges + commendations.
 * Any staff role (including mayor) may read their own.
 */
router.get('/badges', requireAuth, requireStaff, async (req, res) => {
  res.json({
    badges: await badgesFor(req.auth.id),
    recognitions: await recognitionsFor(req.auth.id)
  });
});

/**
 * GET /api/staff/team/badges — team roster with badges, scoped to the
 * caller's own authority. Mayors see the full roster; other roles see their
 * teammates' badges (badges are visible within the authority, never publicly).
 * The mayor role is excluded from the roster itself: it is approval-only and
 * can never hold a badge, so a mayor viewing the page sees only their
 * junior / senior / WIT / field staff — never their own badge-less row.
 */
router.get('/team/badges', requireAuth, requireStaff, async (req, res) => {
  const rows = await db.prepare(
    `SELECT s.staff_id, s.full_name, s.staff_role, s.department,
            (SELECT COUNT(*) FROM staff_badges b WHERE b.staff_id = s.staff_id) AS badge_count
       FROM staff s
      WHERE s.authority_id = ?
        AND s.staff_role != 'mayor'
      ORDER BY s.staff_role, s.full_name`
  ).all(req.auth.authority_id);

  const team = await Promise.all(rows.map(async (r) => ({
    ...r,
    badges: await badgesFor(r.staff_id),
    recognitions: await recognitionsFor(r.staff_id)
  })));

  res.json({ team });
});

/**
 * GET /api/staff/:staffId/badges — one teammate's badges. Restricted to the
 * caller's own authority so badges are never leaked across LGI boundaries.
 */
router.get('/:staffId/badges', requireAuth, requireStaff, async (req, res) => {
  const targetId = parseInt(req.params.staffId, 10);
  if (!Number.isInteger(targetId)) return res.status(400).json({ error: 'Invalid staff id' });

  const target = await db.prepare('SELECT staff_id, authority_id FROM staff WHERE staff_id = ?').get(targetId);
  if (!target) return res.status(404).json({ error: 'Staff member not found' });
  if (target.authority_id !== req.auth.authority_id) {
    return res.status(403).json({ error: 'Badge profiles are only visible within your authority' });
  }

  res.json({
    staff_id: target.staff_id,
    badges: await badgesFor(target.staff_id),
    recognitions: await recognitionsFor(target.staff_id)
  });
});

export default router;
