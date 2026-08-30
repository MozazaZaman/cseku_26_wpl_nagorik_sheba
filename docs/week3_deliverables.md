# নাগরিক সেবা — Nagorik Sheba

## Project Status

🟢 **Sprint 1 (Weeks 3) complete** — core authentication, the full AI pipeline, the React web app, tested, and merged to `branch 0.3`.

| Phase | Weeks | Output | Status |
|---|---|---|---|
| Requirements Gathering | Week 1 | SRS v0.1 | ✅ Complete |
| Design & Planning | Week 2 | SRS v0.2 — wireframes, ER diagram, flowchart | ✅ Complete |
| Development Sprint 1 | Weeks 3 | SRS v0.3 — working system | ✅ Complete |


---

## Sprint 1 Deliverables Summary

| Module | Platform | Status |
|---|---|---|
| Face-verified Registration | Backend + Web | ✅ Complete |
| Citizen Phone/Email Login | Backend + Web | ✅ Complete |
| Staff Login + Role-based Dashboard | Backend + Web | ✅ Complete |
| 5-Agent AI Complaint Pipeline | Backend | ✅ Complete |
| GPS Location Picker + Map Pin | Web + Mobile | ✅ Complete |
| Custom Address Picker (Dropdowns) | Web + Mobile | ✅ Complete |
| OpenStreetMap + Nominatim Geocoding | Backend | ✅ Complete |
| Complaint Submission (Photo+Voice) | Web + Mobile | ✅ Complete |
| Explore + Search + Filter | Web | ✅ Complete |
| Complaint Detail + Status Timeline | Web | ✅ Complete |
| Staff Priority Queue + ETA | Web + Mobile | ✅ Complete |
| Voting System | Web + Mobile | ✅ Complete |
| Notification System (90-day) | Backend + Web | ✅ Complete |
| Emergency Services Directory | Web + Mobile | ✅ Complete |
| Bangla/English Language Toggle | Web | ✅ Complete |
| Flutter Mobile APK Build | Mobile | ✅ Complete |
| SQLite DB Seed (4,880 offices) | Backend | ✅ Complete |
| Unit Tests — AI Pipeline | Backend | ✅ Complete |
| GitHub Copilot Code Scaffolding | All | ✅ Complete |
| Peer Review via Pull Requests | All | ✅ Complete |

---

## Features

- 📍 **Two ways to report a location** — drop a GPS pin on the map, or pick Division → District → Office Type → Office Name from dropdowns
- 🤖 **5-agent AI pipeline** — every complaint is auto-verified, classified, checked for duplicates, prioritized, and routed with no manual triage
- 🪪 **Face-verified registration** — selfie vs. NID photo matching via face-api.js, no manual identity review needed
- 🗳️ **Community endorsement** — citizens can vote on existing complaints instead of filing duplicates
- 🚨 **Emergency directory** — nearest fire service, police, and WASA contacts with click-to-call
- 🌐 **Bangla + English throughout** — full language toggle, voice input in both languages
- 📊 **Staff priority queue** — complaints ranked by votes, severity, and age, with ETA tracking
- 📱 **Web for Mobile and PC** — React 18 

---

## Tech Stack

| Layer | Technology |
|---|---|
| Web Frontend | React 18, Vite, Tailwind CSS, Framer Motion, Leaflet.js |
| Mobile | Flutter (Dart), Material 3, flutter_map, geolocator, image_picker |
| Backend | Node.js, Express, JWT auth, bcryptjs |
| Database | SQLite (WAL mode) — 9 tables |
| Face Verification | face-api.js + TensorFlow WASM (server-side, no GPU) |
| Geocoding | OpenStreetMap Nominatim (24-hour server-side cache) |
| Voice Input | Web Speech API (Bangla + English) |
| AI Agents | Rule-based logic with Claude API fallback |
| Dev Tools | GitHub Copilot, GitHub Projects, Pull Request review workflow |

