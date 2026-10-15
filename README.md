# Nagorik Sheba (নাগরিক সেবা) — Complete Project Description

## 1. What it is
An **agentic web + mobile platform for transparent municipal complaint management with citizen participation**, covering all **8 divisions of Bangladesh**. Any citizen can report civic problems (road, electricity, water, gas, sanitation + 7 more categories), track them through a time-bound staff hierarchy, vote on neighbors' reports, and confirm resolutions. Academic course project (Web Programming + Mobile App Development, Khulna University).

## 2. Architecture (monorepo)
- **`server/`** — Node.js + Express REST API (`/api/*`), PostgreSQL on Neon via `pg` pool, JWT auth, Cloudinary uploads, served on port 5000. Background sweeps: SLA escalation (hourly), unconfirmed-resolution auto-reopen (6-hourly), notification auto-delete (daily), rolling badges (weekly).
- **`web/`** — React 18 + Vite + Tailwind + Framer Motion + Leaflet, cinematic dark UI, Bangla/English toggle, light/dark theme.
- **`mobile/`** — Flutter (Material 3) Android/iOS app: splash → auth → bottom-nav shell (Explore / Emergency / Report FAB / Profile), voice input, camera evidence, GPS, voting, notifications with system banner + app-icon badge, staff console.
- **`unit_test/` + `server/test/`** — Vitest suites (billing: 27 passing).
- **`docs/`** — ER diagram (Mermaid + printable HTML).

## 3. Citizen features (no login needed)
Landing page with live counters, Explore/Search (text + district/area/village + category + status + priority/votes sort), Emergency-nearby map (355 seeded services: fire, police, WASA, LGED, DESA, Titas gas, public toilets — with distance, call buttons, OSRM/Google-Maps directions, Map/Satellite/Dark layers), FAQ, Leaderboard, Analysis Issues page, About Us.

## 4. Citizen accounts
Registration with **AI face verification** (live selfie + NID/Student-ID/Passport photo matched by face-api.js neural net; mismatch = rejected), login (JWT 30 days), 3-step forgot-password via email OTP (rate-limited, single-use, brute-force lockout), citizen dashboard (stats, my complaints, notifications bell with unread badge + 30s polling), voice-to-text submit in Bangla/English, photo evidence, GPS map pin, custom address picker (Division → District → Corp/Pouro/Union → ward/road/village + landmark), upvoting with lock alerts ("problem solving is in progress" when work started), merged-as-vote duplicates, resolution **confirm/dispute**, 1–5 satisfaction rating (public after resolution), voter status-update notifications.

## 5. Complaint lifecycle (12 states)
`submitted → verified → junior_review → senior_review → mayor_review → approved → wit_review → assigned → in_process → resolved` (plus `rejected`, `merged`), with per-stage owner, SLA deadlines, overdue flags, auto-forward past stalled staff, ETA on assignment, mandatory resolution photo when citizen attached evidence, citizen confirmation window with automatic reopen on silence, full timeline + status history per complaint.

## 6. Staff hierarchy (per authority)
Junior (initial check) → Senior (feasibility) → Mayor/Chairman (permission) → WIT — Work Inspection Team (inspects + assigns executor + ETA) → Field (executes). Plus Tech Admin (LGI admin/billing operator). Staff console: priority queue (overdue-first), senior/mayor oversight view, executor picker, reject-with-reason at every stage, public citizen reviews of their office, team badges + Mayor's commendations, SLA deadline badges, per-authority analytics.

## 7. The 5-agent pipeline (runs on every submission)
1. **Verifier** — spam/short-text/photo heuristics, rejects junk. 2. **Classifier** — bilingual weighted-keyword expert system (Bangla/English/romanized) into 12 categories. 3. **Duplicate checker** — 250 m haversine scan; matches become votes, in-process matches block resubmission. 4. **Priority ranker** — `votes×4 + severity×12 + freshness`, max 100, drives queue order. 5. **Destination router** — Nominatim place-name match first, then smallest containing jurisdiction box (deterministic tie-breaks), nearest-center fallback. Every decision is logged to `agent_logs` and shown publicly as the complaint's **Agent trace**. (Rule-based/deterministic by design for auditability; the learned models in the system are the face-matching nets + the Gemini citizen assistant.)

## 8. Billing / business model (citizens free, LGIs pay)
Per-seat annual licenses per authority (Standard Annual ৳50,000/seat): plans, subscriptions with expiry + grace, onboarding requests, seat top-ups with multi-stage approval, staff-join registrations, invoices, **SSLCommerz** payments (sandbox now, live-ready) **plus** manual bank/bKash/Nagad/Rocket settlement with receipt evidence and super-admin verify/reject, refunds, audit trail, business analytics, CSV exports. Guards: seat exhaustion blocks new activations (`NO_SEATS`), renewal can't go below active headcount, expired/suspended LGIs lose staff-write rights (citizens never blocked).

## 9. Engagement & trust systems
Staff achievement badges (rolling volume/satisfaction/SLA/accuracy/specialist + lifetime milestones + manual commendations), authority leaderboard, public reviews, duplicate-report lists, authority performance blocks, agent-trace transparency, 90-day notification retention.

## 10. Super Admin
Dual-mode account (citizen ⇄ super_admin, audited switches): LGI onboarding review, authority creation, staff CRUD/activate/deactivate, tech-admin appointment, plan management, subscription control, invoice/payment/refund/manual-queue verification, business dashboard, audit log.

## 11. Live data & demo accounts
**4,880 authorities** (12 City Corporations, 328 Pouroshovas, 4,540 Unions), **24,400 staff** (5 roles each, password `staff123`; e.g. `kamrul.city@nagorik.bd`, `staff.khulna@nagorik.bd`, pattern `role.district.authorityId@nagorik.bd`), citizens `rahim/karima/joya@example.com` / `password123`, super admin `superadmin@nagorik.bd`, 355 emergency services, 10 demo complaints across all workflow stages.

## 12. Deployment (live)
API on **Render** (auto-deploy from GitHub), web on **Netlify** (auto-deploy), database on **Neon PostgreSQL** (pooled app URL, persistent — survives restarts), images on **Cloudinary**, mobile via release APK (`API_BASE` → Render URL). Secrets only in dashboards + git-ignored local `.env`; push-protection clean.

## 13. Work completed on this project (this build-out)
SQLite→Neon full conversion (363 queries, async facade, timestamp normalization), Cloudinary migration (complaints/faces/receipts), Render/Netlify configs + deploy loop, secret-leak purge from git history, GPS router fix (49-box lottery → exclusive city cores + deterministic routing, applied live without wipe), pin-address fix (LGI stripped from problem addresses + 12-row backfill), seat double-count fix (+ regression test + KCC repair), email non-blocking (10–60s action latency removed), instant UI refresh (web merge + confirmations), responsive fixes (notification panel, Emergency page, centered navbar), mobile unread badge fix, full push system (banner + icon badge + in-app floater), About in navbar + mobile/web About parity, APK desugaring fix, Neon CLI/MCP/skills wiring.
