import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb, db } from './db.js';

initDb();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const force = process.argv.includes('--force');
const existing = db.prepare('SELECT COUNT(*) n FROM complaints').get().n;

if (existing > 0 && !force) {
  console.log('SAFETY LOCK: Database already contains ' + existing + ' complaints.');
  console.log('Your real data was NOT touched.');
  console.log('Nothing to do - just start the server with:  npm run dev');
  console.log('(To intentionally reset to demo data, run:  npm run seed -- --force)');
  process.exit(0);
}

const wipe = db.transaction(() => {
  db.exec(`
    DELETE FROM agent_logs; DELETE FROM notifications; DELETE FROM status_history;
    DELETE FROM votes; DELETE FROM complaints; DELETE FROM emergency_services;
    DELETE FROM staff; DELETE FROM authorities; DELETE FROM users;
    DELETE FROM sqlite_sequence;
  `);
});
wipe();

const hash = (p) => bcrypt.hashSync(p, 10);

// ---------- Authorities: from bangladesh_local_government_units.json (Report page only) ----------
const insAuth = db.prepare(
  `INSERT INTO authorities
     (name, type, min_lat, max_lat, min_lng, max_lng, center_lat, center_lng, division, district, upazila, phone, email)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

const pad = (v, d) => +(v + d).toFixed(4);
function addAuthority(name, type, division, district, upazila, lat, lng, phone, email) {
  const d = type === 'CITY_CORPORATION' ? 0.09 : type === 'POUROSHOVA' ? 0.06 : 0.05;
  return insAuth.run(
    name, type, pad(lat, -d), pad(lat, d), pad(lng, -d), pad(lng, d), lat, lng,
    division, district, upazila || null, phone, email
  ).lastInsertRowid;
}

// district center coordinates (used to place authorities when JSON has no lat/lng)
const DISTRICT_COORDS = {
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

// normalize division/district names from JSON to match bd-geo.json
const DIV_NORM = { 'Chattagram':'Chattogram', 'Barisal':'Barishal', 'Chattogram':'Chattogram', 'Dhaka':'Dhaka', 'Khulna':'Khulna', 'Rajshahi':'Rajshahi', 'Sylhet':'Sylhet', 'Rangpur':'Rangpur', 'Mymensingh':'Mymensingh' };
const DIST_ALIAS = {
  'comilla':'Cumilla',
  'coxsbazar':"Cox's Bazar",
  'chapainawabganj':'Chapainawabganj',
  'jhalokathi':'Jhalokati',
  'cox\'s bazar':"Cox's Bazar",
  'chapai nawabganj':'Chapainawabganj',
};

function normDivision(d) {
  const t = (d||'').trim();
  return DIV_NORM[t] || t;
}
function normDistrict(d) {
  const t = (d||'').trim();
  // direct match in coords?
  if (DISTRICT_COORDS[t]) return t;
  const key = t.toLowerCase().replace(/[^a-z]/g,'');
  if (DIST_ALIAS[key]) return DIST_ALIAS[key];
  // try case-insensitive match to coords keys
  for (const k of Object.keys(DISTRICT_COORDS)) {
    if (k.toLowerCase().replace(/[^a-z]/g,'') === key) return k;
  }
  return t;
}

function coordFor(district, idx) {
  const base = DISTRICT_COORDS[district] || [23.71, 90.41];
  const offLat = ((idx % 30) - 15) * 0.0025;
  const offLng = ((Math.floor(idx/30) % 30) - 15) * 0.0025;
  return [base[0] + offLat, base[1] + offLng];
}

// Load JSON (Report page only source)
const lgPath = path.join(__dirname, '..', '..', 'uploads', 'bangladesh_local_government_units.json');
console.log('Reading LG JSON...');
const raw = fs.readFileSync(lgPath, 'utf-8');
const lg = JSON.parse(raw);
console.log(`LG JSON: ${lg.city_corporations.length} CC, ${lg.pourashava.length} Pouro, ${lg.unions.length} Unions`);

const A = {};
let globalIdx = 0;

function insertLG(entry, type, nameField, divField, distField, upazilaField) {
  const rawDiv = entry[divField] || entry.division || entry.division_name;
  const rawDist = entry[distField] || entry.district || entry.district_name;
  const division = normDivision(rawDiv);
  const district = normDistrict(rawDist);
  let name = entry[nameField] || entry.name;
  if (type === 'POUROSHOVA' && !/pourashava/i.test(name)) name = `${name} Pourashava`;
  if (type === 'UNION_PARISHAD' && !/union/i.test(name)) name = `${name} Union Parishad`;
  // keep CC name as-is
  const upazila = upazilaField ? (entry[upazilaField] || entry.upazila_name || null) : null;
  const [lat, lng] = coordFor(district, globalIdx++);
  const id = addAuthority(name, type, division, district, upazila, lat, lng, null, null);
  // keep lookup for complaint seeding
  const key = name.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z_]/g,'');
  if (!A[key]) A[key] = id;
  return id;
}

console.log('Seeding authorities from JSON...');
const lgInsert = db.transaction(() => {
  for (const e of lg.city_corporations) insertLG(e, 'CITY_CORPORATION', 'name', 'division', 'district', null);
  for (const e of lg.pourashava) insertLG(e, 'POUROSHOVA', 'name', 'division', 'district', null);
  for (const e of lg.unions) insertLG(e, 'UNION_PARISHAD', 'name', 'division_name', 'district_name', 'upazila_name');
});
lgInsert();
console.log('Authorities seeded');

// convenient aliases for demo complaints (lookup by name)
function findAuth(name) {
  const row = db.prepare('SELECT authority_id FROM authorities WHERE name=? LIMIT 1').get(name);
  return row ? row.authority_id : null;
}
A.dhakaSouth = findAuth('Dhaka South City Corporation');
A.dhakaNorth = findAuth('Dhaka North City Corporation');
A.gazipur = findAuth('Gazipur City Corporation');
A.narayanganj = findAuth('Narayanganj City Corporation');
A.chattogram = findAuth('Chattogram City Corporation');
A.cumilla = findAuth('Cumilla City Corporation');
A.khulna = findAuth('Khulna City Corporation');
A.rajshahi = findAuth('Rajshahi City Corporation');
A.sylhet = findAuth('Sylhet City Corporation');
A.barishal = findAuth('Barishal City Corporation');
A.rangpur = findAuth('Rangpur City Corporation');
A.mymensingh = findAuth('Mymensingh City Corporation');
// for backwards compat, pick any representative poura/union if needed
A.savar = findAuth('Savar Pourashava') || db.prepare("SELECT authority_id FROM authorities WHERE district='Dhaka' AND type='POUROSHOVA' LIMIT 1").get()?.authority_id;
A.ruhitpur = db.prepare("SELECT authority_id FROM authorities WHERE name LIKE '%Ruhitpur%' LIMIT 1").get()?.authority_id || db.prepare("SELECT authority_id FROM authorities WHERE district='Dhaka' AND type='UNION_PARISHAD' LIMIT 1").get()?.authority_id;
A.dighalia = db.prepare("SELECT authority_id FROM authorities WHERE name LIKE '%Dighalia%' LIMIT 1").get()?.authority_id || A.khulna;
A.gowainghat = db.prepare("SELECT authority_id FROM authorities WHERE name LIKE '%Gowainghat%' LIMIT 1").get()?.authority_id || A.sylhet;
A.jashore = db.prepare("SELECT authority_id FROM authorities WHERE district='Jashore' AND type='POUROSHOVA' LIMIT 1").get()?.authority_id;
A.kushtia = db.prepare("SELECT authority_id FROM authorities WHERE district='Kushtia' AND type='POUROSHOVA' LIMIT 1").get()?.authority_id;
A.coxsbazar = db.prepare("SELECT authority_id FROM authorities WHERE district=? AND type='POUROSHOVA' LIMIT 1").get("Cox's Bazar")?.authority_id;
A.bogura = db.prepare("SELECT authority_id FROM authorities WHERE district='Bogura' AND type='POUROSHOVA' LIMIT 1").get()?.authority_id;
A.moulvibazar = db.prepare("SELECT authority_id FROM authorities WHERE district='Moulvibazar' AND type='POUROSHOVA' LIMIT 1").get()?.authority_id;
A.bhola = db.prepare("SELECT authority_id FROM authorities WHERE district='Bhola' AND type='POUROSHOVA' LIMIT 1").get()?.authority_id;
A.dinajpur = db.prepare("SELECT authority_id FROM authorities WHERE district='Dinajpur' AND type='POUROSHOVA' LIMIT 1").get()?.authority_id;
A.jamalpur = db.prepare("SELECT authority_id FROM authorities WHERE district='Jamalpur' AND type='POUROSHOVA' LIMIT 1").get()?.authority_id;

// ---------- Staff: one general officer per EVERY authority ----------
const insStaff = db.prepare(
  `INSERT INTO staff (full_name, email, password_hash, department, authority_id) VALUES (?, ?, ?, 'general', ?)`
);
const staffNames = ['Kamrul Hasan','Shirin Akter','Habibur Rahman','Tanjina Sultana','Mizanur Rahman','Asaduzzaman Noor','Farhana Yasmin','Rakibul Islam','Nusrat Jahan','Shafiqul Alam','Mahmuda Khatun','Arif Chowdhury','Sohel Mahmud','Rehana Parvin','Delwar Hossain','Sabbir Ahmed','Tahmina Begum','Imran Khan','Jahid Hasan','Salma Akter','Nayeem Mia','Ruhul Amin','Jamal Uddin','Ripon Mia','Anika Sultana','Rashid Khan','Farzana Ahmed','Mokbul Hossain','Sonia Akter','Biplob Kumar','Lamia Rahman','Tofayel Ahmed','Nazia Islam','Saiful Alam','Shahnaz Parvin','Khaled Mahmud','Rubina Yasmin','Elias Hossain','Sharmin Akter','Moniruzzaman','Tanvir Ahmed','Fahmida Begum','Ariful Islam','Sultana Rajia','Mahbub Alam','Nasrin Akter','Helal Uddin','Jannatul Ferdous','Abdur Rahim','Moushumi Akter','Shahriar Kabir','Rezaul Karim','Nadira Sultana','Firoz Ahmed','Tasnim Jahan'];
const staffHash = hash('staff123');
console.log('Seeding staff (4880) with single hash...');
const legacyCCStaff = [
  ['Kamrul Hasan','kamrul.city@nagorik.bd', A.dhakaSouth],
  ['Shirin Akter','shirin.city@nagorik.bd', A.dhakaNorth],
  ['Shafiqul Alam','staff.gazipur@nagorik.bd', A.gazipur],
  ['Mahmuda Khatun','staff.narayanganj@nagorik.bd', A.narayanganj],
  ['Tanjina Sultana','staff.chattogram@nagorik.bd', A.chattogram],
  ['Arif Chowdhury','staff.cumilla@nagorik.bd', A.cumilla],
  ['Habibur Rahman','staff.khulna@nagorik.bd', A.khulna],
  ['Asaduzzaman Noor','staff.rajshahi@nagorik.bd', A.rajshahi],
  ['Mizanur Rahman','staff.sylhet@nagorik.bd', A.sylhet],
  ['Farhana Yasmin','staff.barishal@nagorik.bd', A.barishal],
  ['Rakibul Islam','staff.rangpur@nagorik.bd', A.rangpur],
  ['Nusrat Jahan','staff.mymensingh@nagorik.bd', A.mymensingh],
];
const createdAuthorityIds = new Set();
const staffInsertMany = db.transaction(() => {
  for (const [fullName, email, authId] of legacyCCStaff) {
    if (!authId) continue;
    insStaff.run(fullName, email, staffHash, authId);
    createdAuthorityIds.add(authId);
  }
  const allAuthorities = db.prepare('SELECT authority_id, name, type, district FROM authorities').all();
  let idx = 0;
  for (const auth of allAuthorities) {
    if (createdAuthorityIds.has(auth.authority_id)) continue;
    const fullName = staffNames[idx % staffNames.length];
    idx++;
    const safeDistrict = auth.district.toLowerCase().replace(/[^a-z]/g,'');
    const email = `${auth.type.toLowerCase()}.${safeDistrict}.${auth.authority_id}@nagorik.bd`;
    insStaff.run(`${fullName} - ${auth.name}`, email, staffHash, auth.authority_id);
    createdAuthorityIds.add(auth.authority_id);
  }
});
staffInsertMany();
console.log(`Staff seeded: ${createdAuthorityIds.size}`);

// ---------- Citizens ----------
const insUser = db.prepare(
  `INSERT INTO users (full_name, email, phone, password_hash) VALUES (?, ?, ?, ?)`
);
const rahim = insUser.run('Rahim Ahmed', 'rahim@example.com', '+8801711111111', hash('password123')).lastInsertRowid;
const karim = insUser.run('Karima Begum', 'karima@example.com', '+8801822222222', hash('password123')).lastInsertRowid;
const joya = insUser.run('Joya Chowdhury', 'joya@example.com', '+8801933333333', hash('password123')).lastInsertRowid;

// ---------- Emergency services: from uploads (osmium extracts) - Task 4 but kept minimal here, full import happens via seed ----------
const insSvc = db.prepare(
  `INSERT INTO emergency_services (name, type, phone, address, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?)`
);
let services = [];
try {
  const firePath = path.join(__dirname, '..', '..', 'uploads', 'bangladesh_fire_stations.json');
  const policePath = path.join(__dirname, '..', '..', 'uploads', 'bangladesh_police_stations.json');
  const toiletPath = path.join(__dirname, '..', '..', 'uploads', 'bangladesh_public_toilets.json');
  const wasaPath = path.join(__dirname, '..', '..', 'uploads', 'bangladesh_wasa_desa_lged.json');
  // osmium extracts are in uploads as JSON with keys like fire_stations / police_stations / toilets / wasa_offices etc
  function insertSvc(name, type, lat, lng, phone, addr) {
    lat=parseFloat(lat); lng=parseFloat(lng);
    if(Number.isNaN(lat)||Number.isNaN(lng)||!name) return;
    try{ insSvc.run(String(name), type, String(phone||'N/A'), String(addr||name), lat, lng); services.push(name);}catch{}
  }
  if (fs.existsSync(firePath)) {
    const j=JSON.parse(fs.readFileSync(firePath,'utf-8'));
    const arr=j.fire_stations||j.features||j.data||[];
    for(const f of arr){ const p=f.properties||f; insertSvc(p.name||f.name, 'fire_service', p.latitude||p.lat, p.longitude||p.lon, p.phone_number||'102', p.address||`${p.district||''} ${p.division||''}`.trim()); }
  }
  if (fs.existsSync(policePath)) {
    const j=JSON.parse(fs.readFileSync(policePath,'utf-8'));
    const arr=j.police_stations||j.features||[];
    for(const f of arr){ const p=f.properties||f; insertSvc(p.name||f.name, 'police_station', p.latitude||p.lat, p.longitude||p.lon, p.phone_number||'999', p.address||`${p.district||''} ${p.division||''}`.trim()); }
  }
  if (fs.existsSync(toiletPath)) {
    const j=JSON.parse(fs.readFileSync(toiletPath,'utf-8'));
    const arr=j.toilets||j.features||[];
    for(const f of arr){ const p=f.properties||f; insertSvc(p.name||f.name, 'public_toilet', p.latitude||p.lat, p.longitude||p.lon, p.phone_number||'N/A', p.address||`${p.district||''} ${p.division||''}`.trim()); }
  }
  if (fs.existsSync(wasaPath)) {
    const j=JSON.parse(fs.readFileSync(wasaPath,'utf-8'));
    for(const f of (j.wasa_offices||[])) { const p=f.properties||f; insertSvc(p.name, 'wasa', p.latitude, p.longitude, p.phone_number||'N/A', p.address); }
    for(const f of (j.desa_successor_offices||[])) { const p=f.properties||f; insertSvc(p.name, 'desa', p.latitude, p.longitude, p.phone_number||'16999', p.address); }
    for(const f of (j.lged_offices||[])) { const p=f.properties||f; insertSvc(p.name, 'lged', p.latitude, p.longitude, p.phone_number||'N/A', p.address); }
    // also handle any titas entries if present
    for(const f of (j.titas_gas||j.titas||[])) { const p=f.properties||f; insertSvc(p.name, 'titas_gas', p.latitude, p.longitude, p.phone_number||'165', p.address); }
  }
} catch(e){ console.log('emergency import skipped', e.message); }
if (services.length === 0) {
  const fallback = [
    ['Ramna Fire Station', 'fire_service', '102 / +880-2-223355566', 'Ramna, Dhaka', 23.7350, 90.3970],
    ['Tejgaon Fire Station', 'fire_service', '102 / +880-2-9111000', 'Tejgaon Industrial Area, Dhaka', 23.7590, 90.4000],
    ['Ramna Model Thana', 'police_station', '999', 'Ramna, Dhaka', 23.7310, 90.3995],
    ['Shahbagh Police Station', 'police_station', '999', 'Shahbagh, Dhaka', 23.7390, 90.3930],
    ['DWASA Head Office', 'wasa', '+880-2-223388777', '98 Kazi Alauddin Rd, Dhaka', 23.7509, 90.3936],
    ['LGED Dhaka Division', 'lged', '+880-2-55667788', 'LGED Bhaban, Agargaon, Dhaka', 23.7620, 90.3880],
    ['DESA Distribution Office', 'desa', '16999', 'DESA Bhaban, Ma Sherani Rd, Dhaka', 23.7580, 90.3910],
    ['Titas Gas Head Office', 'titas_gas', '165', 'Kawran Bazar, Dhaka', 23.7500, 90.3990],
  ];
  for (const s of fallback) { insSvc.run(...s); services.push(s[0]); }
}

// ---------- Demo complaints ----------
const insComplaint = db.prepare(
  `INSERT INTO complaints
     (user_id, authority_id, title, description, latitude, longitude, address_text,
      category, status, priority_score, vote_count, eta_hours, created_at, updated_at, resolved_at,
      division, district, area_text, road, full_address)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?), datetime('now', ?), ?, ?, ?, ?, ?, ?)`
);

const c1 = insComplaint.run(
  rahim, A.dhakaSouth,
  'Deep pothole on Fuller Road is causing accidents',
  'There is a very deep pothole near Fuller Road crossing. Two motorbikes already had accidents here yesterday. Dangerous for children going to school.',
  23.7365, 90.3985, 'Fuller Road, Shahbagh, Dhaka',
  'road', 'verified', 34.5, 3, null, '-3 days', '-3 days', null,
  'Dhaka', 'Dhaka', 'Shahbagh', 'Fuller Road',
  'Road Fuller Road, Shahbagh, Dhaka South City Corporation, Dhaka, Dhaka, Bangladesh'
).lastInsertRowid;

const c2 = insComplaint.run(
  karim, A.dhakaSouth,
  'Electric pole leaning dangerously over footpath',
  'An electric pole near TSC is badly tilted after the storm. Live wires are exposed. Very dangerous for students.',
  23.7330, 90.3945, 'TSC area, DU campus',
  'electricity', 'in_process', 58.0, 6, 48, '-5 days', '-1 days', null,
  'Dhaka', 'Dhaka', 'Dhaka University', 'TSC Road',
  'Road TSC Road, Dhaka University, Dhaka South City Corporation, Dhaka, Dhaka, Bangladesh'
).lastInsertRowid;

const c3 = insComplaint.run(
  joya, A.dhakaSouth,
  'Water logging drains overflowing at Nilkhet',
  'Drainage water is overflowing on the road at Nilkhet intersection. Mosquitoes are breeding. Whole area smells terrible.',
  23.7285, 90.3925, 'Nilkhet, Dhaka',
  'water', 'resolved', 41.0, 4, null, '-12 days', '-2 days', 'now',
  'Dhaka', 'Dhaka', 'Nilkhet', 'Nilkhet Road',
  'Road Nilkhet Road, Nilkhet, Dhaka South City Corporation, Dhaka, Dhaka, Bangladesh'
).lastInsertRowid;

const c4 = insComplaint.run(
  karim, A.savar,
  'Garbage not collected for two weeks in Savar Bazar',
  'Community bins near Savar Bazar have not been emptied for weeks. Waste is spilling onto the road.',
  23.8580, 90.2660, 'Savar Bazar Road, Savar',
  'sanitation', 'verified', 18.0, 1, null, '-1 days', '-1 days', null,
  'Dhaka', 'Dhaka', 'Savar Bazar', 'Bazar Road',
  'Road Bazar Road, Savar Bazar, Savar Pourashava, Dhaka, Dhaka, Bangladesh'
).lastInsertRowid;

insComplaint.run(
  rahim, A.ruhitpur,
  'Tube well broken at Ruhitpur bazaar',
  'The only public tube well at the bazaar is broken for a month. People are drinking unsafe water.',
  23.6740, 90.2870, 'Ruhitpur Bazaar, Keraniganj',
  'water', 'verified', 12.0, 0, null, '-6 hours', '-6 hours', null,
  'Dhaka', 'Dhaka', null, 'Bazaar Road',
  'Road Bazaar Road, Ruhitpur Union Parishad, Dhaka, Dhaka, Bangladesh'
);

insComplaint.run(
  joya, A.dhakaSouth,
  'Street light not working near Curzon Hall',
  'The streetlight opposite Curzon Hall gate has been off for a week. The road is pitch dark at night, unsafe for women.',
  23.7375, 90.3965, 'Curzon Hall, DU campus',
  'electricity', 'submitted', 8.0, 0, null, '-2 hours', '-2 hours', null,
  'Dhaka', 'Dhaka', 'Curzon Hall', 'Curzon Hall Road',
  'Road Curzon Hall Road, Curzon Hall, Dhaka South City Corporation, Dhaka, Dhaka, Bangladesh'
);

const c7 = insComplaint.run(
  rahim, A.khulna,
  'Gas leakage near Shiromoni point is terrifying residents',
  'Strong gas smell near the Titas gas pipeline at Shiromoni crossing since morning. People are afraid to light stoves. Very dangerous.',
  22.8122, 89.5521, 'Shiromoni Crossing, Khulna',
  'gas', 'verified', 27.0, 2, null, '-9 hours', '-9 hours', null,
  'Khulna', 'Khulna', 'Shiromoni', 'Khan Jahan Ali Road',
  'Road Khan Jahan Ali Road, Shiromoni, Khulna City Corporation, Khulna, Khulna, Bangladesh'
).lastInsertRowid;

insComplaint.run(
  karim, A.chattogram,
  'Garbage pile rotting at Reazuddin Bazar for days',
  'A huge pile of garbage is rotting beside the main market entrance. Flies everywhere, shopkeepers are suffering.',
  22.3378, 91.8350, 'Reazuddin Bazar, Chattogram',
  'sanitation', 'verified', 15.0, 1, null, '-20 hours', '-20 hours', null,
  'Chattogram', 'Chattogram', 'Reazuddin Bazar', 'Bazar Road',
  'Road Bazar Road, Reazuddin Bazar, Chattogram City Corporation, Chattogram, Chattogram, Bangladesh'
);

insComplaint.run(
  joya, A.sylhet,
  'Road cracked badly near Amberkhana after flood',
  'The road near Amberkhana point has large cracks after the last flood. Buses wobble over it, may collapse anytime.',
  24.8990, 91.8697, 'Amberkhana Point, Sylhet',
  'road', 'submitted', 9.0, 0, null, '-4 hours', '-4 hours', null,
  'Sylhet', 'Sylhet', 'Amberkhana', 'Station Road',
  'Road Station Road, Amberkhana, Sylhet City Corporation, Sylhet, Sylhet, Bangladesh'
);

// Votes
const insVote = db.prepare('INSERT INTO votes (user_id, complaint_id) VALUES (?, ?)');
insVote.run(karim, c1); insVote.run(joya, c1); insVote.run(rahim, c3); insVote.run(joya, c3);
insVote.run(rahim, c2); insVote.run(joya, c2); insVote.run(karim, c2); insVote.run(joya, c4);
insVote.run(karim, c7);

// Status history + notifications
db.prepare(
  `INSERT INTO status_history (complaint_id, old_status, new_status, note, changed_by)
   VALUES (?, 'verified', 'in_process', 'Repair crew scheduled within 48 hours.', 'Shirin Akter')`
).run(c2);
db.prepare(
  `INSERT INTO status_history (complaint_id, old_status, new_status, note, changed_by)
   VALUES (?, 'verified', 'resolved', 'Drain cleared and re-cemented by city corporation crew.', 'Kamrul Hasan')`
).run(c3);
db.prepare(
  `INSERT INTO notifications (user_id, complaint_id, title, message)
   VALUES (?, ?, 'Problem solving started', 'The problem solving is in progress. Estimated time: 48 hours.')`
).run(karim, c2);
db.prepare(
  `INSERT INTO notifications (user_id, complaint_id, title, message)
   VALUES (?, ?, 'Problem resolved', 'Your reported problem has been marked as DONE by the authority.')`
).run(joya, c3);
db.prepare(
  `INSERT INTO notifications (user_id, complaint_id, title, message)
   VALUES (?, ?, 'Update on an issue you voted for', 'Gas leakage near Shiromoni point is under review by Khulna City Corporation.')`
).run(karim, c7);

const authCount = db.prepare('SELECT COUNT(*) n FROM authorities').get().n;
console.log('Nationwide seed complete (from bangladesh_local_government_units.json):');
console.log(`  Authorities : ${authCount} (CC ${db.prepare("SELECT COUNT(*) n FROM authorities WHERE type='CITY_CORPORATION'").get().n} + Pouro ${db.prepare("SELECT COUNT(*) n FROM authorities WHERE type='POUROSHOVA'").get().n} + Union ${db.prepare("SELECT COUNT(*) n FROM authorities WHERE type='UNION_PARISHAD'").get().n})`);
console.log(`  Staff       : ${db.prepare('SELECT COUNT(*) n FROM staff').get().n} general officers (password: staff123)`);
console.log('  Citizens    : rahim@example.com / karima@example.com / joya@example.com  (password: password123)');
console.log(`  Services    : ${services.length} emergency services (osmium extracts)`);
console.log(`  Complaints  : ${db.prepare('SELECT COUNT(*) n FROM complaints').get().n}`);
