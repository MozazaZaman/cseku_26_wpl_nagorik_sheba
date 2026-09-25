/**
 * Leaderboard demo spread — one-time enrichment script.
 *
 * Adds ~90 historical complaints across 24 authorities (every division) with
 * realistic performance profiles: some offices resolve fast (top of the
 * leaderboard), some slow, some mid. Mix of resolved (majority), a few
 * rejected and a few still in the pipeline, all inside the last 80 days so
 * the rolling 90-day leaderboard window catches them.
 *
 * Safe to re-run: it marks seeded rows via a notifications marker and skips
 * if already applied. Does NOT touch existing demo complaints.
 */
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, '..', 'data', 'nagorik.db'));
db.pragma('journal_mode = WAL');

const already = db.prepare(
  `SELECT 1 FROM notifications WHERE title = '__leaderboard_seed__' LIMIT 1`
).get();
if (already) {
  console.log('Leaderboard spread already applied — skipping.');
  process.exit(0);
}

// ---------- demo citizens ----------
const hash = (p) => bcrypt.hashSync(p, 10);
const citHash = hash('password123');
const insUser = db.prepare('INSERT INTO users (full_name, email, phone, password_hash) VALUES (?, ?, ?, ?)');
const citizens = [
  ['Abdul Karim', 'karim.bd@example.com', '+8801710000101'],
  ['Sultana Razia', 'razia.bd@example.com', '+8801710000102'],
  ['Mizan Chowdhury', 'mizan.bd@example.com', '+8801710000103'],
  ['Nasrin Haque', 'nasrin.bd@example.com', '+8801710000104'],
  ['Joynal Abedin', 'joynal.bd@example.com', '+8801710000105'],
  ['Shirin Sultana', 'shirin.bd@example.com', '+8801710000106'],
  ['Rashedul Islam', 'rashed.bd@example.com', '+8801710000107'],
  ['Parul Akter', 'parul.bd@example.com', '+8801710000108']
];
const userIds = citizens.map((c) => {
  const existing = db.prepare('SELECT user_id FROM users WHERE email = ?').get(c[1]);
  if (existing) return existing.user_id;
  return insUser.run(...c, citHash).lastInsertRowid;
});

// ---------- target authorities (one per division region, mix of types) ----------
const TARGETS = [
  'Dhaka South City Corporation', 'Dhaka North City Corporation', 'Gazipur City Corporation',
  'Narayanganj City Corporation', 'Cumilla City Corporation', 'Chattogram City Corporation',
  'Khulna City Corporation', 'Rajshahi City Corporation', 'Sylhet City Corporation',
  'Barishal City Corporation', 'Rangpur City Corporation', 'Mymensingh City Corporation',
  'Savar Pourashava', 'Jashore Pourashava', 'Bogura Pourashava', 'Dinajpur Pourashava',
  "Cox's Bazar Pourashava", 'Moulvibazar Pourashava', 'Bhola Pourashava', 'Kushtia Pourashava',
  'Ruhitpur Union Parishad', 'Sagardari Union Parishad', 'Gowainghat Union Parishad', 'Dighalia Union Parishad'
];
const placeholders = TARGETS.map(() => '?').join(',');
const auths = db.prepare(
  `SELECT authority_id, name, type, district, division, center_lat, center_lng FROM authorities
   WHERE name IN (${placeholders})`
).all(...TARGETS);
console.log(`Seeding across ${auths.length} authorities...`);

// ---------- complaint material ----------
const TITLES = {
  road: ['Pothole on main road', 'Broken footpath tiles', 'Road cracked after rain', 'Damaged speed breaker', 'Erosion at road edge'],
  electricity: ['Street light not working', 'Electric pole leaning', 'Transformer sparking', 'Loose wires over footpath', 'Night darkness in lane'],
  water: ['Water logging on street', 'Tube well broken', 'Pipeline leakage', 'Dirty water supply', 'Drain overflow'],
  gas: ['Gas leakage smell', 'Illegal gas connection', 'Gas line pressure drop', 'Broken gas meter box'],
  sanitation: ['Garbage pile for days', 'Dustbin overflowing', 'Public toilet unclean', 'Drain blocked with waste', 'Open dumping spot'],
  other: ['Stray animal problem', 'Banner blocking view', 'Abandoned vehicle', 'Noise pollution']
};
const CATS = Object.keys(TITLES);
const rnd = (n) => Math.floor(Math.random() * n);
const jitter = (base, deg) => base + (Math.random() - 0.5) * deg;

