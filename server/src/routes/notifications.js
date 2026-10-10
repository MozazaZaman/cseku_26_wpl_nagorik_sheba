import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

async function cleanupOldNotifications() {
  await db.prepare("DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '90 days'").run();
}

function recipientTypeFor(auth) {
  return auth.role === 'staff' ? 'staff' : 'citizen';
}

async function notificationsFor(auth) {
  const recipientType = recipientTypeFor(auth);
  return await db.prepare(
    `SELECT notification_id, user_id, recipient_type, complaint_id, type, title, message, is_read, created_at
     FROM notifications
     WHERE user_id = ? AND recipient_type = ?
     ORDER BY created_at DESC LIMIT 50`
  ).all(auth.id, recipientType);
}

async function unreadCountFor(auth) {
  const recipientType = recipientTypeFor(auth);
  return (await db.prepare(
    `SELECT COUNT(*) AS unread_count
     FROM notifications
     WHERE user_id = ? AND recipient_type = ? AND is_read = 0`
  ).get(auth.id, recipientType)).unread_count;
}

router.get('/', requireAuth, async (req, res) => {
  await cleanupOldNotifications();
  res.json({
    notifications: await notificationsFor(req.auth),
    unread_count: await unreadCountFor(req.auth)
  });
});

router.get('/unread-count', requireAuth, async (req, res) => {
  res.json({ unread_count: await unreadCountFor(req.auth) });
});

router.patch('/:id/read', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid notification id' });
  }

  const recipientType = recipientTypeFor(req.auth);
  const existing = await db.prepare(
    `SELECT notification_id, user_id, recipient_type, complaint_id, type, title, message, is_read, created_at
     FROM notifications
     WHERE notification_id = ? AND user_id = ? AND recipient_type = ?`
  ).get(id, req.auth.id, recipientType);

  if (!existing) {
    return res.status(404).json({ error: 'Notification not found' });
  }

  await db.prepare('UPDATE notifications SET is_read = 1 WHERE notification_id = ?').run(id);
  res.json({ ok: true, notification: { ...existing, is_read: 1 } });
});

router.patch('/read-all', requireAuth, async (req, res) => {
  const recipientType = recipientTypeFor(req.auth);
  await db.prepare(
    'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND recipient_type = ?'
  ).run(req.auth.id, recipientType);
  res.json({ ok: true, unread_count: 0 });
});

// Registered BEFORE /:id so Express matches the literal path first
// (otherwise "clear-all" would be captured as an :id param).
router.delete('/clear-all', requireAuth, async (req, res) => {
  const recipientType = recipientTypeFor(req.auth);
  await db.prepare(
    'DELETE FROM notifications WHERE user_id = ? AND recipient_type = ?'
  ).run(req.auth.id, recipientType);
  res.json({ ok: true, unread_count: 0 });
});

// Hard delete, scoped to the authenticated user's own notifications.
// The WHERE clause carries user_id + recipient_type so a guessed id from
// another user's account is never touched; a 404 covers both "missing" and
// "not yours" to avoid id enumeration.
router.delete('/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid notification id' });
  }

  const recipientType = recipientTypeFor(req.auth);
  const result = await db.prepare(
    'DELETE FROM notifications WHERE notification_id = ? AND user_id = ? AND recipient_type = ?'
  ).run(id, req.auth.id, recipientType);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Notification not found' });
  }

  res.json({ ok: true, unread_count: await unreadCountFor(req.auth) });
});

export default router;
