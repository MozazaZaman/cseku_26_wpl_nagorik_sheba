import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDb, db } from './db.js';
import authRoutes from './routes/auth.js';
import complaintRoutes from './routes/complaints.js';
import serviceRoutes from './routes/services.js';
import { requireAuth } from './middleware/auth.js';
import { initFaceEngine } from './agents/faceEngine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use('/geo', express.static(path.join(__dirname, '..', '..', 'uploads')));

initDb();
initFaceEngine();

function cleanupOldNotifications() {
  const r = db.prepare("DELETE FROM notifications WHERE created_at < datetime('now', '-90 day')").run();
  if (r.changes > 0) console.log(`Auto-deleted ${r.changes} notification(s) older than 90 days`);
}

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'nagorik-sheba-api' }));

app.get('/api/stats', (_req, res) => {
  const count = (sql) => db.prepare(sql).get().n;
  res.json({
    complaints_total: count("SELECT COUNT(*) n FROM complaints WHERE status != 'merged'"),
    resolved: count("SELECT COUNT(*) n FROM complaints WHERE status = 'resolved'"),
    in_process: count("SELECT COUNT(*) n FROM complaints WHERE status = 'in_process'"),
    citizens: count('SELECT COUNT(*) n FROM users'),
    votes: count('SELECT COALESCE(SUM(vote_count),0) n FROM complaints'),
    authorities: count('SELECT COUNT(*) n FROM authorities')
  });
});

app.get('/api/geo', (_req, res) => {
  const geo = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'bd-geo.json'), 'utf-8'));
  res.json(geo);
});

// Server-side geocoding proxy (Nominatim requires an identifying User-Agent,
// which browsers cannot send - so the web/mobile apps route through us).
const geoCache = new Map();
const GEO_TTL = 24 * 60 * 60 * 1000;

app.get('/api/geocode', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'q parameter required' });

  const cached = geoCache.get(q);
  if (cached && Date.now() - cached.at < GEO_TTL) {
    return res.json(cached.result);
  }

  let result = { found: false, source: 'none' };
  try {
    const googleKey = process.env.GOOGLE_GEOCODE_KEY;
    if (googleKey) {
      const r = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?region=bd&key=${googleKey}&address=${encodeURIComponent(q)}`
      );
      const j = await r.json();
      if (j.status === 'OK' && j.results?.length) {
        result = {
          found: true, source: 'Google',
          lat: j.results[0].geometry.location.lat,
          lng: j.results[0].geometry.location.lng
        };
      }
    } else {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=bd&q=${encodeURIComponent(q)}`,
        { headers: { 'User-Agent': 'NagorikSheba/1.0 (student civic-tech project)' } }
      );
      if (r.ok) {
        const list = await r.json();
        if (list.length > 0) {
          result = { found: true, source: 'OpenStreetMap', lat: parseFloat(list[0].lat), lng: parseFloat(list[0].lon) };
        }
      } else {
        console.log(`Geocode upstream ${r.status} for: ${q.slice(0, 60)}`);
      }
    }
  } catch (e) {
    console.log('Geocode error:', e.message);
  }

  geoCache.set(q, { at: Date.now(), result });
  res.json(result);
});

app.get('/api/authorities', (req, res) => {
  const { division, district, type, upazila } = req.query;
  let sql = `SELECT a.*, (SELECT COUNT(*) FROM complaints c WHERE c.authority_id = a.authority_id) AS complaint_count
             FROM authorities a WHERE 1=1`;
  const args = [];
  if (division) { sql += ' AND a.division = ?'; args.push(division); }
  if (district) { sql += ' AND a.district = ?'; args.push(district); }
  if (type) { sql += ' AND a.type = ?'; args.push(type); }
  if (upazila) { sql += ' AND a.upazila = ?'; args.push(upazila); }
  sql += ' ORDER BY a.name';
  res.json({ authorities: db.prepare(sql).all(...args) });
});

app.get('/api/authorities/types', (req, res) => {
  const { district } = req.query;
  if (!district) return res.json({ types: [] });
  const types = db.prepare(
    'SELECT DISTINCT type FROM authorities WHERE district = ?'
  ).all(district).map(r => r.type);
  res.json({ types });
});

app.get('/api/authorities/upazilas', (req, res) => {
  const { district } = req.query;
  if (!district) return res.json({ upazilas: [] });
  const rows = db.prepare(
    "SELECT DISTINCT upazila FROM authorities WHERE district = ? AND type='UNION_PARISHAD' AND upazila IS NOT NULL ORDER BY upazila"
  ).all(district);
  res.json({ upazilas: rows.map(r=>r.upazila) });
});

// Direct JSON access for Report page (uses bangladesh_local_government_units.json)
app.get('/api/lg/units', (req, res) => {
  try {
    const p = path.join(__dirname, '..', '..', 'uploads', 'bangladesh_local_government_units.json');
    const j = JSON.parse(fs.readFileSync(p, 'utf-8'));
    res.json(j);
  } catch(e){ res.status(500).json({error:'LG file not found'}); }
});

// Emergency services: osmium extracts are seeded into DB; this reverse proxy gives accurate nearby addresses via public Nominatim (English for district matching)
const reverseCache = new Map();
app.get('/api/reverse', async (req, res) => {
  const lat = parseFloat(req.query.lat), lng = parseFloat(req.query.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return res.status(400).json({error:'lat/lng required'});
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const hit = reverseCache.get(key);
  if (hit && Date.now() - hit.at < 24*60*60*1000) return res.json(hit.data);
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=en`, {headers:{'User-Agent':'NagorikSheba/1.0 (emergency osmium+Nominatim)'}});
    if (!r.ok) return res.json({found:false});
    const j = await r.json();
    const data = {found:true, display_name: j.display_name, address: j.address, source:'OpenStreetMap'};
    reverseCache.set(key,{at:Date.now(), data});
    res.json(data);
  } catch(e){ res.json({found:false}); }
});

app.get('/api/my/notifications', requireAuth, (req, res) => {
  cleanupOldNotifications();
  const rows = req.auth.role === 'staff'
    ? db.prepare(
        `SELECT n.* FROM notifications n
         JOIN complaints c ON c.complaint_id = n.complaint_id
         WHERE c.authority_id = ? ORDER BY n.created_at DESC LIMIT 50`
      ).all(req.auth.authority_id)
    : db.prepare(
        'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
      ).all(req.auth.id);
  res.json({ notifications: rows });
});

app.patch('/api/my/notifications/read-all', requireAuth, (req, res) => {
  if (req.auth.role === 'citizen') {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.auth.id);
  }
  res.json({ ok: true });
});

app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/services', serviceRoutes);

// Serve the built web app (production single-service deployment)
const distDir = path.join(__dirname, '..', '..', 'web', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^\/(?!api|uploads).*/, (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

cleanupOldNotifications();
setInterval(cleanupOldNotifications, 24 * 60 * 60 * 1000);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Nagorik Sheba API listening on http://localhost:${PORT}`);
});
