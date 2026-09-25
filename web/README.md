# Nagorik Sheba — Web Client

**Purpose:** React-based frontend for the Nagorik Sheba municipal complaint platform. Provides citizen and staff interfaces for reporting, tracking, voting, and resolving local-government issues (City Corporation / Pourashava / Union Parishad) with GPS/custom-address location, OSM maps, and i18n (English/Bangla).

**Tech:** React 18 + Vite 5 + React Router + Framer Motion + Tailwind + Leaflet (`MapPanel.jsx`) + Axios (`lib/api.js` with `baseURL: '/api'` proxied to the API server).

**Key Functionality:**
*   **Auth:** Face-verified registration (selfie + ID card via in-app camera/webcam), login, role-based routing (citizen/staff).
*   **Report Issue (`pages/Submit.jsx`):** Two modes — `Use GPS` (auto-locate, drag pin) and `Custom Address` (cascading `Division → District → Local Govt Type → [Upazila → Union] / Pourashava / City Corp` driven strictly from `uploads/bangladesh_local_government_units.json` via `GET /authorities/types?district=` + `/authorities/upazilas?district=` + `/authorities?district=&type=&upazila=`; for Unions an extra Upazila dropdown filters unions). Builds 4 Nominatim fallback queries + `authority.center` fallback, shows preview on Leaflet map. Submits `FormData` to `POST /complaints` (routed by citizen-selected `authority_id` or GPS nearest).
*   **Explore / Complaint Detail:** Browse, search, filter by category/status, sort by recent/priority/votes, vote support, view `full_address` (GPS pins show reverse-geocoded place name, not just org name), status history, and 5-agent trace.
*   **Emergency (`pages/Emergency.jsx`):** Uses `GET /services/nearby?lat&lng&type` (osmium-seeded services) + `GET /reverse?lat&lng` (Nominatim) for accurate nearby list and map, OSRM directions polyline.
*   **Other:** Dashboard, notifications (90-day auto-delete), i18n toggle (312 strings, `lib/i18n.jsx`), responsive design, burger menu.

**Characteristics:**
*   Production SPA served by the API server (`server/src/index.js` serves `web/dist`). In dev, Vite runs on `http://localhost:3000`/`5173` and proxies `/api` to `http://localhost:5000`.
*   Stateless JWT auth (`localStorage ns_token`), role guards, and agent-log transparency.
*   No direct Nominatim calls from browser — all geocoding via server proxy with `User-Agent: NagorikSheba/1.0`.

**Run:**
```powershell
npm install
npm run dev     # http://localhost:3000 (needs server on :5000)
npm run build   # outputs web/dist (served at http://localhost:5000/ in production)
```

**Structure:** `src/pages/` (Submit, Explore, Detail, Emergency, Dashboard, Login/Register), `src/components/MapPanel.jsx`, `src/lib/{api.js,i18n.jsx}`, `src/store/auth.jsx`, `src/data/bd-geo.json` (fallback divisions).
