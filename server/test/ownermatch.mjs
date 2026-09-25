// Verify the tool returns complaint #1 for its owner, then test the live route.
import 'dotenv/config';
import { db } from '../src/db.js';

function myComplaintStatus(authId, complaintId) {
  const params = [authId];
  let sql = `SELECT c.complaint_id, c.title, c.category, c.status, c.created_at AS submitted_at, c.updated_at,
    (SELECT sh.changed_at FROM status_history sh WHERE sh.complaint_id = c.complaint_id ORDER BY sh.changed_at DESC LIMIT 1) AS last_trail_at
    FROM complaints c WHERE c.user_id = ?`;
  if (complaintId) { sql += ' AND c.complaint_id = ?'; params.push(complaintId); }
  sql += ' ORDER BY c.created_at DESC LIMIT 20';
  return db.prepare(sql).all(...params);
}

const rows = myComplaintStatus(1, 1);
console.log('tool query for (user 1, complaint 1) ->', rows.length, 'row(s)');
console.log(JSON.stringify(rows, null, 2));

process.exit(0);
