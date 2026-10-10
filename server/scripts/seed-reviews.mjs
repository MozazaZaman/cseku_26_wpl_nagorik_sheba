/**
 * Citizen feedback backfill — one-time enrichment script.
 *
 * Walks every resolved complaint that has no satisfaction rating yet and gives
 * it a realistic citizen review: a rating on the 1-5 emoji scale (weighted so
 * most resolutions are rated positively, a few poor ones slip through) plus an
 * optional comment (roughly 7 in 10 get one).
 *
 * This populates:
 *   - the mayor/chairman "Public Reviews" page (resolved work + feedback)
 *   - the mayor satisfaction dashboard aggregates
 *   - the public per-authority satisfaction number (once past the threshold)
 *
 * Safe to re-run: only touches rows where satisfaction_score IS NULL, so it
 * never overwrites feedback a real citizen already submitted.
 */
import 'dotenv/config';
import { db, closeDb } from '../src/db.js';

// Weighted rating distribution: most resolutions go well, a minority don't.
// 5★ 34% · 4★ 27% · 3★ 18% · 2★ 12% · 1★ 9%
function weightedRating() {
  const roll = Math.random();
  if (roll < 0.34) return 5;
  if (roll < 0.61) return 4;
  if (roll < 0.79) return 3;
  if (roll < 0.91) return 2;
  return 1;
}

const COMMENT_BANK = {
  5: [
    'Work was done quickly and properly. Very happy with the service.',
    'Excellent work — the problem is completely gone now.',
    'Very satisfied. The crew was professional and finished on time.',
    'Fixed within a day, could not ask for more.'
  ],
  4: [
    'Good work overall, though it took a little longer than promised.',
    'Solved properly, just wish the communication had been better.',
    'Happy with the result. Minor delays but the job is done.',
    'Solid work. The area is usable again.'
  ],
  3: [
    'It is fixed, but the finish could have been cleaner.',
    'Average experience. Done eventually, had to follow up once.',
    'Problem solved for now, let us see how it holds up.',
    'Acceptable work, nothing exceptional.'
  ],
  2: [
    'Had to report twice before anyone came. Poorly done.',
    'Took far too long and the fix feels temporary.',
    'Not satisfied. The work was rushed and messy.',
    'Only partially fixed, still not happy with it.'
  ],
  1: [
    'Nothing changed. Total waste of time reporting this.',
    'Worst experience — no one even came to look.',
    'The problem is still there. Very disappointed.',
    'Unacceptable. I would not recommend this office.'
  ]
};

const sqliteDate = (d) => {
  const p = (v) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

const pending = await db.prepare(
  `SELECT complaint_id, resolved_at, satisfaction_score
   FROM complaints
   WHERE status = 'resolved' AND satisfaction_score IS NULL
   ORDER BY complaint_id`
).all();

if (pending.length === 0) {
  console.log('Every resolved complaint already has citizen feedback — nothing to do.');
  process.exit(0);
}

const upd = db.prepare(
  `UPDATE complaints
      SET satisfaction_score = ?,
          satisfaction_comment = ?,
          satisfaction_submitted_at = ?,
          updated_at = NOW()
    WHERE complaint_id = ? AND satisfaction_score IS NULL`
);

let rated = 0, withComment = 0;
for (const c of pending) {
  const score = weightedRating();
  // ~70% of reviews carry a comment
  const comment = Math.random() < 0.7
    ? COMMENT_BANK[score][Math.floor(Math.random() * COMMENT_BANK[score].length)]
    : null;
  // Feedback lands a few hours to ~2 days after the resolution timestamp.
  const base = c.resolved_at ? new Date(c.resolved_at.replace(' ', 'T') + 'Z') : new Date();
  const at = new Date(base.getTime() + (3 + Math.random() * 40) * 3600000);
  await upd.run(score, comment, sqliteDate(at), c.complaint_id);
  rated++;
  if (comment) withComment++;
}

console.log(`Backfilled citizen feedback on ${rated} resolved complaint(s).`);
console.log(`  with comment: ${withComment} · comment-less: ${rated - withComment}`);

const byAuth = await db.prepare(
  `SELECT authority_id, COUNT(*) AS n, ROUND(AVG(satisfaction_score), 2) AS avg
   FROM complaints WHERE satisfaction_score IS NOT NULL
   GROUP BY authority_id HAVING COUNT(*) >= 5 ORDER BY n DESC`
).all();
console.log(`\nAuthorities now past the 5-rating public threshold: ${byAuth.length}`);
for (const a of byAuth.slice(0, 12)) {
  console.log(`  authority ${a.authority_id}: ${a.n} ratings, avg ${a.avg}`);
}

await closeDb();
process.exit(0);
