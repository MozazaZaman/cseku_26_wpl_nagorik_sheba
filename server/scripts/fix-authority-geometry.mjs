import 'dotenv/config';
import { db, closeDb } from '../src/db.js';
import { fixAuthorityGeometry } from '../src/utils/authorityGeometry.js';
import { agentRoute } from '../src/agents/pipeline.js';

await fixAuthorityGeometry();

const spots = [
  ['Gollamari/Khulna city', 22.8037, 89.551],
  ['Shahbagh/Dhaka', 23.7365, 90.3985],
  ['Savar Pouroshova', 23.858, 90.266],
  ['Ruhitpur Union', 23.674, 90.287]
];
for (const [label, lat, lng] of spots) {
  const holders = await db.prepare('SELECT COUNT(*) AS n FROM authorities WHERE ? BETWEEN min_lat AND max_lat AND ? BETWEEN min_lng AND max_lng').get(lat, lng);
  const routed = await agentRoute(lat, lng);
  console.log(`${label} (${lat},${lng}): ${holders.n} box(es) contain it -> ${routed.authority_id}:${routed.name} [${routed.type}]`);
}
await closeDb();
process.exit(0);
