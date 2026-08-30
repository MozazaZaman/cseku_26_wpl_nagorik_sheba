# Nagorik Sheba

**An Agentic Web and Mobile Platform for Transparent Municipal Complaint Management with Citizen Participation**

Nagorik Sheba (নাগরিক সেবা — "Citizen Service") is a multi-agent AI civic complaint platform built for Bangladesh's local government structure. Citizens report local problems — roads, water, electricity, gas, sanitation, streetlights, drainage — through a website, mobile app, or SMS. A pipeline of AI agents verifies, classifies, and prioritizes each report before routing it to the correct government department's dashboard.

> Course project — Web Programming and Mobile Application Development, Dept. of CSE.
> Status: **Week 1 — Initiation & SRS**
> Status: **Week 2 — Created UI wireframes, architecture (ER diagrams, flowcharts, Use Case Diagram), Configured GitHub Projects board for task allocation**
> Status: **Week 3 — Development Sprint 1 (Branch 0.3 — Production Ready)**

---

## Why this project

Existing government complaint systems in the region (e.g. Pakistan Citizen's Portal, India's CPGRAMS/Swachhata, Indonesia's LAPOR!) prove the model works at national scale, but none are built specifically around Bangladesh's three-tier local government structure (City Corporation / Pourashava / Union Parishad) or use an agentic pipeline for automated verification and prioritization instead of manual triage alone. Nagorik Sheba is scoped to that gap.

## Core features

- **Citizen complaint submission** — web, mobile, and SMS channels; text/voice input, photo evidence, GPS location
- **5-agent AI pipeline** — Moderation → Classification → Verification → Priority → Routing (deterministic), each with a rule-based fallback so the system works without a live LLM API
- **Jurisdiction resolution** — GPS coordinate resolved to ward / City Corporation / Union Parishad via the Barikoi API before department routing
- **Department dashboards** — role-based, one department sees only its own queue, priority-sorted
- **Duplicate & abuse prevention** — location+category locking, complaint search, community endorsement ("similar complaint" voting)
- **Public toilet locator** — location + citizen-sourced cleanliness ratings
- **Emergency directory** — nearest fire service stations with click-to-call, plus national emergency numbers
- **Transparency layer** — public complaint feed, ward-level department scorecards, resolution-photo requirement

See [`docs/Nagorik_Sheba_SRS_v0.1.docx`](docs/Nagorik_Sheba_SRS_v0.1.docx) for the full Software Requirements Specification.

## What is implemented (v1.1)

| Feature | Status |
|---|---|
| Face-verified citizen registration | ✅ Working |
| Phone + email login | ✅ Working |
| 5-agent complaint pipeline | ✅ Working |
| Voice input (Bangla + English) | ✅ Working |
| GPS routing to nearest authority | ✅ Working |
| Nationwide coverage (8 divisions, 64 districts, 4,880 authorities) | ✅ Working |
| Map layers (Map / Satellite / Dark) | ✅ Working |
| Staff priority dashboard + ETA tracking | ✅ Working |
| Voting and duplicate detection (250m radius) | ✅ Working |
| Notifications (auto-delete after 90 days) | ✅ Working |
| Emergency services directory (355 services) | ✅ Working |
| React 18 web frontend | ✅ Working |
| Flutter mobile app | ✅ Scaffolded |
| Open issues tracked | 31 open |

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express, SQLite (WAL mode) |
| Auth | JWT, bcryptjs, Face verification (face-api.js + TensorFlow WASM) |
| File uploads | Multer |
| Image processing | exifr (EXIF), sharp (perceptual hashing) |
| Geo | OpenStreetMap + Nominatim geocoding + Leaflet.js |
| Web Frontend | React 18, Vite, Tailwind CSS, Framer Motion |
| Mobile | Flutter (Android + iOS), Material 3 |
| Voice Input | Web Speech API (Bangla + English) |
| AI Agents | Rule-based pipeline with Claude API fallback |
| Maps | OpenStreetMap tiles (Map / Satellite / Dark layers) |

## Project structure

```
nagorik-sheba/
├── server/              # Node.js + Express + SQLite REST API
│   ├── src/
│   │   ├── index.js     # Main server entry point
│   │   ├── db.js        # SQLite database setup
│   │   ├── seed.js      # Database seeding script
│   │   ├── routes/      # auth, complaints, services
│   │   └── agents/      # 5-agent pipeline + face verification
│   ├── models/          # TensorFlow face detection models
│   └── data/            # SQLite database file
├── web/                 # React 18 web frontend
│   ├── src/             # React components
│   └── config/
├── mobile/              # Flutter mobile app
│   ├── lib/             # Dart source code
│   ├── android/
│   └── ios/
├── docs/                # ER diagrams, Mermaid flowcharts, SRS
├── uploads/             # Complaint photos + face images
└── README.md
```
## Getting started

```bash
# Backend
cd server
npm install
npm run seed     # seeds 4,880 authorities + 355 emergency services
npm run dev      # starts API on localhost:3000

# Web frontend
cd web
npm install
npm run dev      # starts React app on localhost:5173

# Mobile
cd mobile
flutter pub get
flutter run
```
## Demo accounts

**Citizen accounts**
- `rahim@example.com` / `password123`
- `karima@example.com` / `password123`

**Staff accounts**
- Dhaka South City Corp: `kamrul.city@nagorik.bd` / `staff123`
- Khulna City Corp: `staff.khulna@nagorik.bd` / `staff123`
- Savar Pouroshova: `jamal.savar@nagorik.bd` / `staff123`
- Ruhitpur Union Parishad: `ripon.union@nagorik.bd` / `staff123`

## Team (Week 1)

| Member |
|---|
| Mozaza-Al-Zaman | 
| Md. Tawfiqul Islam | |

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for branch naming, commit conventions, and PR review rules.

## Acknowledgements

We would like to express our sincere gratitude to the following individuals,
tools, and organizations whose support and resources made this project possible.

**Academic Supervision**
- We are deeply grateful to **Dr. Kazi Masudul Alam**, Professor, CSE
  Discipline, Khulna University, Khulna, for supervising this project as part
  of the *Web Programming and Mobile App Development* course. His guidance,
  critical feedback, and high expectations pushed us to think beyond
  conventional project ideas and build something with real-world impact for
  the people of Bangladesh.

**Institution**
- **Khulna University, CSE Discipline, Khulna** 

**Team**
- **Mozaza** — AI pipeline design, backend architecture, ER diagram, system
  flowchart, and project documentation.
- **Md. Tawfiqul Islam** — Frontend development, UI wireframes, database
  schema design, and use case diagrams.

**Tools and Technologies**
- [FastAPI](https://fastapi.tiangolo.com/) — Backend API framework
- [Next.js](https://nextjs.org/) — Citizen and staff frontend framework
- [PostgreSQL](https://www.postgresql.org/) + [PostGIS](https://postgis.net/)
  — Spatial database for GPS-based complaint routing
- [Leaflet.js](https://leafletjs.com/) — Open-source map rendering
- [OpenStreetMap](https://www.openstreetmap.org/) — Free map tile provider
- [HuggingFace Transformers](https://huggingface.co/) — NLP model for
  complaint text classification
- [Barikoi API](https://barikoi.com/) — Bangladesh-specific geocoding and
  address resolution
- [Cloudinary](https://cloudinary.com/) — Cloud-based photo storage and
  delivery
- [GitHub](https://github.com/) — Version control, project board, and
  collaborative development

**Inspiration**
- Inspired by the civic technology movement in South Asia and the urgent need
  for transparent, accountable, and AI-assisted public service delivery in
  Bangladesh.
- Referenced [SeeClickFix](https://seeclickfix.com/) and
  [FixMyStreet](https://www.fixmystreet.com/) as global precedents for
  citizen-driven civic complaint platforms.

**Open Source Community**
- We acknowledge the broader open-source community whose freely available
  libraries, datasets, and documentation made the development of this
  application significantly more accessible for a two-person university team.

## Roadmap


- [x] **Week 1 — Initiation & SRS** — scope, objectives, roles, SRS draft, GitHub setup
- [x] **Week 2 — Design & Planning** — UI wireframes, ER diagram, flowcharts, GitHub Projects board
- [x] **Week 3–4 — Development Sprint 1** — authentication, 5-agent pipeline, React web frontend, Flutter mobile, face verification, database seeding
- [ ] **Week 5–6 — Development Sprint 2** — CRUD operations, forms, full API integration, sprint retrospectives

## License

TBD (course project — add a license before any public/production use).
