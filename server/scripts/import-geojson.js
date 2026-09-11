import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..', '..');
const dbPath = path.join(__dirname, '..', 'data', 'nagorik.db');
const uploadsDir = path.join(projectRoot, 'uploads');

console.log('DB:', dbPath);
const db = new Database(dbPath);

// --- helpers ---
function pointInRing(point, ring) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInPolygon(point, polygon) {
  if (!polygon || polygon.length === 0) return false;
  if (!pointInRing(point, polygon[0])) return false;
  for (let i = 1; i < polygon.length; i++) {
    if (pointInRing(point, polygon[i])) return false;
  }
  return true;
}

function pointInFeature(point, feature) {
  const geom = feature.geometry;
  if (!geom) return false;
  if (geom.type === 'Polygon') return pointInPolygon(point, geom.coordinates);
  if (geom.type === 'MultiPolygon') {
    for (const poly of geom.coordinates) {
      if (pointInPolygon(point, poly)) return true;
    }
  }
  return false;
}

function normalizeDistrict(n) {
  if (!n) return n;
  return n.replace(/ District$/i, '').trim();
}

function loadGeoJSON(fname) {
  const p = path.join(uploadsDir, fname);
  if (!fs.existsSync(p)) { console.log(`Missing ${fname}`); return null; }
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

// --- ensure emergency_services has district/division columns ---
const cols = db.prepare("PRAGMA table_info(emergency_services)").all().map(c => c.name);
if (!cols.includes('district')) { db.exec("ALTER TABLE emergency_services ADD COLUMN district TEXT"); console.log('Added district column'); }
if (!cols.includes('division')) { db.exec("ALTER TABLE emergency_services ADD COLUMN division TEXT"); console.log('Added division column'); }
if (!cols.includes('upazila')) { db.exec("ALTER TABLE emergency_services ADD COLUMN upazila TEXT"); console.log('Added upazila column'); }

// --- load admin polygons for inference ---
console.log('Loading admin boundaries...');
const divisions = loadGeoJSON('divisions.geojson');
const districts = loadGeoJSON('Districts.geojson');
const upazilas = loadGeoJSON('upazila.geojson');

function findAdmin(point, fc, nameKey) {
  if (!fc) return null;
  for (const f of fc.features) {
    if (pointInFeature(point, f)) {
      return f.properties[nameKey] || f.properties.name || f.properties['name:en'] || null;
    }
  }
  return null;
}

// --- load services.geojson and bd_toilets.geojson ---
const servicesPath = path.join(uploadsDir, 'services.geojson');
const toiletsPath = path.join(uploadsDir, 'bd_toilets.geojson');
if (!fs.existsSync(servicesPath)) {
  console.error('services.geojson not found at', servicesPath);
  process.exit(1);
}
const servicesData = JSON.parse(fs.readFileSync(servicesPath, 'utf-8'));
console.log(`Loaded services.geojson: ${servicesData.features.length} features`);

let toiletsData = null;
let toiletsExtra = 0;
if (fs.existsSync(toiletsPath)) {
  toiletsData = JSON.parse(fs.readFileSync(toiletsPath, 'utf-8'));
  console.log(`Loaded bd_toilets.geojson: ${toiletsData.features.length} features`);
}

const typeMap = {
  'toilets': { type: 'public_toilet', phone: '' },
  'police': { type: 'police_station', phone: '999' },
  'fire_station': { type: 'fire_service', phone: '102' },
};

let imported = 0, skipped = 0, inferred = 0, deduped = 0;

// Deduplication for toilets: use a Map keyed by rounded coordinates + type
const seen = new Map();
function dedupKey(lat, lon) {
  return `${lat.toFixed(4)},${lon.toFixed(4)}`;
}

const tx = db.transaction(() => {
  db.exec('DELETE FROM emergency_services');
  try { db.exec("DELETE FROM sqlite_sequence WHERE name='emergency_services'"); } catch {}

  const stmt = db.prepare(
    'INSERT INTO emergency_services (name, type, phone, address, latitude, longitude, district, division, upazila) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );

  function insertFeature(feat, source) {
    const props = feat.properties || {};
    const tags = props.tags || {};
    const geom = feat.geometry;
    if (!geom || geom.type !== 'Point' || !geom.coordinates) { skipped++; return; }

    let amenity = props.amenity || tags.amenity;
    let info = null;
    if (amenity && typeMap[amenity]) {
      info = typeMap[amenity];
    } else if (props.office === 'water_utility' || tags.office === 'water_utility') {
      info = { type: 'wasa', phone: '+880-2-223355566' };
    } else {
      skipped++;
      return;
    }

    // bd_toilets structure: properties.lat/lon + tags, but geometry also has coordinates
    const lon = geom.coordinates[0];
    const lat = geom.coordinates[1];
    if (typeof lat !== 'number' || typeof lon !== 'number') { skipped++; return; }

    // Deduplicate toilets
    if (info.type === 'public_toilet') {
      const key = dedupKey(lat, lon);
      if (seen.has(key)) { deduped++; return; }
      seen.set(key, true);
    }

    const rawName = props.name || tags.name;
    const name = rawName && rawName !== 'Unknown' && String(rawName).trim() !== ''
      ? String(rawName).trim()
      : `${info.type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())} #${imported + 1}`;

    const point = [lon, lat];
    let district = normalizeDistrict(findAdmin(point, districts, 'name'));
    let division = findAdmin(point, divisions, 'name');
    if (division) division = division.replace(/ Division$/i, '').trim();
    let upazila = findAdmin(point, upazilas, 'name');
    if (district || division || upazila) inferred++;

    const addrParts = [name];
    if (upazila) addrParts.push(upazila);
    if (district) addrParts.push(district);
    if (division) addrParts.push(division);
    const address = addrParts.join(', ');

    stmt.run(name, info.type, info.phone, address, lat, lon, district, division, upazila);
    imported++;
  }

  // 0) Import Khulna division fire stations (authoritative, with contact numbers)
  const khulnaFirePath = path.join(uploadsDir, 'khulna_division_fire_stations.geojson');
  const khulnaFireSeen = new Set();
  if (fs.existsSync(khulnaFirePath)) {
    const khulnaData = JSON.parse(fs.readFileSync(khulnaFirePath, 'utf-8'));
    console.log(`Loaded khulna_division_fire_stations.geojson: ${khulnaData.features.length} features`);
    for (const feat of khulnaData.features) {
      const props = feat.properties || {};
      const geom = feat.geometry;
      if (!geom || !geom.coordinates) { skipped++; continue; }
      const [lon, lat] = geom.coordinates;
      if (typeof lat !== 'number' || typeof lon !== 'number') { skipped++; continue; }
      const name = (props.name_en || props.name_bn || `Fire Service #${imported + 1}`).trim();
      const phone = (props.contact || '102').trim();
      const district = props.district ? normalizeDistrict(props.district) : normalizeDistrict(findAdmin([lon, lat], districts, 'name'));
      const division = 'Khulna';
      const upazila = findAdmin([lon, lat], upazilas, 'name');
      if (district || division) inferred++;
      const addrParts = [name];
      if (upazila) addrParts.push(upazila);
      addrParts.push(district || 'Khulna');
      addrParts.push(division);
      const address = addrParts.join(', ');
      stmt.run(name, 'fire_service', phone, address, lat, lon, district || 'Khulna', division, upazila);
      khulnaFireSeen.add(`${name}|${district}`);
      imported++;
    }
    console.log(`Khulna fire stations imported: ${khulnaData.features.length}`);
  }

  // 1) Import toilets from bd_toilets.geojson first (more dedicated, higher priority)
  if (toiletsData) {
    for (const feat of toiletsData.features) {
      const tags = (feat.properties && feat.properties.tags) || {};
      const featForInsert = {
        properties: { amenity: tags.amenity || 'toilets', name: tags.name, office: tags.office },
        geometry: feat.geometry
      };
      if (!featForInsert.geometry && feat.properties.lat && feat.properties.lon) {
        featForInsert.geometry = { type: 'Point', coordinates: [feat.properties.lon, feat.properties.lat] };
      }
      insertFeature(featForInsert, 'bd_toilets');
      if (feat.properties && feat.properties.tags && feat.properties.tags.amenity === 'toilets') toiletsExtra++;
    }
    console.log(`bd_toilets: processed ${toiletsData.features.length}, toilets deduped so far: ${deduped}`);
  }

  // 2) Import services.geojson — skip Khulna fire stations (already covered by authoritative file)
  for (const feat of servicesData.features) {
    const props = feat.properties || {};
    if ((props.amenity || props.tags?.amenity) === 'fire_station') {
      const geom = feat.geometry;
      if (geom && geom.coordinates) {
        const div = findAdmin(geom.coordinates, divisions, 'name');
        const divName = div ? div.replace(/ Division$/i, '').trim() : null;
        if (divName === 'Khulna') { skipped++; continue; }
      }
    }
    insertFeature(feat, 'services');
  }

  // 3) Re-add utility services not present in OSM (titas, lged, desa)
  const utilities = [
    ['Titas Gas Head Office', 'titas_gas', '165', 'Kawran Bazar, Dhaka, Dhaka', 23.7500, 90.3990, 'Dhaka', 'Dhaka', null],
    ['LGED Dhaka Division', 'lged', '+880-2-55667788', 'LGED Bhaban, Agargaon, Dhaka, Dhaka', 23.7620, 90.3880, 'Dhaka', 'Dhaka', null],
    ['DESA Distribution Office', 'desa', '16999', 'DESA Bhaban, Dhaka, Dhaka', 23.7580, 90.3910, 'Dhaka', 'Dhaka', null],
  ];
  for (const [name, type, phone, address, lat, lng, district, division, upazila] of utilities) {
    stmt.run(name, type, phone, address, lat, lng, district, division, upazila);
    imported++;
  }
});
tx();

console.log(`Imported: ${imported} | Skipped: ${skipped} | Deduped toilets: ${deduped} | District/Division inferred: ${inferred}`);
console.log(`Total emergency_services now: ${db.prepare('SELECT COUNT(*) n FROM emergency_services').get().n}`);
const byType = db.prepare('SELECT type, COUNT(*) c FROM emergency_services GROUP BY type ORDER BY c DESC').all();
console.log('By type:', byType.map(r => `${r.type}:${r.c}`).join(', '));
