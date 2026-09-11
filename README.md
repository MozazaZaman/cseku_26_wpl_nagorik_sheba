# Nagorik Sheba — নাগরিক সেবা

**An Agentic Web & Mobile Platform for Transparent Municipal Complaint Management with Citizen Participation.**

Any citizen can find nearby emergency services (fire service, police, WASA, LGED, DESA, Titas Gas, public toilets)
**without login**. Registration includes **AI face verification**: a live selfie + NID/Student ID/Passport photo
are compared by the Photo Verifier Agent — mismatched identities are rejected. Login stays unchanged.
An autonomous **5-agent pipeline** performs the first-pass verification, classification, de-duplication,
prioritization and routing of every complaint to the correct **City Corporation / Pouroshova / Union Parishad**
— across **all 8 divisions of Bangladesh**. Every complaint then passes through a **layered human approval
workflow** before execution, giving citizens full transparency into who is handling their problem and at what
stage. Similar reports automatically become **votes**, in-process issues are **locked**, voters receive status
updates, and the responsible staff hierarchy manages progress from first review through resolution.

## What's new in v1.2

- **Dark/Light theme system** — instant, persistent appearance toggle available from the Landing hero and
  every page's Navbar (bilingual, English/বাংলা). Selection is saved and re-applied on every page with no
  flash of the wrong theme, and all UI (including map controls and native form elements) is readable in
  both modes.
- **Layered staff workflow** — after Agent 01's first-pass AI verification, every complaint now passes
  through a 5-role human approval chain: **Junior Staff** (fake/irrelevant safety-net check) → **Senior/Mid
  Staff** (feasibility: manpower, budget, solvability) → **Mayor/Chairman** (permission) → **Work Inspection
  Team** (assigns field staff) → **Field Staff** (executes and submits resolution proof). Citizens see the
  full lifecycle on every complaint page — submission, AI verification, each human review stage (with
  officer name, role, and comment), assignment, execution, and resolution — including the stage and reason
  for any rejection.
- **Resolution proof & citizen confirmation** — field staff attach a before/after resolution photo when the
  original complaint had photo evidence; citizens then confirm or dispute the resolution. A dispute reopens
  the complaint for WIT re-inspection; an unconfirmed resolution auto-reopens after 3 days.
- **Email notifications at every step** — citizens and staff are emailed as a complaint moves through each
  stage (demo SMTP via Ethereal with preview links; swap in a real relay via `SMTP_URL`).
- **Role-based staff dashboards** — each of the 5 roles gets its own console; Senior and Mayor roles can
  toggle between "My Queue" and a full-lifecycle "All Problems" oversight view, with department-wise and
  workflow-stage filtering.

## What's new in v1.1

- **Face-verified registration** — selfie (front camera) + ID photo are matched server-side by a real biometric
  engine (face-api.js + TensorFlow WASM). No match → account rejected, try again. Login unchanged.
- **Smarter classifier** — weighted Bangla + English keyword matching ("gas leak", "gas leak hoyeche",
  "গ্যাস লিক হয়েছে" → `gas`; "street light not working" → `electricity`). 12/12 test cases pass.
- **Custom address picker** — Division → District → City Corp/Pouroshova/Union → type-specific fields
  (area/thana, ward, village, upazila, road, sector) → composed address + **", Bangladesh"** → geocoded via
  OpenStreetMap Nominatim → map preview. Landmark note still supported.
- **Nationwide coverage** — 8 divisions, 64 districts, 24 seeded authorities (every division), 21 emergency
  services. GPS submissions auto-route to the nearest authority in the country.
- **Clearer maps** — Map / Satellite / Dark layer switcher (OSM standard + Esri World Imagery).
- **Notifications auto-delete after 90 days.**
- **Voters get notified** — everyone who voted for a complaint receives its status updates.
- **Location search** — search complaints by district/area/village name in Explore.

---

## Project structure

```
nagorik-sheba/
├── docs/                  ER diagram (Mermaid + printable HTML viewer)
├── server/                Node.js + Express + SQLite REST API (agent pipeline + workflow engine)
├── web/                   React 18 + Vite + Tailwind + Framer Motion (cinematic UI, theming)
└── mobile/                Flutter app (Android/iOS client)
```

---

## 1) Run the backend API

```bash
cd server
npm install
npm run seed     # ONE TIME ONLY - creates SQLite DB + demo data
npm run dev      # -> http://localhost:5000
```

> **Important:** `npm run seed` is needed **only the first time**. All complaints, votes and accounts
> are stored permanently in `server/data/nagorik.db` and survive restarts — closing the terminal
> never deletes data. The seed script now has a safety lock: if the DB already has data it refuses
> to run unless you explicitly pass `--force` (i.e. `npm run seed -- --force`).

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Citizen | `rahim@example.com` | `password123` |
| Citizen | `karima@example.com` | `password123` |

Each of the 24 seeded authorities has a full 5-role staff hierarchy, seeded as:

```
{role}.{district}.{authorityId}@nagorik.bd
```

e.g. `junior.dhaka.2@nagorik.bd`, `senior.dhaka.2@nagorik.bd`, `mayor.dhaka.2@nagorik.bd`,
`wit.dhaka.2@nagorik.bd`, `field.dhaka.2@nagorik.bd` — password `staff123` for all staff accounts.

