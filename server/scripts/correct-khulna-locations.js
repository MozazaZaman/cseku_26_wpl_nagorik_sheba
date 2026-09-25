import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data', 'nagorik.db');
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
const db = new Database(dbPath);

// Ensure location_precision column exists
const cols = db.prepare("PRAGMA table_info(emergency_services)").all().map(c => c.name);
if (!cols.includes('location_precision')) {
  db.exec("ALTER TABLE emergency_services ADD COLUMN location_precision TEXT");
  console.log('Added location_precision column');
}

const khulnaPath = path.join(uploadsDir, 'khulna_division_fire_stations.geojson');
const data = JSON.parse(fs.readFileSync(khulnaPath, 'utf-8'));
console.log(`Loaded ${data.features.length} Khulna fire entries (${data.features.filter(f => f.properties.name_en.includes('Fire Station')).length} fire stations)`);

const delay = (ms) => new Promise(r => setTimeout(r, ms));
const googleKey = process.env.GOOGLE_GEOCODE_KEY || null;
if (googleKey) console.log('Using Google Geocoding API (key provided)');
else console.log('Using public Nominatim API (set GOOGLE_GEOCODE_KEY env for Google Maps accuracy)');

async function geocodeOne(query) {
  if (googleKey) {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&region=bd&key=${googleKey}`;
    const res = await fetch(url);
    const j = await res.json();
    if (j.status === 'OK' && j.results && j.results.length > 0) {
      return { lat: j.results[0].geometry.location.lat, lon: j.results[0].geometry.location.lng, display: j.results[0].formatted_address };
    }
    return null;
  } else {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=bd&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'NagorikSheba/1.0 (student civic-tech project)' } });
    if (!res.ok) return null;
    const list = await res.json();
    if (list.length > 0) return { lat: parseFloat(list[0].lat), lon: parseFloat(list[0].lon), display: list[0].display_name };
    return null;
  }
}

let corrected = 0, kept = 0, notFound = 0, skippedGeocoded = 0;

for (const feat of data.features) {
  const props = feat.properties;
  const isFireStation = props.name_en && props.name_en.includes('Fire Station');
  const [origLon, origLat] = feat.geometry.coordinates;
  const name = props.name_en;
  const district = props.district;

  // Skip if already corrected (resume support)
  const existing = db.prepare("SELECT location_precision FROM emergency_services WHERE name = ? AND district = ? AND type = 'fire_service'").get(name, district);
  if (existing && existing.location_precision && existing.location_precision.startsWith('google-maps matched')) {
    skippedGeocoded++;
    continue;
  }

  // Only geocode actual fire stations, keep HQ administrative offices at approximate town center
  let newLat = origLat, newLon = origLon, precision = 'approximate (upazila/town center)';
  if (isFireStation) {
    const queries = [
      `${name}, ${district}, Khulna Division, Bangladesh`,
      `${name}, ${district}, Bangladesh`,
      `${name}, Bangladesh`,
    ];
    let found = null;
    let foundQuery = null;
    for (const q of queries) {
      found = await geocodeOne(q);
      if (found) {
        // Verify the result actually matches the fire station name (avoid Dhaka's Mohammadpur for Magura's)
        const baseName = name.split(' ')[0].toLowerCase();
        if (!found.display.toLowerCase().includes(baseName)) {
          console.log(`  candidate for "${name}" found at ${found.display.slice(0, 55)} — name mismatch, trying next query`);
          found = null;
        } else {
          console.log(`  FOUND "${name}" -> ${found.lat.toFixed(5)},${found.lon.toFixed(5)} via "${q.slice(0, 55)}"`);
          foundQuery = q;
          break;
        }
      }
      await delay(1100);
    }
    if (found) {
      if (found.lat >= 21.0 && found.lat <= 25.0 && found.lon >= 88.0 && found.lon <= 91.0) {
        newLat = found.lat;
        newLon = found.lon;
        precision = `google-maps matched: ${found.display.slice(0, 70)}`;
        corrected++;
      } else {
        console.log(`  found outside Khulna bounds, keeping approximate for "${name}"`);
        kept++;
      }
      await delay(1100);
    } else {
      console.log(`  NOT FOUND "${name}" (${district}) - keeping approximate`);
      notFound++;
    }
  } else {
    precision = 'approximate (HQ office - town center)';
    kept++;
  }

  // Update DB row matching this Khulna fire entry
  const result = db.prepare(
    "UPDATE emergency_services SET latitude = ?, longitude = ?, location_precision = ? WHERE name = ? AND district = ? AND type = 'fire_service'"
  ).run(newLat, newLon, precision, name, district);
  if (result.changes === 0) {
    console.log(`  WARNING: no DB row matched for "${name}" (${district})`);
  }
}

console.log(`\nDone: corrected=${corrected} kept_approx=${kept} not_found=${notFound}`);
console.log(`Fire services now: ${db.prepare("SELECT COUNT(*) n FROM emergency_services WHERE type='fire_service'").get().n}`);
console.log(`Khulna fire with precise geocode: ${db.prepare("SELECT COUNT(*) n FROM emergency_services WHERE type='fire_service' AND division='Khulna' AND location_precision LIKE 'google-maps%'").get().n}`);
