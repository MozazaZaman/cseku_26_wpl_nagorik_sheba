import 'dotenv/config';
import { db, closeDb } from '../src/db.js';

const rows = await db.prepare(
  `SELECT c.complaint_id, c.full_address, c.road, c.sector, c.ward, c.area_text,
          c.village, c.upazila, c.district, c.division, a.name AS aname
   FROM complaints c LEFT JOIN authorities a ON a.authority_id = c.authority_id
   WHERE c.full_address ILIKE '%Corporation%' OR c.full_address ILIKE '%Pourash%'
      OR c.full_address ILIKE '%Pouroshova%' OR c.full_address ILIKE '%Union Parishad%'`
).all();
let fixed = 0;
for (const r of rows) {
  const parts = [
    r.road && `Road ${r.road}`,
    r.sector,
    r.ward && `Ward ${r.ward}`,
    r.area_text,
    r.village,
    r.upazila,
    r.district,
    r.division,
    'Bangladesh'
  ].filter(Boolean);
  const next = parts.join(', ') || null;
  const clean = next && next !== 'Bangladesh' ? next : null;
  if (clean !== r.full_address) {
    await db.prepare('UPDATE complaints SET full_address = ? WHERE complaint_id = ?').run(clean, r.complaint_id);
    console.log(`#${r.complaint_id} [${r.aname}]: "${r.full_address}" -> "${clean}"`);
    fixed++;
  }
}
console.log(`Backfilled ${fixed}/${rows.length} rows`);
await closeDb();
process.exit(0);
