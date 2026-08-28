import { Router } from 'express';
import { db } from '../db.js';
import { haversineMeters } from '../utils/geo.js';

const router = Router();

// Public - no login required: find emergency services near me
router.get('/nearby', (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const radius = Math.min(parseFloat(req.query.radius) || 15000, 50000);
  const type = req.query.type;

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ error: 'lat and lng query parameters are required' });
  }

  let rows = db.prepare('SELECT * FROM emergency_services').all();
  if (type && type !== 'all') rows = rows.filter((r) => r.type === type);

  rows = rows
    .map((r) => ({ ...r, distance_m: Math.round(haversineMeters(lat, lng, r.latitude, r.longitude)) }))
    .filter((r) => r.distance_m <= radius)
    .sort((a, b) => a.distance_m - b.distance_m)
    .slice(0, 25);

  res.json({ services: rows });
});

router.get('/types', (_req, res) => {
  const types = [
    { key: 'fire_service', label: 'Fire Service' },
    { key: 'police_station', label: 'Police Station' },
    { key: 'wasa', label: 'WASA' },
    { key: 'lged', label: 'LGED' },
    { key: 'desa', label: 'DESA' },
    { key: 'titas_gas', label: 'Titas Gas' },
    { key: 'public_toilet', label: 'Public Toilet' }
  ];
  res.json({ types });
});

export default router;
