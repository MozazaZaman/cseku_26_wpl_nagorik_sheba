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
function cached(key, compute) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const value = compute();
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
function authorityMetrics(authorityId) {
  const totals = db.prepare(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) AS resolved,
            SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
            AVG(CASE WHEN status = 'resolved' THEN julianday(resolved_at) - julianday(created_at) END) AS avg_days
     FROM complaints WHERE authority_id = ? AND status != 'merged'`
  ).get(authorityId);

  // Aggregate citizen satisfaction — public number only (no comments here).
  const sat = db.prepare(
    `SELECT COUNT(*) AS n, AVG(satisfaction_score) AS avg_score
     FROM complaints
     WHERE authority_id = ? AND status != 'merged' AND satisfaction_score IS NOT NULL`
  ).get(authorityId);

  const byCategory = db.prepare(
    `SELECT category, COUNT(*) AS n,
            SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) AS resolved_n
     FROM complaints WHERE authority_id = ? AND status != 'merged'
     GROUP BY category ORDER BY n DESC`
  ).all(authorityId);

  // resolution trend: last 6 months, complaints resolved per month + avg days
  const trend = db.prepare(
    `SELECT strftime('%Y-%m', resolved_at) AS month,
            COUNT(*) AS resolved_n,
            AVG(julianday(resolved_at) - julianday(created_at)) AS avg_days
     FROM complaints
     WHERE authority_id = ? AND status = 'resolved' AND resolved_at >= datetime('now', '-6 months')
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
router.get('/authority/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const authority = db.prepare(
    'SELECT authority_id, name, type, district, division FROM authorities WHERE authority_id = ?'
  ).get(id);
  if (!authority) return res.status(404).json({ error: 'Authority not found' });

  const metrics = cached(`auth:${id}`, () => authorityMetrics(id));
  res.json({ authority, metrics });
});

/**
 * Nationwide leaderboard — rolling 90-day window, minimum 5 complaints to be
 * ranked (else "insufficient data"), composite score:
 *   score = resolution_rate(0-100) - avg_resolution_days x 2
 * Higher is better; sorts by score desc.
 */
router.get('/leaderboard', (req, res) => {
  const { division, district, window: winDays, min } = req.query;
  const days = Math.min(Math.max(parseInt(winDays) || 90, 7), 365);
  const minComplaints = Math.min(Math.max(parseInt(min) || 5, 1), 100);

    const key = `lb:${division || ''}:${district || ''}:${days}:${minComplaints}`;
    const result = cached(key, () => {
      let sql = `
        SELECT a.authority_id, a.name, a.type, a.district, a.division,
               COUNT(*) AS total,
               SUM(CASE WHEN c.status = 'resolved' THEN 1 ELSE 0 END) AS resolved,
               AVG(CASE WHEN c.status = 'resolved' THEN julianday(c.resolved_at) - julianday(c.created_at) END) AS avg_days,
               COUNT(c.satisfaction_score) AS sat_n,
               AVG(c.satisfaction_score) AS sat_avg
        FROM complaints c
        JOIN authorities a ON a.authority_id = c.authority_id
        WHERE c.status != 'merged' AND c.created_at > datetime('now', ?)`;
      const args = [`-${days} days`];
      if (division) { sql += ' AND a.division = ?'; args.push(division); }
      if (district) { sql += ' AND a.district = ?'; args.push(district); }
      sql += ' GROUP BY a.authority_id';

      const rows = db.prepare(sql).all(...args);
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
    const divisionsWithData = db.prepare(
      `SELECT DISTINCT division FROM authorities
       WHERE authority_id IN (SELECT DISTINCT authority_id FROM complaints) ORDER BY division`
    ).all().map((r) => r.division).filter(Boolean);

    return { window_days: days, min_complaints: minComplaints, ranked, insufficient, divisions: divisionsWithData };
  });
  res.json(result);
});

// GPS points for the density heatmap (public browse data, just lat/lng+heat)
router.get('/heatmap-points', (_req, res) => {
  const points = cached('heatpoints', () =>
    db.prepare(
      `SELECT latitude, longitude, priority_score FROM complaints
       WHERE status NOT IN ('merged','rejected') AND created_at > datetime('now', '-180 days')`
    ).all()
  );
  res.json({ points });
});

export default router;
