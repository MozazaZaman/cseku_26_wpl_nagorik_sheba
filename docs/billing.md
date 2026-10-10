# Nagorik Sheba — Institutional Billing (B2G SaaS) Module

Per-seat licensing for Local Government Institutions (City Corporation /
Pouroshova / Union Parishad). Citizens stay completely free. This module is a
**separate extension**: it adds tables, routes, pages and screens, and only
touches existing code at four guarded points (router mount, two staff-write
gates, deactivated-staff login block).

## Original architecture & integration points used

- Express ESM API (`server/src/index.js` mounts `/api/billing` → `src/routes/billing.js`).
- SQLite + `initDb()`/`migrate()` in `src/db.js`; billing schema added via
  `src/billing/schema.js:migrateBilling()` (idempotent `CREATE TABLE IF NOT
  EXISTS` + `addColumn`), following the repo's own migration convention.
- JWT auth (`src/middleware/auth.js`): `users.role='super_admin'` flows through
  login + `/auth/me` untouched; staff JWT unchanged.
- Notifications via `notify()` (`type='billing'`, null complaint) — surfaced by
  the existing web bell and mobile `NotificationBell`; 90-day expiry preserved.
- `staff_role` free text: new `'admin'` (LGI Technical Admin). Unknown roles
  fall into the read-only default queue (`queueForRole`), so nothing breaks.
- Seeded staff/accounts/data untouched; grandfathering (below) keeps demos working.

## Money & seats (source of truth)

- All money in **minor units** (paisa for BDT). Frontend never prices anything.
- `paid_seats` (subscription) − `active staff rows` − `reserved` (approved/
  in-payment seat requests) = `available`. Reservations consume capacity;
  pending financial approval does **not** create capacity.
- Seat states: active staff row = 1 seat; rejected/cancelled/expired = 0;
  deactivation releases immediately; reactivation re-checks capacity.
- Concurrency: `BEGIN IMMEDIATE` transactions on reserve/activate/finalize paths.
- Invoices immutable once issued (price snapshots in `lines_json`); adjustments
  are new records (refunds), never edits.

## Grandfathering & suspension policy

- Authority **without** a subscription row = `legacy` mode: everything works
  exactly as before (all 24k seeded staff, demos, citizen flows).
- `ACTIVE` (or expired-but-in-grace) = full staff writes.
- Past grace / `SUSPENDED` / `CANCELLED` = staff **workflow/status writes**
  blocked with HTTP 402 + message; login, reads, billing, renewals, citizens,
  and the public agent pipeline are **never** blocked. No data deleted.
- Renewal with fewer seats than active staff is rejected explicitly (deactivate
  or top up first — no silent invalidation).

## Roles & permissions

Citizens and regular staff (junior/senior/WIT/field) see **no billing UI at
all** — their accounts are byte-for-byte the pre-billing experience, free
forever. Onboarding (`/onboarding`) and staff join (`/staff-join`) pages exist
at direct URLs (shared by super-admin/mayor with the LGI representative) but
are linked nowhere in citizen/staff navigation.

| Capability | Super Admin | Mayor / Chairman | Technical Admin | Others |
|---|---|---|---|---|
| Citizen ⇄ super_admin session switch (own account) | ✅ | — | — | — |
| Verify orgs, map authorities, manage plans & prices | ✅ | — | — | — |
| Create LGIs, appoint admins, create/remove staff anywhere | ✅ | — | — | — |
| Purchase, pay, renew; approve/reject seat buys; invoices & receipts | — (platform-wide view) | ✅ | — | — |
| Create staff (name/email/password/role), assign roles & departments, reset passwords, deactivate/reactivate | ✅ any org | — | ✅ own org (never mayors) | — |
| View own-org billing & seat capacity | — | ✅ | — | — |
| Create/submit/cancel seat requests (approve = mayor) | — | — | ✅ | — |
| Appoint LGI admin; verify bank receipts; refunds; audit; analytics; CSV exports | ✅ | — | — | — |

Manual settlement methods (demo): `bank`, `bkash`, `nagad`, `rocket` + sender
account/TrxID, recorded on the evidence row and shown to reviewers.

Tenant rule: staff are pinned to their DB `authority_id`; client-supplied org
ids are ignored (tested). Super admin scopes via `?authority_id=` (audited).

## Key API routes (`/api/billing`)

Public: `GET /plans`, `POST /quote`, `POST /onboarding`, `POST /staff-requests`,
`POST /webhooks/sslcommerz` (gateway only, verified server-to-server).
Auth: `POST /api/auth/mode` (flag-holders switch citizen ⇄ super_admin).
Org (mayor-only unless noted): `/summary`, `/seats`, `/seat-requests…`,
`/invoices…`, `/checkout`, `/payments…`, `/payments/:id/reconcile`,
`/manual-evidence`, `/subscriptions/:id/renew`, `/staff…` (directory,
create, update, reset-password, deactivate/reactivate — admin+mayor).
Super admin: `/organizations…`, `/plans…`, `/txn`, `/export/*.csv`,
`/gateway/status`, `/analytics/summary`, `/audit`, `/manual-queue`,
`/manual/:id/verify|reject`, `/refunds…`, `/subscriptions/:id/status`.

