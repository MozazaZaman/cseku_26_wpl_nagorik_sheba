# Nagorik Sheba — API Server

**Purpose:** Express + SQLite backend that powers the Nagorik Sheba platform. Handles auth, face verification, 5-agent complaint pipeline, authority routing, and emergency services; serves the built web client in production as a single service on `http://localhost:5000`.

**Tech:** Node 22 / Express 5, `better-sqlite3` (WAL, `data/nagorik.db`), JWT, `multer`, `@vladmandic/face-api` (WASM) + `@napi-rs/canvas` + models in `models/`, `bcryptjs`.

**Key Functionality:**
*   **Auth & Face Verification (`src/routes/auth.js`, `src/agents/faceEngine.js`):** `POST /api/auth/register` requires `selfie` + `id_photo` (multipart, `10MB` limit, `image/*` + extension check). `faceEngine.js` loads `tinyFaceDetector/faceLandmark68/faceRecognition` models, detects faces with 3 attempts (`512/0.25`, `416/0.3`, `320/0.3`), Euclidean distance threshold `0.62` (strict `0.55`, borderline allow `≤0.68` for NID quality). Logs to `agent_logs`.
*   **Complaint Pipeline (`src/routes/complaints.js`, `src/agents/pipeline.js`):** 5 agents — `agentVerify` (description + image), `agentClassify` (weighted Bangla/English + Roman transliterations like `rasta`→`road`, `pani`→`water`), `agentFindDuplicate` (250m radius), `agentRank` (votes+severity+age), `agentRoute` (citizen-selected `authority_id` wins; else GPS: reverse-geocode via public Nominatim `accept-language=en` to get district/upazila/village, try `UNION/Pouro/CC` match, fallback to haversine nearest). Stores `full_address` as pinned place name for GPS (so staff sees `Raypara, Khulna…` not just org).
*   **Authorities (`src/index.js`, `src/seed.js`):** Seeded strictly from `uploads/bangladesh_local_government_units.json` (12 CC + 328 Pourashava + 4540 Unions = 4880). `GET /api/authorities?district=&type=&upazila=`, `/authorities/types?district=`, `/authorities/upazilas?district=`, `/lg/units`. Each authority has one `general` staff (`staff123`; 12 legacy CC emails like `staff.khulna@nagorik.bd` preserved, others `type.district.id@nagorik.bd`). `GET /complaints/staff/queue` filters by `authority_id`.
*   **Geocoding/Reverse (`src/index.js`):** `GET /api/geocode?q=` and `GET /api/reverse?lat&lng` proxy public Nominatim with `User-Agent: NagorikSheba/1.0` and 24h cache; Google Geocoding used if `GOOGLE_GEOCODE_KEY` set.
*   **Emergency Services (`src/routes/services.js`, `src/seed.js`):** Seeded from osmium extracts `uploads/bangladesh_fire/police/toilets/wasa_desa_lged.json` (355 services with accurate osmium lat/lng). `GET /services/nearby?lat&lng&type=&radius=` sorts by haversine, optional OSRM routing in web.
*   **Other:** `GET /api/geo` (divisions/districts), `GET /api/stats`, `GET /api/health`, notifications (90-day auto-delete via `cleanupOldNotifications()`), `POST /complaints/:id/vote`, `PATCH /complaints/:id/status` (staff).

**Characteristics:**
*   Single SQLite file `data/nagorik.db` (9 tables + `authorities.upazila` migration), `initDb()` + `initFaceEngine()` on boot (~10s first load).
*   Stateless `dist/` serving for production; CORS enabled; `WAL` mode; `uploads/` and `uploads/faces/` static.
*   No GeoJSON used for Report custom address — only LG JSON; GeoJSON/osmium only for Emergency.

**Run:**
```powershell
npm install
npm run dev    # node --watch src/index.js → http://localhost:5000 (serves web/dist if built)
node src/seed.js --force  # reseed 4880 authorities + 4880 staff + 355 services (uses LG JSON + osmium extracts)
```

**Structure:** `src/{index.js,db.js,seed.js,routes/{auth,complaints,services}.js,agents/{pipeline,faceEngine}.js,utils/geo.js}`, `data/bd-geo.json`, `models/`, `uploads/`.
