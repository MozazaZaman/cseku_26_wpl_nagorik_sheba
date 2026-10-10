import { Router } from 'express';
import { db } from '../db.js';

/**
 * Public analytics — per-authority performance + nationwide leaderboard.
 *
 * All read-only aggregations over existing data. Cached in-memory with a
 * short TTL so bursts of page loads don't re-aggregate (SQLite is fast
 * anyway; this is a courtesy cache).
 */

const router = Router();

const TTL_MS = 5 * 60 * 1000;
const cache = new Map();
async function cached(key, compute) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const value = await compute();
  cache.set(key, { at: Date.now(), value });
  return value;
}

const DIVISIONS = ['Dhaka', 'Chattogram', 'Khulna', 'Rajshahi', 'Sylhet', 'Barishal', 'Rangpur', 'Mymensingh'];

// A satisfaction average is only meaningful with enough ratings behind it.
// Same idea as the leaderboard's minimum-complaint threshold: below this the
// public number stays hidden (null) instead of showing a 1-rating average.
const MIN_SATISFACTION_PUBLIC = 5;

/**
 * Aggregated performance metrics for one authority.
 * avg_resolution_days uses resolved_at - created_at (both real columns).
 */
async function authorityMetrics(authorityId) {
  const totals = await db.prepare(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) AS resolved,
            SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
            AVG(CASE WHEN status = 'resolved' THEN EXTRACT(EPOCH FROM (resolved_at - created_at))/86400.0 END) AS avg_days
     FROM complaints WHERE authority_id = ? AND status != 'merged'`
  ).get(authorityId);

  // Aggregate citizen satisfaction — public number only (no comments here).
  const sat = await db.prepare(
    `SELECT COUNT(*) AS n, AVG(satisfaction_score) AS avg_score
     FROM complaints
     WHERE authority_id = ? AND status != 'merged' AND satisfaction_score IS NOT NULL`
  ).get(authorityId);

  const byCategory = await db.prepare(
    `SELECT category, COUNT(*) AS n,
            SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) AS resolved_n
     FROM complaints WHERE authority_id = ? AND status != 'merged'
     GROUP BY category ORDER BY n DESC`
  ).all(authorityId);

  // resolution trend: last 6 months, complaints resolved per month + avg days
  const trend = await db.prepare(
    `SELECT TO_CHAR(resolved_at, 'YYYY-MM') AS month,
            COUNT(*) AS resolved_n,
            AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/86400.0) AS avg_days
     FROM complaints
     WHERE authority_id = ? AND status = 'resolved' AND resolved_at >= NOW() - INTERVAL '6 months'
     GROUP BY month ORDER BY month ASC`
  ).all(authorityId);

  const total = totals.total || 0;
  return {
    total_complaints: total,
    resolved: totals.resolved || 0,
    rejected: totals.rejected || 0,
    resolution_rate: total ? Math.round((totals.resolved / total) * 1000) / 10 : 0,
    rejection_rate: total ? Math.round((totals.rejected / total) * 1000) / 10 : 0,
    avg_resolution_days: totals.avg_days ? Math.round(totals.avg_days * 10) / 10 : null,
    // Public aggregate only; hidden until enough ratings exist to be meaningful
    avg_satisfaction: sat.n >= MIN_SATISFACTION_PUBLIC && sat.avg_score != null
      ? Math.round(sat.avg_score * 10) / 10
      : null,
    satisfaction_count: sat.n || 0,
    volume_by_category: byCategory.map((r) => ({
      category: r.category,
      total: r.n,
      resolved: r.resolved_n,
      resolution_rate: r.n ? Math.round((r.resolved_n / r.n) * 1000) / 10 : 0
    })),
    trend
  };
}

// Per-authority analytics — public (transparency: any citizen can see how
// their office is performing).
router.get('/authority/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const authority = await db.prepare(
    'SELECT authority_id, name, type, district, division FROM authorities WHERE authority_id = ?'
  ).get(id);
  if (!authority) return res.status(404).json({ error: 'Authority not found' });

  const metrics = await cached(`auth:${id}`, () => authorityMetrics(id));
  res.json({ authority, metrics });
});

/**
 * Nationwide leaderboard — rolling 90-day window, minimum 5 complaints to be
 * ranked (else "insufficient data"), composite score:
 *   score = resolution_rate(0-100) - avg_resolution_days x 2
 * Higher is better; sorts by score desc.
 */
router.get('/leaderboard', async (req, res) => {
  const { division, district, window: winDays, min } = req.query;
  const days = Math.min(Math.max(parseInt(winDays) || 90, 7), 365);
  const minComplaints = Math.min(Math.max(parseInt(min) || 5, 1), 100);

    const key = `lb:${division || ''}:${district || ''}:${days}:${minComplaints}`;
    const result = await cached(key, async () => {
      let sql = `
        SELECT a.authority_id, a.name, a.type, a.district, a.division,
               COUNT(*) AS total,
               SUM(CASE WHEN c.status = 'resolved' THEN 1 ELSE 0 END) AS resolved,
               AVG(CASE WHEN c.status = 'resolved' THEN EXTRACT(EPOCH FROM (c.resolved_at - c.created_at))/86400.0 END) AS avg_days,
               COUNT(c.satisfaction_score) AS sat_n,
               AVG(c.satisfaction_score) AS sat_avg
        FROM complaints c
        JOIN authorities a ON a.authority_id = c.authority_id
        WHERE c.status != 'merged' AND c.created_at > NOW() + ($1)::interval`;
      const args = [`-${days} days`];
      if (division) { sql += ` AND a.division = $${args.length + 1}`; args.push(division); }
      if (district) { sql += ` AND a.district = $${args.length + 1}`; args.push(district); }
      sql += ' GROUP BY a.authority_id';

      const rows = await db.prepare(sql).all(...args);
      const ranked = [];
      const insufficient = [];
      for (const r of rows) {
        const rate = r.total ? (r.resolved / r.total) * 100 : 0;
        const avgDays = r.avg_days ? Math.round(r.avg_days * 10) / 10 : null;
        // Same minimum threshold as the ranking itself: don't publish a
        // satisfaction average built on too few ratings.
        const avgSat = r.sat_n >= minComplaints && r.sat_avg != null
          ? Math.round(r.sat_avg * 10) / 10
          : null;
        const entry = {
          authority_id: r.authority_id,
          name: r.name,
          type: r.type,
          district: r.district,
          division: r.division,
          total_complaints: r.total,
          resolved: r.resolved,
          resolution_rate: Math.round(rate * 10) / 10,
          avg_resolution_days: avgDays,
          avg_satisfaction: avgSat,
          satisfaction_count: r.sat_n || 0,
          score: avgDays != null ? Math.round((rate - avgDays * 2) * 10) / 10 : null
        };
        if (r.total >= minComplaints) ranked.push(entry);
        else insufficient.push(entry);
      }
    ranked.sort((x, y) => (y.score ?? -999) - (x.score ?? -999));
    insufficient.sort((x, y) => y.total_complaints - x.total_complaints);

    // divisions with data (for the filter dropdown)
    const divisionsWithData = (await db.prepare(
      `SELECT DISTINCT division FROM authorities
       WHERE authority_id IN (SELECT DISTINCT authority_id FROM complaints) ORDER BY division`
    ).all()).map((r) => r.division).filter(Boolean);

    return { window_days: days, min_complaints: minComplaints, ranked, insufficient, divisions: divisionsWithData };
  });
  res.json(result);
});

// GPS points for the density heatmap (public browse data, just lat/lng+heat)
router.get('/heatmap-points', async (_req, res) => {
  const points = await cached('heatpoints', async () =>
    await db.prepare(
      `SELECT latitude, longitude, priority_score FROM complaints
       WHERE status NOT IN ('merged','rejected') AND created_at > NOW() - INTERVAL '180 days'`
    ).all()
  );
  res.json({ points });
});

// Monthly reported-vs-solved per category + hottest place per category.
// Powers the "Analysis Issues" page (citizens see the whole country;
// staff default to their own authority and can switch to overall or a
// custom division/district). All aggregates — no personal data.
const TREND_CATEGORIES = ['road', 'electricity', 'water', 'gas', 'sanitation',
  'encroachment', 'environment', 'public_assets', 'animals', 'markets', 'drugs', 'other'];

router.get('/category-trends', async (req, res) => {
  const months = Math.min(Math.max(parseInt(req.query.months) || 12, 3), 24);
  const authorityId = parseInt(req.query.authority_id) || null;
  const division = (req.query.division || '').trim() || null;
  const district = (req.query.district || '').trim() || null;

  let filter = `status != 'merged'`;
  const args = [];
  if (authorityId) { filter += ' AND authority_id = ?'; args.push(authorityId); }
  if (division) { filter += ' AND division = ?'; args.push(division); }
  if (district) { filter += ' AND district = ?'; args.push(district); }

  // Month buckets, oldest -> newest, e.g. [{key:'2025-11', label:'Nov 25'}]
  const monthKeys = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('en', { month: 'short' }) + ' ' + String(d.getFullYear()).slice(2);
    monthKeys.push({ key, label });
  }
  const startKey = monthKeys[0].key + '-01';

  const cacheKey = `trends:${months}:${authorityId || ''}:${division || ''}:${district || ''}`;
  const result = await cached(cacheKey, async () => {
    const reported = await db.prepare(
      `SELECT category, TO_CHAR(created_at, 'YYYY-MM') AS m, COUNT(*) AS n
        FROM complaints WHERE ${filter} AND created_at >= ?
        GROUP BY category, m`
    ).all(...args, startKey);
    const solved = await db.prepare(
      `SELECT category, TO_CHAR(resolved_at, 'YYYY-MM') AS m, COUNT(*) AS n
        FROM complaints WHERE ${filter} AND status = 'resolved' AND resolved_at >= ?
        GROUP BY category, m`
    ).all(...args, startKey);
    const places = await db.prepare(
      `SELECT category, district, division, COUNT(*) AS n
        FROM complaints WHERE ${filter} AND district IS NOT NULL
        GROUP BY category, district, division`
    ).all(...args);

    const repMap = new Map(), solMap = new Map();
    for (const r of reported) repMap.set(`${r.category}|${r.m}`, r.n);
    for (const r of solved) solMap.set(`${r.category}|${r.m}`, r.n);

    const categories = TREND_CATEGORIES.map((cat) => {
      const rep = monthKeys.map(({ key }) => repMap.get(`${cat}|${key}`) || 0);
      const sol = monthKeys.map(({ key }) => solMap.get(`${cat}|${key}`) || 0);
      const totalReported = rep.reduce((a, b) => a + b, 0);
      const totalSolved = sol.reduce((a, b) => a + b, 0);
      return {
        key: cat, reported: rep, solved: sol,
        total_reported: totalReported, total_solved: totalSolved,
        resolution_rate: totalReported ? Math.round((totalSolved / totalReported) * 1000) / 10 : 0
      };
    });

    const topPlaces = TREND_CATEGORIES.map((cat) => {
      let best = null;
      for (const p of places) {
        if (p.category !== cat) continue;
        if (!best || p.n > best.count) {
          best = { category: cat, district: p.district, division: p.division, count: p.n };
        }
      }
      return best || { category: cat, district: null, division: null, count: 0 };
    });

    return { months: monthKeys, categories, top_places: topPlaces };
  });

  res.json({
    scope: {
      authority_id: authorityId, division, district,
      overall: !authorityId && !division && !district
    },
    ...result
  });
});

export default router;
