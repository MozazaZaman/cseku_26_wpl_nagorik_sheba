# Nagorik Sheba — নাগরিক সেবা

**An Agentic Web & Mobile Platform for Transparent Municipal Complaint Management with Citizen Participation.**

Nagorik Sheba is a civic complaint platform built for Bangladesh's local government structure —
City Corporation / Pourashava (municipality) / Union Parishad. Citizens report local problems —
roads, water, electricity, gas, sanitation, streetlights, drainage — through the web or the mobile
app. An autonomous **5-agent pipeline** verifies, classifies, de-duplicates, prioritizes and routes
every complaint to the correct authority's dashboard, where a five-role staff hierarchy (junior →
senior → mayor/chairman → Work Inspection Team → field executor) moves it to resolution under
time-bound SLAs. Registration is protected by **AI face verification**; similar reports become
**votes**; resolutions require photo evidence and citizen confirmation.

> Course project — Web Programming and Mobile Application Development, Dept. of CSE, Khulna University.
>
> **Status: Weeks 7–8 — Production deployment, performance, billing, notifications & citizen-engagement sprint.**
> Weeks 1–6 (SRS, wireframes, architecture, auth, agent pipeline, mobile scaffold, CRUD) are complete
> and deployed live. Details below.

---

## Why this project

Existing government complaint systems in South Asia (Pakistan Citizen's Portal, India's
CPGRAMS/Swachhata, Indonesia's LAPOR!) prove the model works at national scale, but none are built
specifically around Bangladesh's three-tier local government structure or use an agentic pipeline
for automated verification and prioritization instead of manual triage alone. Nagorik Sheba is
scoped to that gap: every stage from submission to approval is logged, time-bound and publicly
auditable.

## What is implemented (v2 — current)

| Feature | Status |
|---|---|
| 5-agent complaint pipeline (verify → classify → de-dupe → rank → route) | ✅ Working |
| Face-verified citizen registration (selfie ↔ NID/Student ID/Passport) | ✅ Working |
| 5-role staff workflow with SLA deadlines, overdue flags, auto-escalation | ✅ Working |
| Nationwide coverage — 8 divisions, 4,880 authorities, 24,400 staff accounts | ✅ Working |
| Full staff console — priority queue, executor assignment, ETA, rejects, analytics | ✅ Working |
| Citizen participation — voting, merge-as-vote, confirm/dispute resolution, 1–5 ratings | ✅ Working |
| Emergency directory — 355 services, distance, click-to-call, OSRM/Google directions | ✅ Working |
| Location search — Division → District → City Corp/Pouro/Union → ward/village picker | ✅ Working |
| Billing & seat licensing — plans, subscriptions, seat top-ups, invoices | ✅ Working |
| SSLCommerz payments + manual bank/bKash/Nagad/Rocket settlement with verification | ✅ Working |
| Super-admin console — onboarding, staff CRUD, payments/refunds verification, audit log | ✅ Working |
| Staff achievement badges, Mayor's commendations, authority leaderboard | ✅ Working |
| Firebase-style live notifications — web bell + mobile banner, tap routing, app-icon badge | ✅ Working |
| Cloudinary image pipeline (complaints, resolutions, face images, payment receipts) | ✅ Working |
| Public transparency — agent trace, department scorecards, resolution-photo evidence | ✅ Working |
| Instant UI refresh after every staff workflow action (web + mobile) | ✅ Working |
| Fully responsive web (mobile phones through desktop) | ✅ Working |
| Bangla + English UI, Web Speech voice input (Bangla + English) | ✅ Working |
| Flutter mobile app — submit, track, vote, staff console, notifications | ✅ Working |
| Automated billing test suite (27 tests) | ✅ Passing |
| Live deployment — Render (API) + Netlify (web) + Neon PostgreSQL | ✅ In production |
| SMS complaint channel | ⏳ Planned |

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express, PostgreSQL (Neon, pooled) |
| Auth | JWT, bcryptjs, face verification (face-api.js + TensorFlow WASM) |
| File uploads | Cloudinary (complaints / resolutions / faces / receipts) |
| Geo | OpenStreetMap + Nominatim geocoding + Leaflet.js, haversine duplicate scan |
| Payments | SSLCommerz + manual settlement queue |
| Web frontend | React 18 + Vite + Tailwind + Framer Motion (cinematic dark UI) |
| Mobile | Flutter (Android + iOS), Material 3 |
| Voice input | Web Speech API (Bangla + English) |
| AI agents | Deterministic rule pipeline, every decision logged for public audit |
| Citizen assistant | Gemini LLM (complaint-scoped chat) |
| Notifications | In-app bell + polling, mobile system banners + launcher badge |
| Local notifications | flutter_local_notifications + app_badge_plus (mobile) |

## Project structure

```
nagorik-sheba/
├── docs/                  # ER diagram, billing documentation
├── server/                # Node.js + Express + PostgreSQL REST API
│   ├── src/
│   │   ├── index.js       # Main server entry point (port 5000)
│   │   ├── db.js          # Neon PostgreSQL connection (async)
│   │   ├── routes/        # auth, complaints, services, notifications, workflow…
│   │   ├── billing/       # plans, seats, payments (SSLCommerz + manual)
│   │   ├── agents.js      # 5-agent pipeline
│   │   ├── faceEngine.js  # face verification engine
│   │   └── utils/         # workflow, emails, geometry, cloudinary
│   ├── scripts/           # seed helpers, geometry/address migrations
│   ├── models/            # TensorFlow face detection models
│   ├── test/              # vitest suites (billing: 27 tests)
│   └── data/              # local SQLite artifact from earlier phases (unused)
├── web/                   # React 18 + Vite + Tailwind + Framer Motion
├── mobile/                # Flutter app (Android + iOS)
├── netlify.toml           # Netlify build config (web/)
├── render.yaml            # Render deployment config (server/)
└── uploads/               # local upload fallback (production uses Cloudinary)
```

## Getting started

```bash
# Backend (local dev or production)
cd server
npm install
npm run seed     # ONE TIME ONLY - seeds 4,880 authorities + 24,400 staff + 355 services
npm run dev      # -> http://localhost:5000

# Web frontend
cd web
npm install
npm run dev      # -> http://localhost:5173

# Mobile
cd mobile
flutter pub get
flutter run      # or: flutter build apk --release --dart-define=API_BASE=<render-url>/api
```

> **Warning:** `npm run seed` wipes and re-seeds the database. It has a safety lock and refuses
> to run when the DB already has data (pass `--force` explicitly). **Never run it against a
> production database.**

### Demo accounts

**Citizen accounts** (password `password123`)
- `rahim@example.com`, `karima@example.com`, `joya@example.com`

**Staff accounts** (password `staff123`)
- Dhaka South City Corp (ID 14316): `shirin.city@nagorik.bd`, plus
  `senior|mayor|wit|field.dhaka.14316@nagorik.bd`
- Khulna City Corp (ID 14321): `staff.khulna@nagorik.bd`, plus
  `senior|mayor|wit|field.khulna.14321@nagorik.bd`
- Deluti Union Parishad (ID 16536): `junior|senior|mayor|wit|field.khulna.16536@nagorik.bd`
- Pattern for any seeded authority: `<role>.<district>.<authorityId>@nagorik.bd`
- Super admin: `superadmin@nagorik.bd` / `heisenberg14`

## The 5-agent pipeline

| Agent | Responsibility | Mechanism |
|---|---|---|
| 1. Verifier | Reject spam/empty/photo-less junk | Length, pattern, MIME and size checks |
| 2. Classifier | Categorize into 12 classes | Bilingual (Bangla/English/romanized) weighted keyword expert system |
| 3. Duplicate checker | Merge repeats into votes | 250 m haversine scan against open same-category complaints |
| 4. Priority ranker | Order staff queues | `votes×4 + severity×12 + freshness`, recomputed on every vote |
| 5. Destination router | Pick the right authority | Nominatim place-name match, then smallest containing jurisdiction box |

Every agent decision is written to an audit table and rendered on the complaint page as a public
**Agent trace**. The pipeline is deterministic by design — routing public complaints through a
nondeterministic model would be unexplainable to citizens; the learned models in the system are
the biometric face-matching nets and the Gemini citizen assistant.

## The complaint lifecycle

`submitted → verified → junior_review → senior_review → mayor_review → approved → wit_review →
assigned → in_process → resolved` (plus `rejected` and `merged` states).

- Per-stage owners, SLA deadlines, overdue flags and automatic forwarding past stalled staff.
- WIT assigns an executor + ETA; field staff must upload a resolution photo when the citizen
  attached evidence, before resolution.
- Citizens confirm or dispute the resolution within a window; silence auto-reopens with a
  second chance, then final.
- Voters and the reporter are notified at every transition (web + mobile).

## Billing & the business model

Citizens use the platform free. Local Government Institutions (LGIs) pay an annual per-seat
license (e.g. Standard Annual ৳50,000/seat):

- Super admin reviews LGI onboarding requests; approved LGIs get a plan subscription.
- Tech admins buy seats via SSLCommerz (sandbox now, live-ready) or manual bank/bKash/Nagad/Rocket
  settlement with receipt evidence, verified or rejected by the super admin.
- Staff-join registrations consume seats; seat exhaustion blocks new staff activations;
  expired/suspended LGIs lose staff-write rights (citizens are never blocked).
- Invoices + refunds + audit trail + CSV exports + business analytics for the super admin.

## Engagement & trust systems

- Staff achievement badges — rolling volume/satisfaction/SLA/accuracy/specialist + lifetime
  milestones + manual Mayor's commendations.
- Authority leaderboard & public reviews of every office by citizens they served.
- Duplicate-report lists per authority (how many reports were merges vs originals).
- Ward-level department scorecards on the complaint page.

## Super admin powers

Dual-mode account (citizen ⇄ super_admin, every switch audited): LGI onboarding review, authority
creation, staff CRUD/activate/deactivate, tech-admin appointment, plan management, subscription
control, invoice/payment/refund/manual-queue verification, business dashboard, full audit log.

## Deployment (live)

| Piece | Where | Notes |
|---|---|---|
| API | Render web service | Root dir `server`, start `node src/index.js`, auto-deploys on push to `main` |
| Database | Neon PostgreSQL | Pooled connection URL, persistent, survives restarts |
| Web | Netlify | Repo-root `netlify.toml`, base `web/`, SPA redirect, auto-deploys on `main` |
| Images | Cloudinary | Complaints, resolutions, face images, payment receipts |
| Mobile | Release APK | `flutter build apk --release --dart-define=API_BASE=<render-url>/api` |

Environment secrets live only in `server/.env` (git-ignored) and the Render dashboard:
`DATABASE_URL`, Cloudinary keys, `JWT_SECRET`, SSLCommerz sandbox keys.

## Work completed in weeks 7–8 (this sprint)

- Migrated the database from local SQLite to **Neon PostgreSQL** (~360 async queries) with safety
  lock on seed, timestamp normalization, and a regression test suite (27/27 passing).
- Moved all image storage from local disk to **Cloudinary**; deployed the API to **Render**, the
  web app to **Netlify**, purged leaked secrets from git history.
- Fixed GPS routing (exclusive city-core boxes, deterministic containment, correct union matching),
  backfilled composed addresses, verified changes live against the production database.
- Added the **billing engine** (plans, subscriptions, seat top-ups with multi-stage approval,
  invoices, SSLCommerz + manual settlement verification, refunds, audit log) and fixed a seat
  double-count bug with a regression test + production-data repair.
- Made workflow emails fire-and-forget (removed 10–60 s action latency) and added **instant UI
  refresh** after every staff action on web (state merge + confirmation flash) and mobile.
- Built live **notifications**: web bell with unread badge, mobile system banner notifications,
  app-icon badge, in-app floating banners, tap-through routing to the complaint.
- Batch of UX fixes: responsive notification panel, responsive Emergency page, centered navbar
  with About Us, mobile About page content parity with web (Bangla + English i18n keys).
- Android build fixes (core-library desugaring for notification plugins).

## Roadmap

- [x] **Week 1 — Initiation & SRS** — scope, objectives, roles, SRS draft, GitHub setup
- [x] **Week 2 — Design & Planning** — UI wireframes, ER diagram, flowcharts, GitHub Projects board
- [x] **Weeks 3–4 — Sprint 1** — authentication, face verification, 5-agent pipeline, React web, Flutter scaffold, DB seeding
- [x] **Weeks 5–6 — Sprint 2** — full workflow, voting, notifications, emergency locator, leaderboard, badges
- [x] **Weeks 7–8 — Sprint 3** — cloud migration + live deployment (Render/Netlify/Neon/Cloudinary), billing engine, seat management, payments, super-admin console, push/banner notifications, responsiveness pass
- [ ] **Next** — Firebase Cloud Messaging for background push (banner + badge without opening the app), SMS intake channel, LGI-side public dashboards, viva demo script

## Acknowledgements

We are deeply grateful to **Dr. Kazi Masudul Alam**, Professor, CSE Discipline, Khulna University,
for supervising this project as part of the *Web Programming and Mobile App Development* course.
His guidance, critical feedback, and high expectations pushed us to build something with real-world
impact for the people of Bangladesh.

**Tools and Technologies actually used in this build**

- [Express](https://expressjs.com/) — REST API framework
- [PostgreSQL](https://www.postgresql.org/) via [Neon](https://neon.tech/) — serverless spatial-aware database for complaint routing
- [React](https://react.dev/) + [Vite](https://vitejs.dev/) + [Tailwind CSS](https://tailwindcss.com/) — citizen and staff web frontend
- [Flutter](https://flutter.dev/) — Android/iOS mobile client
- [Leaflet.js](https://leafletjs.com/) + [OpenStreetMap](https://www.openstreetmap.org/) + Nominatim / [OSRM](http://project-osrm.org/) — maps, geocoding, routing
- [face-api.js](https://github.com/vladmandic/face-api) + TensorFlow WASM — biometric face verification
- [Cloudinary](https://cloudinary.com/) — cloud image storage and delivery
- [SSLCommerz](https://sslcommerz.com/) — payment gateway
- [Gemini API](https://ai.google.dev/) — citizen assistant chat
- [Render](https://render.com/) + [Netlify](https://netlify.com/) — deployment

**Inspiration**

- Inspired by the civic technology movement in South Asia; referenced
  [SeeClickFix](https://seeclickfix.com/) and [FixMyStreet](https://www.fixmystreet.com/) as global
  precedents for citizen-driven civic complaint platforms.

**Open Source Community**

- We acknowledge the broader open-source community whose freely available libraries, datasets,
  and documentation made this significantly more accessible for a two-person university team.

## Team

| Member | Contribution |
|---|---|
| Mozaza-Al-Zaman | AI pipeline design, backend architecture, billing engine, ER diagram, system flowchart, project documentation |
| Md. Tawfiqul Islam | Frontend development, UI wireframes, database schema design, deployment pipeline, use case diagrams |

## License

TBD (course project — add a license before any public/production use).
