# Nagorik Sheba

**An Agentic Web and Mobile Platform for Transparent Municipal Complaint Management with Citizen Participation**

Nagorik Sheba (নাগরিক সেবা — "Citizen Service") is a multi-agent AI civic complaint platform built for Bangladesh's local government structure. Citizens report local problems — roads, water, electricity, gas, sanitation, streetlights, drainage — through a website, mobile app, or SMS. A pipeline of AI agents verifies, classifies, and prioritizes each report before routing it to the correct government department's dashboard.

> Course project — Web Programming and Mobile Application Development, Dept. of CSE.
> Status: **Week 1 — Initiation & SRS**

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

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express, SQLite (`better-sqlite3`) |
| Auth | JWT, bcryptjs |
| File uploads | multer |
| Image processing | `exifr` (EXIF), `sharp` (perceptual hashing) |
| Geo | OpenStreetMap (map tiles) + Barikoi API (ward/zone jurisdiction resolution) — documented upgrade path to PostgreSQL + PostGIS |
| Website | Plain HTML5 / CSS3 / JS, no framework, mobile-first responsive |
| Mobile (planned) | Expo / React Native |
| SMS | Twilio (prototype) → BD-licensed aggregator (production) |
| AI agents | Claude API, with local rule-based fallback per agent |

## Project structure

```
nagorik-sheba/
├── backend/          # Express API, agent pipeline, SQLite DB
├── website/          # Citizen + staff web app (no build step)
├── mobile/           # Expo app (to be rebuilt — see docs/SRS.md §2.4)
├── docs/
│   ├── Nagorik_Sheba_SRS_v0.1.docx   # Software Requirements Specification
│   ├── tasks.md                      # Sprint backlog / task list
│   ├── architecture.md               # (Week 2)
│   └── api-contract.md               # (Week 2)
└── README.md
```
## Getting started

```bash
# Backend
cd backend
npm install
npm run dev          # starts API on localhost:3000

# Website
cd website
# no build step — open index.html or serve with any static server
npx serve .
```

Demo staff accounts (seeded departments): phone `0188000000`–`0188000006`, password `staffpass123`.

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

- [x] **Week 1 — Initiation & SRS**: scope/objectives/roles, SRS draft, GitHub repo + contribution guidelines, README + initial task list
- [ ] **Week 2 — Design & Planning**: UI wireframes, architecture documentation (ER diagrams, flowcharts), GitHub Projects board
- [ ] **Week 3–4 — Development Sprint 1**: core modules (auth, navigation, basic UI), Copilot-assisted scaffolding, unit tests, PR-based peer review
- [ ] **Week 5–6 — Development Sprint 2**: CRUD operations, forms, API integration, sprint velocity tracking, retrospectives

## License

TBD (course project — add a license before any public/production use).
