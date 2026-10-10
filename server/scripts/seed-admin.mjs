import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db, initDb } from '../src/db.js';

function arg(name) {
  const eq = process.argv.find((a) => a.startsWith(name + '='));
  if (eq) return eq.slice(name.length + 1);
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

const email = (arg('--email') || process.env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
const password = arg('--password') || process.env.SUPER_ADMIN_PASSWORD || '';
const name = (arg('--name') || 'Platform Administrator').trim();

if (!email || !email.includes('@') || !password || password.length < 8) {
  console.error('Usage: npm run seed:admin -- --email=admin@nagorik.bd --password=<8+ chars> [--name="..."]');
  console.error('   or set SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD env vars.');
  process.exit(1);
}

await initDb();
const existing = await db.prepare('SELECT user_id, role FROM users WHERE email = ?').get(email);
if (existing) {
  await db.prepare(`UPDATE users SET role = 'super_admin', is_system_admin = 1, full_name = ? WHERE user_id = ?`).run(name, existing.user_id);
  console.log(`Promoted ${email} to super_admin (user_id ${existing.user_id}).`);
} else {
  const hash = bcrypt.hashSync(password, 10);
  const info = await db.prepare(
    `INSERT INTO users (full_name, email, password_hash, role, is_system_admin) VALUES (?, ?, ?, 'super_admin', 1)`
  ).run(name, email, hash);
  console.log(`Created super_admin ${email} (user_id ${info.lastInsertRowid}).`);
}
process.exit(0);
