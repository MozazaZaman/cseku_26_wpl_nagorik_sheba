import bcrypt from 'bcryptjs';
import { initDb, db } from './db.js';

initDb();

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

// ---------- Authorities (nationwide, all 8 divisions) ----------
const insAuth = db.prepare(
  `INSERT INTO authorities
     (name, type, min_lat, max_lat, min_lng, max_lng, center_lat, center_lng, division, district, phone, email)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

const pad = (v, d) => +(v + d).toFixed(4);
function addAuthority(name, type, division, district, lat, lng, phone, email) {
  const d = type === 'CITY_CORPORATION' ? 0.09 : 0.07;
  return insAuth.run(
    name, type, pad(lat, -d), pad(lat, d), pad(lng, -d), pad(lng, d), lat, lng,
    division, district, phone, email
  ).lastInsertRowid;
}

const A = {};
A.dhakaSouth = addAuthority('Dhaka South City Corporation', 'CITY_CORPORATION', 'Dhaka', 'Dhaka', 23.7276, 90.4093, '+880-2-9674444', 'dsp@dhakasouth.gov.bd');
A.dhakaNorth = addAuthority('Dhaka North City Corporation', 'CITY_CORPORATION', 'Dhaka', 'Dhaka', 23.8103, 90.4150, '+880-2-55074141', 'dncc@dncc.gov.bd');
A.gazipur = addAuthority('Gazipur City Corporation', 'CITY_CORPORATION', 'Dhaka', 'Gazipur', 24.0019, 90.4203, '+880-2-49266015', 'gcc@gazipur.gov.bd');
A.narayanganj = addAuthority('Narayanganj City Corporation', 'CITY_CORPORATION', 'Dhaka', 'Narayanganj', 23.6238, 90.4997, '+880-2-7641552', 'ncc@narayanganj.gov.bd');
A.savar = addAuthority('Savar Pouroshova', 'POUROSHOVA', 'Dhaka', 'Dhaka', 23.8580, 90.2660, '+880-2-7789123', 'info@savarpourashava.gov.bd');
A.ruhitpur = addAuthority('Ruhitpur Union Parishad', 'UNION_PARISHAD', 'Dhaka', 'Dhaka', 23.6740, 90.2870, '+880-1730-456789', 'ruhitpur.up@gmail.com');
A.chattogram = addAuthority('Chattogram City Corporation', 'CITY_CORPORATION', 'Chattogram', 'Chattogram', 22.3569, 91.7832, '+880-31-615600', 'ccc@ctg.gov.bd');
A.cumilla = addAuthority('Cumilla City Corporation', 'CITY_CORPORATION', 'Chattogram', 'Cumilla', 23.4607, 91.1809, '+880-81-61160', 'cumillacity@gmail.com');
A.coxsbazar = addAuthority("Cox's Bazar Pouroshova", 'POUROSHOVA', 'Chattogram', "Cox's Bazar", 21.4272, 92.0058, '+880-341-63100', 'cp.coxsbazar@gmail.com');
A.khulna = addAuthority('Khulna City Corporation', 'CITY_CORPORATION', 'Khulna', 'Khulna', 22.8456, 89.5403, '+880-241-720044', 'kcc@khulnacity.org');
A.jashore = addAuthority('Jashore Pouroshova', 'POUROSHOVA', 'Khulna', 'Jashore', 23.1664, 89.2081, '+880-421-68684', 'jashorepourashava@gmail.com');
A.kushtia = addAuthority('Kushtia Pouroshova', 'POUROSHOVA', 'Khulna', 'Kushtia', 23.9013, 89.1206, '+880-71-62200', 'kushtiapo@gmail.com');
A.dighalia = addAuthority('Dighalia Union Parishad', 'UNION_PARISHAD', 'Khulna', 'Khulna', 22.9203, 89.5603, '+880-1777-123456', 'dighalia.up@gmail.com');
A.rajshahi = addAuthority('Rajshahi City Corporation', 'CITY_CORPORATION', 'Rajshahi', 'Rajshahi', 24.3745, 88.6042, '+880-721-771394', 'rcc@rajshahi.gov.bd');
A.bogura = addAuthority('Bogura Pouroshova', 'POUROSHOVA', 'Rajshahi', 'Bogura', 24.8465, 89.3773, '+880-51-78412', 'bogurapourashava@gmail.com');
A.sylhet = addAuthority('Sylhet City Corporation', 'CITY_CORPORATION', 'Sylhet', 'Sylhet', 24.8949, 91.8687, '+880-821-720055', 'scc@sylhetcity.gov.bd');
A.moulvibazar = addAuthority('Moulvibazar Pouroshova', 'POUROSHOVA', 'Sylhet', 'Moulvibazar', 24.4829, 91.7774, '+880-861-63000', 'moulvibazar.po@gmail.com');
A.gowainghat = addAuthority('Gowainghat Union Parishad', 'UNION_PARISHAD', 'Sylhet', 'Sylhet', 25.0293, 92.0180, '+880-1711-987654', 'gowainghat.up@gmail.com');
A.barishal = addAuthority('Barishal City Corporation', 'CITY_CORPORATION', 'Barishal', 'Barishal', 22.7010, 90.3535, '+880-431-21760', 'bcc@barishal.gov.bd');
A.bhola = addAuthority('Bhola Pouroshova', 'POUROSHOVA', 'Barishal', 'Bhola', 22.6859, 90.6482, '+880-491-56300', 'bholapo@gmail.com');
A.rangpur = addAuthority('Rangpur City Corporation', 'CITY_CORPORATION', 'Rangpur', 'Rangpur', 25.7439, 89.2752, '+880-521-62224', 'rpcc@rangpur.gov.bd');
A.dinajpur = addAuthority('Dinajpur Pouroshova', 'POUROSHOVA', 'Rangpur', 'Dinajpur', 25.6217, 88.6354, '+880-531-64888', 'dinajpurpo@gmail.com');
A.mymensingh = addAuthority('Mymensingh City Corporation', 'CITY_CORPORATION', 'Mymensingh', 'Mymensingh', 24.7471, 90.4203, '+880-91-65055', 'mcc@mymensingh.gov.bd');
A.jamalpur = addAuthority('Jamalpur Pouroshova', 'POUROSHOVA', 'Mymensingh', 'Jamalpur', 24.9264, 89.9371, '+880-981-63333', 'jamalpurpo@gmail.com');

// ---------- General staff (one per authority, no departments) ----------
const insStaff = db.prepare(
  `INSERT INTO staff (full_name, email, password_hash, department, authority_id) VALUES (?, ?, ?, 'general', ?)`
);
insStaff.run('Kamrul Hasan', 'kamrul.city@nagorik.bd', hash('staff123'), A.dhakaSouth);
insStaff.run('Shirin Akter', 'shirin.city@nagorik.bd', hash('staff123'), A.dhakaNorth);
insStaff.run('Jamal Uddin', 'jamal.savar@nagorik.bd', hash('staff123'), A.savar);
insStaff.run('Ripon Mia', 'ripon.union@nagorik.bd', hash('staff123'), A.ruhitpur);
insStaff.run('Habibur Rahman', 'staff.khulna@nagorik.bd', hash('staff123'), A.khulna);
insStaff.run('Tanjina Sultana', 'staff.chattogram@nagorik.bd', hash('staff123'), A.chattogram);
insStaff.run('Mizanur Rahman', 'staff.sylhet@nagorik.bd', hash('staff123'), A.sylhet);
insStaff.run('Asaduzzaman Noor', 'staff.rajshahi@nagorik.bd', hash('staff123'), A.rajshahi);
insStaff.run('Farhana Yasmin', 'staff.barishal@nagorik.bd', hash('staff123'), A.barishal);
insStaff.run('Rakibul Islam', 'staff.rangpur@nagorik.bd', hash('staff123'), A.rangpur);
insStaff.run('Nusrat Jahan', 'staff.mymensingh@nagorik.bd', hash('staff123'), A.mymensingh);
insStaff.run('Shafiqul Alam', 'staff.gazipur@nagorik.bd', hash('staff123'), A.gazipur);
insStaff.run('Mahmuda Khatun', 'staff.narayanganj@nagorik.bd', hash('staff123'), A.narayanganj);
insStaff.run('Arif Chowdhury', 'staff.cumilla@nagorik.bd', hash('staff123'), A.cumilla);
insStaff.run('Sohel Mahmud', 'staff.jashore@nagorik.bd', hash('staff123'), A.jashore);
insStaff.run('Rehana Parvin', 'staff.coxsbazar@nagorik.bd', hash('staff123'), A.coxsbazar);
insStaff.run('Delwar Hossain', 'staff.kushtia@nagorik.bd', hash('staff123'), A.kushtia);
insStaff.run('Sabbir Ahmed', 'staff.dighalia@nagorik.bd', hash('staff123'), A.dighalia);
insStaff.run('Tahmina Begum', 'staff.bogura@nagorik.bd', hash('staff123'), A.bogura);
insStaff.run('Imran Khan', 'staff.moulvibazar@nagorik.bd', hash('staff123'), A.moulvibazar);
insStaff.run('Jahid Hasan', 'staff.gowainghat@nagorik.bd', hash('staff123'), A.gowainghat);
insStaff.run('Salma Akter', 'staff.bhola@nagorik.bd', hash('staff123'), A.bhola);
insStaff.run('Nayeem Mia', 'staff.dinajpur@nagorik.bd', hash('staff123'), A.dinajpur);
insStaff.run('Ruhul Amin', 'staff.jamalpur@nagorik.bd', hash('staff123'), A.jamalpur);

// ---------- Citizens ----------
const insUser = db.prepare(
  `INSERT INTO users (full_name, email, phone, password_hash) VALUES (?, ?, ?, ?)`
);
const rahim = insUser.run('Rahim Ahmed', 'rahim@example.com', '+8801711111111', hash('password123')).lastInsertRowid;
const karim = insUser.run('Karima Begum', 'karima@example.com', '+8801822222222', hash('password123')).lastInsertRowid;
const joya = insUser.run('Joya Chowdhury', 'joya@example.com', '+8801933333333', hash('password123')).lastInsertRowid;

// ---------- Emergency services (across divisions) ----------
const insSvc = db.prepare(
  `INSERT INTO emergency_services (name, type, phone, address, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?)`
);
const services = [
  ['Ramna Fire Station', 'fire_service', '102 / +880-2-223355566', 'Ramna, Dhaka', 23.7350, 90.3970],
  ['Tejgaon Fire Station', 'fire_service', '102 / +880-2-9111000', 'Tejgaon Industrial Area, Dhaka', 23.7590, 90.4000],
  ['Ramna Model Thana', 'police_station', '999', 'Ramna, Dhaka', 23.7310, 90.3995],
  ['Shahbagh Police Station', 'police_station', '999', 'Shahbagh, Dhaka', 23.7390, 90.3930],
  ['DWASA Head Office', 'wasa', '+880-2-223388777', '98 Kazi Alauddin Rd, Dhaka', 23.7509, 90.3936],
  ['LGED Dhaka Division', 'lged', '+880-2-55667788', 'LGED Bhaban, Agargaon, Dhaka', 23.7620, 90.3880],
  ['DESA Distribution Office', 'desa', '16999', 'DESA Bhaban, Ma Sherani Rd, Dhaka', 23.7580, 90.3910],
  ['Titas Gas Head Office', 'titas_gas', '165', 'Kawran Bazar, Dhaka', 23.7500, 90.3990],
  ['Public Toilet - Shahbagh', 'public_toilet', '+8801811000001', 'Shahbagh Square, Dhaka', 23.7385, 90.3925],
  ['Public Toilet - Suhrawardy Udyan', 'public_toilet', '+8801811000002', 'Suhrawardy Udyan, Dhaka', 23.7365, 90.3960],
  ['Khulna Fire Station', 'fire_service', '102', 'Khulna', 22.8103, 89.5626],
  ['Sonadanga Police Station', 'police_station', '999', 'Sonadanga, Khulna', 22.8285, 89.5376],
  ['Khulna WASA Office', 'wasa', '+880-241-777777', 'Mujgunni, Khulna', 22.8200, 89.5480],
  ['Public Toilet - Shiromoni Point', 'public_toilet', '+8801811000003', 'Shiromoni, Khulna', 22.8122, 89.5521],
  ['Chattogram Fire Service HQ', 'fire_service', '102', 'Agrabad, Chattogram', 22.3287, 91.8123],
  ['Kotwali Police Station', 'police_station', '999', 'Kotwali, Chattogram', 22.3378, 91.8421],
  ['Sylhet Fire Station', 'fire_service', '102', 'Chowhatta, Sylhet', 24.8974, 91.8703],
  ['Rajshahi Fire Station', 'fire_service', '102', 'Saheb Bazar, Rajshahi', 24.3716, 88.6094],
  ['Barishal Fire Station', 'fire_service', '102', 'Sadar Road, Barishal', 22.7029, 90.3703],
  ['Rangpur Fire Station', 'fire_service', '102', 'Jahaj Company More, Rangpur', 25.7466, 89.2517],
  ['Mymensingh Fire Station', 'fire_service', '102', 'Chorpara, Mymensingh', 24.7539, 90.4025]
];
for (const s of services) insSvc.run(...s);

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
  'Road Bazar Road, Savar Bazar, Savar Pouroshova, Dhaka, Dhaka, Bangladesh'
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

console.log('Nationwide seed complete:');
console.log('  Authorities : 24 (all 8 divisions: Dhaka, Chattogram, Khulna, Rajshahi, Sylhet, Barishal, Rangpur, Mymensingh)');
console.log('  Staff       : 1 general officer per authority (password: staff123)');
console.log('                e.g. kamrul.city@nagorik.bd (Dhaka South), staff.khulna@nagorik.bd (Khulna)');
console.log('  Citizens    : rahim@example.com / karima@example.com / joya@example.com  (password: password123)');
console.log(`  Services    : ${services.length} emergency services across divisions`);
console.log(`  Complaints  : ${db.prepare('SELECT COUNT(*) n FROM complaints').get().n}`);
