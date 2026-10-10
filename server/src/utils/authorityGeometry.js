import { db } from '../db.js';

const GOLDEN_ANGLE = 2.39996322972865332;
const CC_HALF = 0.09;
const CC_SMALL_HALF = 0.035;
const POURO_HALF = 0.04;
const POURO_RING_R = 0.14;
const UNION_HALF = 0.03;
const UNION_R_MIN = 0.2;
const UNION_R_SPAN = 0.14;
const GUARD_MARGIN = 0.005;
const MAX_NUDGES = 40;
const NUDGE_STEP = 0.35;

const r4 = (v) => +v.toFixed(4);
const dist = (aLat, aLng, bLat, bLng) =>
  Math.sqrt((aLat - bLat) ** 2 + (aLng - bLng) ** 2);

export const DISTRICT_COORDS = {
  'Dhaka': [23.71,90.41], 'Faridpur': [23.60,89.83], 'Gazipur': [24.00,90.42], 'Gopalganj': [23.01,89.82],
  'Kishoreganj': [24.43,90.78], 'Madaripur': [23.16,90.20], 'Manikganj': [23.86,90.00], 'Munshiganj': [23.54,90.53],
  'Narayanganj': [23.62,90.50], 'Narsingdi': [23.93,90.72], 'Rajbari': [23.76,89.64], 'Shariatpur': [23.24,90.36], 'Tangail': [24.25,89.91],
  'Bandarban': [22.19,92.21], 'Brahmanbaria': [23.96,91.11], 'Chandpur': [23.23,90.65], 'Chattogram': [22.35,91.78],
  'Cumilla': [23.46,91.18], "Cox's Bazar": [21.42,92.00], 'Feni': [23.01,91.40], 'Khagrachhari': [23.12,91.98],
  'Lakshmipur': [22.94,90.82], 'Noakhali': [22.82,91.10], 'Rangamati': [22.64,92.19],
  'Bagerhat': [22.65,89.52], 'Chuadanga': [23.64,88.85], 'Jashore': [23.16,89.20], 'Jhenaidah': [23.54,89.17],
  'Khulna': [22.84,89.54], 'Kushtia': [23.90,89.12], 'Magura': [23.48,89.41], 'Meherpur': [23.76,88.63],
  'Narail': [23.17,89.50], 'Satkhira': [22.71,89.07],
  'Bogura': [24.85,89.37], 'Chapainawabganj': [24.60,88.27], 'Joypurhat': [25.10,89.02], 'Naogaon': [24.80,88.95],
  'Natore': [24.41,88.93], 'Pabna': [24.00,89.21], 'Rajshahi': [24.37,88.60], 'Sirajganj': [24.45,89.70],
  'Habiganj': [24.37,91.41], 'Moulvibazar': [24.48,91.77], 'Sunamganj': [25.06,91.39], 'Sylhet': [24.89,91.86],
  'Barguna': [22.16,90.12], 'Barishal': [22.70,90.35], 'Bhola': [22.68,90.64], 'Jhalokati': [22.64,90.20],
  'Patuakhali': [22.36,90.33], 'Pirojpur': [22.58,89.98],
  'Dinajpur': [25.62,88.63], 'Gaibandha': [25.32,89.54], 'Kurigram': [25.80,89.64], 'Lalmonirhat': [25.91,89.45],
  'Nilphamari': [25.93,88.85], 'Panchagarh': [26.34,88.56], 'Rangpur': [25.74,89.27], 'Thakurgaon': [26.03,88.46],
  'Jamalpur': [24.93,89.93], 'Mymensingh': [24.74,90.42], 'Netrokona': [24.88,90.73], 'Sherpur': [25.02,90.01],
};

export async function districtBase(district) {
  if (DISTRICT_COORDS[district]) {
    const [lat, lng] = DISTRICT_COORDS[district];
    return { lat, lng };
  }
  const row = await db.prepare(
    'SELECT AVG(center_lat) AS lat, AVG(center_lng) AS lng FROM authorities WHERE district = ?'
  ).get(district);
  if (row.lat == null || row.lng == null) return null;
  return row;
}

