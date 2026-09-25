# Nagorik Sheba — Agent Notes

## Project location

Root: `D:\nagorik-sheba-large-update\nagorik-sheba`

Monorepo with three apps:
- `server/`   — Node.js + Express + SQLite REST API (port 5000)
- `web/`      — React 18 + Vite SPA (port 3000, proxies /api -> :5000)
- `mobile/`   — Flutter app (Android/iOS)
- `unit_test/ — Vitest suites
- `uploads/`  — Bangladesh GeoJSON boundaries + emergency service datasets

## Android build toolchain (fixed 2026-09-25)

The project's pinned Android versions were too old for Flutter 3.47.1, which enforces minimums.
Upgraded (minimal AGP 8 lane — avoids AGP 9 breaking changes that older plugins like
`camera` 0.10.5+9 may not survive):

- `android/gradle/wrapper/gradle-wrapper.properties`: Gradle 8.12 -> **8.14.3**
- `android/settings.gradle.kts`: AGP 8.7.3 -> **8.13.0**, Kotlin 2.1.0 -> **2.2.20**

Also set globally (Flutter picks Android Studio's JBR = Java 25, which breaks Gradle 8.x):
```
flutter config --jdk-dir="C:\Program Files\Java\jdk-20"
```
Java 20 is within Gradle 8.14's supported range (17-23) and AGP 8.13's (17-21).

Verified: `flutter build apk --debug` succeeds -> `build\app\outputs\flutter-apk\app-debug.apk`.
Build-Tools 35 is auto-installed (license auto-accepted) on first build.
Remaining "will soon be dropped" warnings for Gradle/AGP/Kotlin are non-blocking.

## Run commands

```bash
# Backend
cd server
npm install
npm run dev          # -> http://localhost:5000  (node --watch)

# Web
cd web
npm install
npm run dev          # -> http://localhost:3000

# Mobile
cd mobile
flutter pub get
flutter run          # API base via --dart-define API_BASE=... (see lib/config.dart)

# Unit tests (pipeline + auth + db)
cd unit_test
npm install
npx vitest run
```

## Key facts

- DB: `server/data/nagorik.db` (SQLite, WAL). Seed is one-time: `npm run seed` (refuses if data exists; `-- --force` to override). Never delete the DB.
- 5-agent pipeline lives in `server/src/agents/pipeline.js` (verify/classify/duplicate/rank/route).
- Face verification: `server/src/agents/faceEngine.js` (face-api.js + TF WASM, models in `server/models/`).
- Auth: JWT 30d, `server/src/middleware/auth.js`. Staff checked before citizens in `/login`.
- Web i18n: `web/src/lib/i18n.jsx` (~408 keys, en/bn). Mobile i18n: `mobile/lib/i18n.dart`.
- Demo accounts: citizen `rahim@example.com`/`password123`; staff `staff.<slug>@nagorik.bd`/`staff123`.

## Known issues (as of first review)

- FIXED (2026-09-25): mobile auth token bug — `ApiService._token` was an instance field, so the 6
  screen-level instances never had the JWT and sent unauthenticated requests. Now `static`; verified
  with `flutter analyze` (no issues in api_service.dart / auth_provider.dart).
- `server/.env` ships a live GEMINI_API_KEY; JWT_SECRET unset -> hardcoded fallback. Rotate + move to real secrets before any deploy.
- Dead duplicate-block branch in `server/src/routes/complaints.js` (statuses checked are excluded by the agent SQL).
- Web: no 401 interceptor; N+1 detail fetch in StaffDashboard; Landing vote counter is fabricated.
- README drift: 13 tables (not 9), ~408 i18n strings (not 312).

## Conventions

- Server is ESM (`"type": "module"`), JS only, no comments unless requested.
- No comments in code unless explicitly asked.
