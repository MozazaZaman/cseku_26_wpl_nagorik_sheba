// Check who owns complaint #1, and test the tool path as that owner.
import 'dotenv/config';
import { db } from '../src/db.js';

const owner = await db.prepare('SELECT c.complaint_id, c.user_id, u.email, u.full_name FROM complaints c JOIN users u ON u.user_id = c.user_id WHERE c.complaint_id = 1').get();
console.log('complaint #1 owner:', JSON.stringify(owner));

const rahim = await db.prepare('SELECT user_id, email, full_name FROM users WHERE email = ?').get('rahim@example.com');
const karima = await db.prepare('SELECT user_id, email, full_name FROM users WHERE email = ?').get('karima@example.com');
console.log('rahim:', JSON.stringify(rahim));
console.log('karima:', JSON.stringify(karima));
console.log('karima owns:', (await db.prepare('SELECT COUNT(*) AS n FROM complaints WHERE user_id = ?').get(karima.user_id)).n, 'complaints');

process.exit(0);