> **Note:** new citizen registration requires the face verification photos. The seeded demo citizens above
> were created before verification existed and login normally.

### Demo GPS coordinates for testing the router

- City Corporation area: `23.7365, 90.3985` (Shahbagh/DU area)
- Pouroshova area: `23.8580, 90.2660` (Savar)
- Union Parishad area: `23.6740, 90.2870` (Ruhitpur)

### The agent pipeline (runs on every submission)

1. **Agent 01 — Photo/Content Verifier**: first-pass rejection of spam text or invalid images. This is a
   filter, not a final approval — a human safety net (Junior Staff) re-checks for fake/irrelevant reports
   later in the workflow.
2. **Agent 02 — Classifier**: keyword AI (Bangla+English) → road / electricity / water / gas / sanitation.
   This category also determines the department-wise view in staff dashboards.
3. **Agent 03 — Duplicate Checker**: scans a 250 m GPS radius; exact-similar report = **vote** on the original;
   if the original is already *in process* → citizen sees **"The problem solving is in progress"**.
4. **Agent 04 — Priority Ranker**: score = votes × 4 + severity keywords × 12 + age.
5. **Agent 05 — Destination Router**: matches GPS against authority jurisdiction bounds.

Every AI decision is stored in `agent_logs` and shown publicly on the complaint page. Once routed, the
complaint enters the **layered staff workflow** described above, and every human decision is stored in
`workflow_steps` — together `agent_logs` + `workflow_steps` give the complete public lifecycle timeline.

---

## 2) Run the web app

```bash
cd web
npm install
npm run dev      # -> http://localhost:3000  (proxies /api to :5000)
```

Pages: cinematic landing (with theme switcher) · explore/search/upvote · emergency nearby (map) ·
login/register · citizen dashboard (stats, notifications, my complaints) · submit complaint (voice input 🎤
via Web Speech API, photo upload, map pin) · complaint detail (full lifecycle timeline + agent trace +
resolution proof + confirm/dispute) · role-based staff dashboards (priority queue, workflow actions,
department/stage filtering).

## 3) Run the Flutter mobile app

> Requires the [Flutter SDK](https://docs.flutter.dev/get-started/install/windows). Check with `flutter doctor`.

```bash
cd mobile
flutter create . --platforms=android,ios --org bd.nagorik   # generates android/ ios/ folders once
flutter pub get
flutter run
```

### Point the app at your API

The API base URL lives in `lib/config.dart`:

- Android emulator default is already correct: `http://10.0.2.2:5000/api`
- Physical phone: replace with your PC's Wi-Fi IP, e.g. `http://192.168.0.105:5000/api`
  (run `ipconfig` to find it; phone and PC must be on the same Wi-Fi)

Then allow cleartext HTTP on Android — open
`android/app/src/main/AndroidManifest.xml` and add inside `<manifest>`:

```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
<uses-permission android:name="android.permission.RECORD_AUDIO"/>
<uses-permission android:name="android.permission.CAMERA"/>
<uses-feature android:name="android.hardware.camera" android:required="false"/>
```

and inside `<application ...>` add:

```xml
android:usesCleartextTraffic="true"
```

Mobile features: splash → auth → bottom-nav shell (Explore / Emergency / Report FAB / Profile),
voice-to-text (Bangla & English) via `speech_to_text`, camera photo evidence, GPS capture,
voting with lock alerts, notifications, role-aware staff console with lifecycle timeline and workflow
actions, English/বাংলা i18n.

---

## API quick reference

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | – | Create citizen account |
| POST | `/api/auth/login` | – | Login (citizen or staff; staff JWT carries `staff_role`) |
| GET | `/api/complaints?q=&category=&sort=` | optional | Public browse/search |
| GET | `/api/complaints/:id` | optional | Detail + full lifecycle timeline + agent trace |
| POST | `/api/complaints` | citizen | Submit (multipart, runs agent pipeline) |
| POST | `/api/complaints/:id/vote` | citizen | Upvote (locked once execution starts) |
| POST | `/api/complaints/:id/workflow` | staff | Unified workflow action (approve/reject/assign/start/resolve, multipart for resolution photo) |
| POST | `/api/complaints/:id/confirm` | citizen | Confirm a submitted resolution |
| POST | `/api/complaints/:id/dispute` | citizen | Dispute a resolution → reopens for WIT re-inspection |
| GET | `/api/complaints/staff/queue` | staff | Role-filtered authority queue by priority |
| GET | `/api/staff/executors` | staff (WIT) | List field staff available for assignment |
| GET | `/api/services/nearby?lat=&lng=` | – | Nearby emergency services |
| GET | `/api/stats` | – | Landing-page counters |

---

## ER Diagram

Open **`docs/er-diagram.html`** in a browser (Ctrl+P → save as PDF for your report), or read
`docs/er-diagram.md` for entity tables, cardinalities and business rules.
Mermaid source is embedded — also renders at https://mermaid.live

## Tech stack summary

- **Backend**: Node.js, Express, better-sqlite3, JWT, bcryptjs, multer, nodemailer
- **Web**: React 18, Vite, Tailwind CSS (CSS-variable theming), Framer Motion, Leaflet (dark CARTO tiles), Web Speech API
- **Mobile**: Flutter (Material 3, dark/light aware), provider, geolocator, image_picker, speech_to_text