## State machines

- Subscription: PENDING → ACTIVE ⇄ RENEWAL_PENDING → EXPIRED → (grace) →
  SUSPENDED ⇄ ACTIVE; CANCELLED terminal-ish (audited).
- Seat request: REQUESTED → [EMPLOYEE_VERIFICATION_PENDING] →
  AWAITING_FINANCIAL_APPROVAL → APPROVED_AWAITING_PAYMENT → PAYMENT_PENDING →
  COMPLETED (+ PAYMENT_FAILED retry loop, REJECTED/CANCELLED/EXPIRED terminals).
- Payment: CREATED → PENDING → SUCCESS | FAILED/CANCELLED/EXPIRED (+ refund states).
- Registration: pending → verified → approved → activated (+ rejected).
- Manual settlement: UNDER_REVIEW → VERIFIED | REJECTED.
- Onboarding org: SUBMITTED → UNDER_REVIEW ⇄ NEEDS_INFORMATION → VERIFIED →
  PENDING_PAYMENT → ACTIVE (+ REJECTED/SUSPENDED).

## SSLCommerz sandbox setup

1. Get sandbox `store_id` / `store_passwd` from sslcommerz.com (merchant onboarding).
2. Copy `server/.env.example` → `server/.env`, set `BILL_SSLCZ_STORE_ID`,
   `BILL_SSLCZ_STORE_PASSWD`, keep `BILL_SSLCZ_SANDBOX=true`,
   set `BILL_PUBLIC_WEB_URL` to the URL the phone/browser uses.
3. Restart the server. Checkout returns a hosted `gateway_url`; success is
   determined ONLY by server-side validation + IPN (`/api/billing/webhooks/sslcommerz`).
4. Test matrix (sandbox): success, fail, cancel, duplicate IPN (finalizes once),
   amount mismatch (rejected, no seats), reconcile-after-timeout.
5. Without credentials, checkout returns 503 `GATEWAY_NOT_CONFIGURED` — bank
   receipt upload + super-admin verification still works. Never claim live
   payments work without a merchant account + production URL + live test.

## Run / test commands

```bash
cd server
npm install
npm run seed:admin -- --email=admin@nagorik.bd --password='<8+ chars>'
npm run dev            # -> http://localhost:5000 (runs billing migrations on boot)
npm test               # vitest; billing suite: test/billing.test.js (17 tests)
cd ../web && npm install && npm run dev   # -> :3000
cd ../mobile && flutter pub get && flutter run --dart-define API_BASE=http://<pc-ip>:5000/api
```

## Files created / modified

Created: `server/src/billing/{schema,rbac,pricing,service,payments}.js`,
`server/src/routes/billing.js`, `server/scripts/{seed-admin,free-port}.mjs`,
`server/test/billing.test.js`, `server/.env.example`,
`web/src/pages/{Billing,InvoiceView,BillingReturn,Onboarding,StaffJoin,StaffAdmin,SuperAdmin}.jsx`,
`mobile/lib/screens/{billing_screen,staff_join_screen,staff_admin_screen}.dart`.
Modified: `server/src/db.js` (2-line migrate hook), `server/src/index.js`
(router mount), `server/src/routes/{complaints,auth}.js` (write gate +
deactivated-login block), `server/package.json` (`seed:admin`),
`web/src/{App.jsx,components/SideDrawer.jsx,lib/{api,i18n}.jsx}`,
`mobile/lib/{api_service,i18n}.dart`, `mobile/lib/widgets/app_drawer.dart`,
`unit_test/test/agents.test.js` (6→12 categories).

## Known limitations

- Super-admin sensitive ops (plan editing, manual verification, refunds) are
  **web-only**; mobile shows summaries + request approvals + invoice/pay status.
- Invoices/receipts are printable HTML (browser print → PDF); no PDF library
  bundled. Not presented as VAT-compliant tax documents.
- No automatic recurring charges — every payment is explicit user-initiated
  checkout (per requirements).
- unit_test/ suite was already broken at baseline (imports non-existent
  `unit_test/src/`); billing tests live in `server/test/` and pass (17/17).
- Live payments require merchant onboarding + production URL + live test (not done).

## Production-readiness checklist

- [ ] Set `JWT_SECRET`, SSLCommerz LIVE creds, `BILL_SSLCZ_SANDBOX=false`
- [ ] HTTPS + reachable IPN URL; firewall open only as needed
- [ ] Daily SQLite backups + restore drill; migration rollback = restore backup
- [ ] Create super-admin via `seed:admin` (never default passwords)
- [ ] Configure plans/prices/VAT with finance; verify invoice math
- [ ] End-to-end live test (small amount) + reconciliation drill
- [ ] Confirm institutional bank-settlement SOP + receipt reviewers assigned
- [ ] Monitor: failed webhooks, outstanding invoices, expiring subscriptions