async function setBox(authorityId, lat, lng, half) {
  await db.prepare(
    `UPDATE authorities
     SET center_lat = ?, center_lng = ?,
         min_lat = ?, max_lat = ?, min_lng = ?, max_lng = ?
     WHERE authority_id = ?`
  ).run(r4(lat), r4(lng), r4(lat - half), r4(lat + half), r4(lng - half), r4(lng + half), authorityId);
}

function clearOfForeignCC(lat, lng, ownHalf, district, ccByDistrict) {
  for (const [d, c] of ccByDistrict) {
    if (d === district) continue;
    if (dist(lat, lng, c.lat, c.lng) <= CC_HALF + ownHalf + GUARD_MARGIN) return false;
  }
  return true;
}

function nudgeClear(lat, lng, baseLat, baseLng, ownHalf, district, ccByDistrict) {
  let r = dist(lat, lng, baseLat, baseLng);
  let th = Math.atan2(lat - baseLat, lng - baseLng);
  for (let k = 0; k < MAX_NUDGES; k++) {
    if (clearOfForeignCC(lat, lng, ownHalf, district, ccByDistrict)) return [lat, lng];
    th += NUDGE_STEP;
    lat = baseLat + r * Math.sin(th);
    lng = baseLng + r * Math.cos(th);
  }
  return [lat, lng];
}

export async function fixAuthorityGeometry() {
  const districts = await db.prepare(
    'SELECT DISTINCT district FROM authorities WHERE district IS NOT NULL'
  ).all();
  const baseByDistrict = new Map();
  const ccByDistrict = new Map();
  for (const { district } of districts) {
    const base = await districtBase(district);
    if (!base) continue;
    baseByDistrict.set(district, base);
    const hasCC = await db.prepare(
      "SELECT 1 AS x FROM authorities WHERE district = ? AND type = 'CITY_CORPORATION' LIMIT 1"
    ).get(district);
    if (hasCC) ccByDistrict.set(district, base);
  }
  for (const { district } of districts) {
    const base = baseByDistrict.get(district);
    if (!base) continue;
    const rows = await db.prepare(
      'SELECT authority_id, type FROM authorities WHERE district = ? ORDER BY authority_id'
    ).all(district);
    const cc = rows.filter((r) => r.type === 'CITY_CORPORATION');
    const po = rows.filter((r) => r.type === 'POUROSHOVA');
    const un = rows.filter((r) => r.type === 'UNION_PARISHAD');
    for (let i = 0; i < cc.length; i++) {
      await setBox(cc[i].authority_id, base.lat, base.lng, i === 0 ? CC_HALF : CC_SMALL_HALF);
    }
    for (let i = 0; i < po.length; i++) {
      const th = (2 * Math.PI * i) / po.length;
      let plat = base.lat + POURO_RING_R * Math.sin(th);
      let plng = base.lng + POURO_RING_R * Math.cos(th);
      [plat, plng] = nudgeClear(plat, plng, base.lat, base.lng, POURO_HALF, district, ccByDistrict);
      await setBox(po[i].authority_id, plat, plng, POURO_HALF);
    }
    for (let i = 0; i < un.length; i++) {
      const frac = (i + 0.5) / un.length;
      const rr = UNION_R_MIN + UNION_R_SPAN * Math.sqrt(frac);
      const th = i * GOLDEN_ANGLE;
      let ulat = base.lat + rr * Math.sin(th);
      let ulng = base.lng + rr * Math.cos(th);
      [ulat, ulng] = nudgeClear(ulat, ulng, base.lat, base.lng, UNION_HALF, district, ccByDistrict);
      await setBox(un[i].authority_id, ulat, ulng, UNION_HALF);
    }
  }
  const DEMO_ANCHORS = [
    { like: '%Savar%', type: 'POUROSHOVA', lat: 23.858, lng: 90.266, half: 0.02 },
    { like: '%Ruhitpur%', type: 'UNION_PARISHAD', lat: 23.674, lng: 90.287, half: 0.02 }
  ];
  for (const a of DEMO_ANCHORS) {
    const row = await db.prepare(
      'SELECT authority_id, name FROM authorities WHERE type = ? AND name LIKE ? ORDER BY authority_id LIMIT 1'
    ).get(a.type, a.like);
    if (row) {
      await setBox(row.authority_id, a.lat, a.lng, a.half);
      console.log(`Anchor: ${row.name} -> (${a.lat},${a.lng}) half ${a.half}`);
    }
  }
}