// performance profile per authority index: [resolveDaysBase, resolveRate]
// top performers -> weak performers, so the leaderboard has a real ranking
const profiles = [
  [1.5, 0.95], [2, 0.92], [2.5, 0.9], [3, 0.88], [3.5, 0.85],
  [4, 0.82], [4.5, 0.8], [5, 0.78], [5.5, 0.75], [6, 0.72],
  [6.5, 0.7], [7, 0.68], [7.5, 0.65], [8, 0.62], [9, 0.6],
  [10, 0.58], [11, 0.55], [12, 0.52], [13, 0.5], [14, 0.48],
  [15, 0.45], [16, 0.42], [18, 0.4], [20, 0.38]
];

const insComplaint = db.prepare(
  `INSERT INTO complaints
     (user_id, authority_id, title, description, category, latitude, longitude, address_text,
      status, priority_score, vote_count, created_at, updated_at, resolved_at,
      division, district, full_address, current_stage, stage_owner_role, stage_entered_at, overdue_flag)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'execution', 'field', ?, 0)`
);

// Format a JS Date as SQLite datetime string ('YYYY-MM-DD HH:MM:SS', local)
const sqliteDate = (d) => {
  const p = (v) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};
const daysAgo = (n) => sqliteDate(new Date(Date.now() - n * 86400000));

let n = 0;
const seedAll = db.transaction(() => {
  auths.forEach((auth, ai) => {
    const [daysBase, rate] = profiles[ai % profiles.length];
    const lat = auth.center_lat || 23.7, lng = auth.center_lng || 90.4;
    const count = 4 + rnd(3); // 4-6 complaints each -> 24 auths * ~5 = ~110
    for (let k = 0; k < count; k++) {
      const cat = CATS[rnd(CATS.length)];
      const title = TITLES[cat][rnd(TITLES[cat].length)];
      const ageDays = -rnd(75) - 2;             // within window
      const roll = Math.random();
      let status, resolveDaysAfter;
      if (roll < rate) {                         // resolved
        const d = Math.max(0.5, jitter(daysBase, 2));
        status = 'resolved';
        resolveDaysAfter = d;
      } else if (roll < rate + 0.12) {           // rejected
        status = 'rejected';
        resolveDaysAfter = 0.5;
      } else {                                   // still in pipeline
        status = ['assigned', 'in_process', 'wit_review'][rnd(3)];
        resolveDaysAfter = null;
      }
      const createdOffset = Math.abs(ageDays);   // positive days ago
      insComplaint.run(
        userIds[rnd(userIds.length)], auth.authority_id,
        `${title} (${auth.district})`,
        `${title} reported by a local resident of ${auth.district}. Situation observed over several days before reporting to the authority.`,
        cat, jitter(lat, 0.05).toFixed(5), jitter(lng, 0.05).toFixed(5),
        `${auth.district} area`, status,
        (20 + rnd(60)).toFixed(1), rnd(25),
        daysAgo(createdOffset),                                  // created_at
        daysAgo(resolveDaysAfter != null ? Math.max(0, createdOffset - resolveDaysAfter) : 0), // updated_at
        resolveDaysAfter != null ? daysAgo(Math.max(0, createdOffset - resolveDaysAfter)) : null, // resolved_at
        auth.division, auth.district,
        `${title}, ${auth.name}, ${auth.district}, ${auth.division}, Bangladesh`,
        daysAgo(Math.max(0, createdOffset - (resolveDaysAfter ?? 0))) // stage_entered_at
      );
      n++;
    }
  });
  // marker so re-runs are no-ops
  db.prepare(
    `INSERT INTO notifications (user_id, recipient_type, title, message) VALUES (1, 'citizen', '__leaderboard_seed__', 'internal marker')`
  ).run();
});
seedAll();
console.log(`Seeded ${n} complaints across ${auths.length} authorities (leaderboard window=90d).`);
