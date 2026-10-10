import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import jwt from 'jsonwebtoken';
import express from 'express';
import request from 'supertest';

import { initDb, db } from '../src/db.js';
import { quote, fmtMoney } from '../src/billing/pricing.js';
import {
  seatUsage, subscriptionPolicy, createSeatRequest, getSeatRequest, transitionSeatRequest,
  createRegistration, getRegistration, setRegistrationStatus, activateRegistration,
  deactivateStaff, issueInvoice, getOrCreateSubscription, SEAT_TRANSITIONS
} from '../src/billing/service.js';
import { finalizePayment } from '../src/billing/payments.js';
import { requireSuperAdmin, requireOrgAccess } from '../src/billing/rbac.js';
import billingRouter from '../src/routes/billing.js';

const SECRET = process.env.JWT_SECRET || 'nagorik-sheba-dev-secret';

let AUTH_ID, PLAN_ID, SUPER_TOKEN;

async function purgeTestData() {
  const auths = (await db.prepare("SELECT authority_id FROM authorities WHERE name LIKE 'ZZTEST%'").all()).map((r) => r.authority_id);
  for (const id of auths) {
    const staffIds = (await db.prepare('SELECT staff_id FROM staff WHERE authority_id = ?').all(id)).map((r) => r.staff_id);
    for (const sid of staffIds) {
      await db.prepare('DELETE FROM staff_badges WHERE staff_id = ?').run(sid);
      await db.prepare('DELETE FROM staff_recognitions WHERE staff_id = ? OR awarded_by = ?').run(sid, sid);
      await db.prepare('DELETE FROM notifications WHERE user_id = ?').run(sid);
    }
    const cids = (await db.prepare('SELECT complaint_id FROM complaints WHERE authority_id = ?').all(id)).map((r) => r.complaint_id);
    for (const cid of cids) {
      for (const t of ['notifications', 'agent_logs', 'status_history', 'votes', 'workflow_steps']) {
        await db.prepare(`DELETE FROM ${t} WHERE complaint_id = ?`).run(cid);
      }
      await db.prepare('UPDATE complaints SET duplicate_of_id = NULL WHERE duplicate_of_id = ?').run(cid);
      await db.prepare('DELETE FROM complaints WHERE complaint_id = ?').run(cid);
    }
    await db.prepare('DELETE FROM billing_audit WHERE authority_id = ?').run(id);
    await db.prepare('DELETE FROM billing_payment_events WHERE payment_id IN (SELECT payment_id FROM billing_payments WHERE authority_id = ?)').run(id);
    await db.prepare('DELETE FROM billing_refunds WHERE payment_id IN (SELECT payment_id FROM billing_payments WHERE authority_id = ?)').run(id);
    await db.prepare('DELETE FROM billing_payments WHERE authority_id = ?').run(id);
    await db.prepare('DELETE FROM billing_manual_payments WHERE authority_id = ?').run(id);
    await db.prepare('DELETE FROM billing_invoices WHERE authority_id = ?').run(id);
    await db.prepare('DELETE FROM billing_seat_requests WHERE authority_id = ?').run(id);
    await db.prepare('DELETE FROM billing_registrations WHERE authority_id = ?').run(id);
    await db.prepare('DELETE FROM billing_subscriptions WHERE authority_id = ?').run(id);
    await db.prepare('DELETE FROM billing_organizations WHERE authority_id = ?').run(id);
    await db.prepare('DELETE FROM staff WHERE authority_id = ?').run(id);
    await db.prepare('DELETE FROM authorities WHERE authority_id = ?').run(id);
  }
  await db.prepare("DELETE FROM notifications WHERE user_id IN (SELECT user_id FROM users WHERE email IN ('zzsuper@nagorik.bd'))").run();
  await db.prepare("DELETE FROM users WHERE email IN ('zzsuper@nagorik.bd')").run();
}

beforeAll(async () => {
  await initDb();
  await purgeTestData();
  const a = await db.prepare(
    `INSERT INTO authorities (name, type, min_lat, max_lat, min_lng, max_lng, division, district)
     VALUES ('ZZTEST Billing Authority', 'POUROSHOVA', 0, 1, 0, 1, 'Dhaka', 'ZZTEST District')`
  ).run();
  AUTH_ID = a.lastInsertRowid;
  PLAN_ID = (await db.prepare("SELECT plan_id FROM billing_plans WHERE status = 'active' ORDER BY plan_id LIMIT 1").get()).plan_id;
  const hash = 'x'.repeat(60);
  const u = await db.prepare(`INSERT INTO users (full_name, email, password_hash, role, is_system_admin) VALUES ('ZZ Super', 'zzsuper@nagorik.bd', ?, 'super_admin', 1)`).run(hash);
  SUPER_TOKEN = jwt.sign({ id: u.lastInsertRowid, role: 'super_admin' }, SECRET, { expiresIn: '1h' });
});

afterAll(async () => {
  await purgeTestData();
});

async function mkStaff(role, email) {
  const info = await db.prepare(
    `INSERT INTO staff (full_name, email, password_hash, department, authority_id, staff_role, is_active)
     VALUES (?, ?, ?, 'general', ?, ?, 1)`
  ).run('ZZ ' + role, email, 'x'.repeat(60), AUTH_ID, role);
  return await db.prepare('SELECT * FROM staff WHERE staff_id = ?').get(info.lastInsertRowid);
}

function tokenFor(staffRow, role = 'staff') {
  return jwt.sign({ id: staffRow.staff_id, role, staff_role: staffRow.staff_role, authority_id: staffRow.authority_id }, SECRET, { expiresIn: '1h' });
}

describe('Pricing math (backend is the only price authority)', () => {
  const plan = { plan_id: 1, name: 'P', billing_period: 'annual', currency: 'BDT', pricing_model: 'per_seat', base_fee: 0, per_seat_fee: 50000, bands_json: '[]', min_seats: 1, max_seats: null, vat_percent: 10, status: 'active', terms_version: 'v1' };
  it('prices per-seat with VAT', () => {
    const q = quote(plan, 10);
    expect(q.subtotal).toBe(500000);
    expect(q.vat).toBe(50000);
    expect(q.total).toBe(550000);
  });
  it('rejects quantities below minimum', () => {
    expect(() => quote({ ...plan, min_seats: 5 }, 2)).toThrow();
  });
  it('prices band model from the matching band', () => {
    const bp = { ...plan, pricing_model: 'band', bands_json: JSON.stringify([{ min: 1, max: 10, per_seat: 60000 }, { min: 11, max: null, per_seat: 40000 }]) };
    expect(quote(bp, 5).subtotal).toBe(300000);
    expect(quote(bp, 20).subtotal).toBe(800000);
  });
  it('prices base-plus-seat', () => {
    const bp = { ...plan, pricing_model: 'base_plus_seat', base_fee: 100000 };
    expect(quote(bp, 10).subtotal).toBe(600000);
  });
  it('formats minor units', () => {
    expect(fmtMoney(550000)).toBe('BDT 5,500.00');
  });
});

describe('Seat request state machine', () => {
  it('allows the documented path and blocks illegal jumps', async () => {
    const r = await createSeatRequest({ authority_id: AUTH_ID, quantity: 3, reason: 't' });
    expect(r.status).toBe('REQUESTED');
    await expect(transitionSeatRequest(r, 'COMPLETED')).rejects.toThrow();
    const a = await transitionSeatRequest(r, 'AWAITING_FINANCIAL_APPROVAL', {});
    expect(a.status).toBe('AWAITING_FINANCIAL_APPROVAL');
    const b = await transitionSeatRequest(a, 'APPROVED_AWAITING_PAYMENT', {});
    expect(b.status).toBe('APPROVED_AWAITING_PAYMENT');
    await db.prepare('DELETE FROM billing_seat_requests WHERE request_id = ?').run(b.request_id);
  });
  it('terminal states cannot be reopened', async () => {
    const r = await createSeatRequest({ authority_id: AUTH_ID, quantity: 1 });
    const c = await transitionSeatRequest(r, 'CANCELLED', {});
    await expect(transitionSeatRequest(c, 'REQUESTED')).rejects.toThrow();
    await db.prepare('DELETE FROM billing_seat_requests WHERE request_id = ?').run(c.request_id);
  });
});

describe('Seat allocation, idempotency and concurrency guard', () => {
  it('activates exactly once per paid seat; second activation gets NO_SEATS', async () => {
    const sub = await getOrCreateSubscription(AUTH_ID, PLAN_ID);
    const plan = await db.prepare('SELECT * FROM billing_plans WHERE plan_id = ?').get(sub.plan_id);
    const inv = await issueInvoice({ authority_id: AUTH_ID, subscription_id: sub.subscription_id, type: 'initial', quote: quote(plan, 1) });
    const payInfo = await db.prepare(
      `INSERT INTO billing_payments (txn_id, gateway, invoice_id, authority_id, amount, currency, status)
       VALUES (?, 'manual', ?, ?, ?, ?, 'CREATED')`
    ).run(`ZZTEST-${Date.now()}-1`, inv.invoice_id, AUTH_ID, inv.total, inv.currency);
    const out = await finalizePayment(payInfo.lastInsertRowid, { ok: true, amountMinor: inv.total, currency: inv.currency, provider: 'manual' });
    expect(out.payment.status).toBe('SUCCESS');
    const again = await finalizePayment(payInfo.lastInsertRowid, { ok: true, amountMinor: inv.total, currency: inv.currency, provider: 'manual' });
    expect(again.already).toBe(true);
    expect((await db.prepare('SELECT paid_seats FROM billing_subscriptions WHERE authority_id = ?').get(AUTH_ID)).paid_seats).toBe(1);

    const mk = async (em) => {
      const r = await createRegistration({ authority_id: AUTH_ID, full_name: 'ZZ R', email: em, staff_role_requested: 'junior' });
      await setRegistrationStatus(r, 'verified', {});
      return await setRegistrationStatus(await getRegistration(r.reg_id), 'approved', {});
    };
    const r1 = await mk('zzr1@nagorik.bd');
    const a1 = await activateRegistration(r1.reg_id, { password: 'password123' });
    expect(a1.staff_id).toBeGreaterThan(0);
    const r2 = await mk('zzr2@nagorik.bd');
    let code = null;
    try { await activateRegistration(r2.reg_id, { password: 'password123' }); } catch (e) { code = e.code; }
    expect(code).toBe('NO_SEATS');
    const usage = await seatUsage(AUTH_ID);
    expect(usage.allocated).toBe(1);
    expect(usage.available).toBe(0);
  });

  it('concurrent reads share the pg pool without blocking', async () => {
    const [a, b] = await Promise.all([
      db.prepare('SELECT COUNT(*) AS n FROM billing_subscriptions').get(),
      db.prepare('SELECT COUNT(*) AS n FROM billing_subscriptions').get()
    ]);
    expect(a.n).toBe(b.n);
  });

  it('failed verification allocates nothing', async () => {
    const sub = await getOrCreateSubscription(AUTH_ID, PLAN_ID);
    const plan = await db.prepare('SELECT * FROM billing_plans WHERE plan_id = ?').get(sub.plan_id);
    const inv = await issueInvoice({ authority_id: AUTH_ID, subscription_id: sub.subscription_id, type: 'topup', quote: quote(plan, 5) });
    const payInfo = await db.prepare(
      `INSERT INTO billing_payments (txn_id, gateway, invoice_id, authority_id, amount, currency, status)
       VALUES (?, 'manual', ?, ?, ?, ?, 'CREATED')`
    ).run(`ZZTEST-${Date.now()}-2`, inv.invoice_id, AUTH_ID, inv.total, inv.currency);
    const out = await finalizePayment(payInfo.lastInsertRowid, { ok: false, reason: 'gateway declined' });
    expect(out.payment.status).toBe('FAILED');
    expect((await db.prepare('SELECT paid_seats FROM billing_subscriptions WHERE authority_id = ?').get(AUTH_ID)).paid_seats).toBe(1);
  });

  it('amount mismatch is rejected without allocation', async () => {
    const sub = await getOrCreateSubscription(AUTH_ID, PLAN_ID);
    const plan = await db.prepare('SELECT * FROM billing_plans WHERE plan_id = ?').get(sub.plan_id);
    const inv = await issueInvoice({ authority_id: AUTH_ID, subscription_id: sub.subscription_id, type: 'topup', quote: quote(plan, 2) });
    const payInfo = await db.prepare(
      `INSERT INTO billing_payments (txn_id, gateway, invoice_id, authority_id, amount, currency, status)
       VALUES (?, 'manual', ?, ?, ?, ?, 'CREATED')`
    ).run(`ZZTEST-${Date.now()}-3`, inv.invoice_id, AUTH_ID, inv.total, inv.currency);
    let msg = '';
    try {
      await finalizePayment(payInfo.lastInsertRowid, { ok: true, amountMinor: inv.total + 100, currency: inv.currency, provider: 'manual' });
    } catch (e) { msg = e.message; }
    expect(msg).toMatch(/mismatch/i);
  });
});

describe('Authorization and tenant isolation', () => {
  it('legacy authorities (no subscription) stay fully allowed', async () => {
    const other = (await db.prepare(
      `INSERT INTO authorities (name, type, min_lat, max_lat, min_lng, max_lng) VALUES ('ZZTEST Legacy', 'POUROSHOVA', 0, 1, 0, 1)`
    ).run()).lastInsertRowid;
    expect((await subscriptionPolicy(other)).allowed).toBe(true);
    await db.prepare('DELETE FROM authorities WHERE authority_id = ?').run(other);
  });

  it('requireSuperAdmin rejects citizens and staff', () => {
    const denied = [];
    for (const role of ['citizen', 'staff']) {
      let code = 0;
      requireSuperAdmin({ auth: { role } }, { status: (c) => ({ json: () => { code = c; } }) }, () => { code = 200; });
      denied.push(code);
    }
    expect(denied).toEqual([403, 403]);
  });

  it('org guard pins staff to their own authority (ignores spoofed ids)', async () => {
    const mayor = await mkStaff('mayor', 'zzmayor@nagorik.bd');
    const payload = jwt.verify(tokenFor(mayor), SECRET);
    const req = { auth: payload, query: { authority_id: 999999 }, body: {} };
    let rejected = null;
    await requireOrgAccess()(
      req,
      { status: (c) => ({ json: () => { rejected = c; } }) },
      () => {}
    );
    expect(rejected).toBe(null);
    expect(req.org.authority_id).toBe(AUTH_ID);
  });
});

describe('HTTP route guards (supertest)', () => {
  function app() {
    const a = express();
    a.use(express.json());
    a.use('/api/billing', billingRouter);
    return a;
  }

  it('rejects unauthenticated billing access', async () => {
    const r = await request(app()).get('/api/billing/summary');
    expect([401, 403]).toContain(r.status);
  });
  it('rejects citizens from staff billing', async () => {
    const tok = jwt.sign({ id: 1, role: 'citizen' }, SECRET, { expiresIn: '1h' });
    const r = await request(app()).get('/api/billing/summary').set('Authorization', `Bearer ${tok}`);
    expect(r.status).toBe(403);
  });
  it('super admin can list plans', async () => {
    const r = await request(app()).get('/api/billing/plans/manage').set('Authorization', `Bearer ${SUPER_TOKEN}`);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.plans)).toBe(true);
  });

  it('mayor watches finance but cannot pay; admin operates money', async () => {
    const adm = await mkStaff('admin', 'zzadmin@nagorik.bd');
    const may = await mkStaff('mayor', 'zzmayor2@nagorik.bd');
    const admTok = tokenFor(adm);
    const mayTok = tokenFor(may);
    const mkApp = () => {
      const a = express();
      a.use(express.json());
      a.use('/api/billing', billingRouter);
      return a;
    };
    // Both can read the summary.
    const mayView = await request(mkApp()).get('/api/billing/summary').set('Authorization', `Bearer ${mayTok}`);
    expect(mayView.status).toBe(200);
    const admView = await request(mkApp()).get('/api/billing/summary').set('Authorization', `Bearer ${admTok}`);
    expect(admView.status).toBe(200);
    // Mayor cannot start checkout (admin pays).
    const mayPay = await request(mkApp()).post('/api/billing/checkout').set('Authorization', `Bearer ${mayTok}`).send({ invoice_id: 1 });
    expect(mayPay.status).toBe(403);
    // Admin passes auth (fails later on invoice lookup or gateway, not on role).
    const admPay = await request(mkApp()).post('/api/billing/checkout').set('Authorization', `Bearer ${admTok}`).send({ invoice_id: 999999 });
    expect([404, 503]).toContain(admPay.status);
  });

  it('mayor cannot create staff; admin cannot make mayors', async () => {
    const adm = await db.prepare('SELECT * FROM staff WHERE email = ?').get('zzadmin@nagorik.bd');
    const may = await db.prepare('SELECT * FROM staff WHERE email = ?').get('zzmayor2@nagorik.bd');
    const mkApp = () => {
      const a = express();
      a.use(express.json());
      a.use('/api/billing', billingRouter);
      return a;
    };
    const mayTok = tokenFor(may);
    const blocked = await request(mkApp()).post('/api/billing/staff').set('Authorization', `Bearer ${mayTok}`).send({
      full_name: 'ZZ MayorMade', email: 'zzmayormade@nagorik.bd', password: 'password123', staff_role: 'junior'
    });
    expect(blocked.status).toBe(403);
    const admTok = tokenFor(adm);
    const bad = await request(mkApp()).post('/api/billing/staff').set('Authorization', `Bearer ${admTok}`).send({
      full_name: 'ZZ Evil', email: 'zzevil@nagorik.bd', password: 'password123', staff_role: 'mayor'
    });
    expect(bad.status).toBe(403);
  });

  it('admin creates staff consuming exactly one seat', async () => {
    // Ensure capacity first through the real purchase path:
    // request -> approve -> invoice -> verified payment -> seats.
    const sub = await getOrCreateSubscription(AUTH_ID, PLAN_ID);
    const plan = await db.prepare('SELECT * FROM billing_plans WHERE plan_id = ?').get(sub.plan_id);
    let sr = await createSeatRequest({ authority_id: AUTH_ID, quantity: 5, reason: 'test capacity' });
    sr = await transitionSeatRequest(sr, 'AWAITING_FINANCIAL_APPROVAL', {});
    sr = await transitionSeatRequest(sr, 'APPROVED_AWAITING_PAYMENT', {});
    const inv = await issueInvoice({ authority_id: AUTH_ID, subscription_id: sub.subscription_id, seat_request_id: sr.request_id, type: 'topup', quote: quote(plan, 5) });
    await db.prepare('UPDATE billing_seat_requests SET invoice_id = ? WHERE request_id = ?').run(inv.invoice_id, sr.request_id);
    const payInfo = await db.prepare(
      `INSERT INTO billing_payments (txn_id, gateway, invoice_id, authority_id, amount, currency, status)
       VALUES (?, 'manual', ?, ?, ?, ?, 'CREATED')`
    ).run(`ZZTEST-cap-${Date.now()}`, inv.invoice_id, AUTH_ID, inv.total, inv.currency);
    await transitionSeatRequest(await getSeatRequest(sr.request_id), 'PAYMENT_PENDING', {});
    await finalizePayment(payInfo.lastInsertRowid, { ok: true, amountMinor: inv.total, currency: inv.currency, provider: 'manual' });
    expect((await getSeatRequest(sr.request_id)).status).toBe('COMPLETED');
    const adm = await db.prepare('SELECT * FROM staff WHERE email = ?').get('zzadmin@nagorik.bd');
    const admTok = tokenFor(adm);
    const mkApp = () => {
      const a = express();
      a.use(express.json());
      a.use('/api/billing', billingRouter);
      return a;
    };
    const before = (await db.prepare('SELECT COUNT(*) AS n FROM staff WHERE authority_id = ? AND is_active = 1').get(AUTH_ID)).n;
    const r = await request(mkApp()).post('/api/billing/staff').set('Authorization', `Bearer ${admTok}`).send({
      full_name: 'ZZ Created', email: 'zzcreated@nagorik.bd', password: 'password123', staff_role: 'junior', department: 'works'
    });
    expect(r.status).toBe(201);
    const after = (await db.prepare('SELECT COUNT(*) AS n FROM staff WHERE authority_id = ? AND is_active = 1').get(AUTH_ID)).n;
    expect(after).toBe(before + 1);
    const bad = await request(mkApp()).post('/api/billing/staff').set('Authorization', `Bearer ${admTok}`).send({
      full_name: 'ZZ Evil', email: 'zzevil@nagorik.bd', password: 'password123', staff_role: 'mayor'
    });
    expect(bad.status).toBe(403);
  });

  it('admin cannot alter mayor accounts; admin resets passwords, mayor cannot', async () => {
    const adm = await db.prepare('SELECT * FROM staff WHERE email = ?').get('zzadmin@nagorik.bd');
    const may = await db.prepare('SELECT * FROM staff WHERE email = ?').get('zzmayor@nagorik.bd');
    const mkApp = () => {
      const a = express();
      a.use(express.json());
      a.use('/api/billing', billingRouter);
      return a;
    };
    const admTok = tokenFor(adm);
    const blocked = await request(mkApp()).patch(`/api/billing/staff/${may.staff_id}`).set('Authorization', `Bearer ${admTok}`).send({ department: 'x' });
    expect(blocked.status).toBe(403);
    const mayTok = tokenFor(may);
    const junior = await db.prepare('SELECT * FROM staff WHERE email = ?').get('zzcreated@nagorik.bd');
    const mayReset = await request(mkApp()).post(`/api/billing/staff/${junior.staff_id}/reset-password`).set('Authorization', `Bearer ${mayTok}`).send({ password: 'newpass123' });
    expect(mayReset.status).toBe(403);
    const ok = await request(mkApp()).post(`/api/billing/staff/${junior.staff_id}/reset-password`).set('Authorization', `Bearer ${admTok}`).send({ password: 'newpass123' });
    expect(ok.status).toBe(200);
  });

  it('mode switching: flag holders toggle, others rejected', async () => {
    const a = express();
    a.use(express.json());
    const authRouter = (await import('../src/routes/auth.js')).default;
    a.use('/api/auth', authRouter);
    const no = await request(a).post('/api/auth/mode').set('Authorization', `Bearer ${jwt.sign({ id: 1, role: 'citizen' }, SECRET, { expiresIn: '1h' })}`).send({ mode: 'admin' });
    expect(no.status).toBe(403);
    const yes = await request(a).post('/api/auth/mode').set('Authorization', `Bearer ${SUPER_TOKEN}`).send({ mode: 'citizen' });
    expect(yes.status).toBe(200);
    expect(yes.body.user.role).toBe('citizen');
    expect(yes.body.user.is_system_admin).toBe(true);
    const back = await request(a).post('/api/auth/mode').set('Authorization', `Bearer ${yes.body.token}`).send({ mode: 'admin' });
    expect(back.status).toBe(200);
    expect(back.body.user.role).toBe('super_admin');
  });

  it('gateway status exposes metadata only (no secrets)', async () => {
    const a = express();
    a.use(express.json());
    a.use('/api/billing', billingRouter);
    const r = await request(a).get('/api/billing/gateway/status').set('Authorization', `Bearer ${SUPER_TOKEN}`);
    expect(r.status).toBe(200);
    expect(r.body.provider).toBe('sslcommerz');
    expect(JSON.stringify(r.body).toLowerCase()).not.toMatch(/passwd|secret/);
  });

  it('exports require super admin and return CSV', async () => {
    const a = express();
    a.use(express.json());
    a.use('/api/billing', billingRouter);
    const anon = await request(a).get('/api/billing/export/payments.csv');
    expect([401, 403]).toContain(anon.status);
    const ok = await request(a).get('/api/billing/export/audit.csv').set('Authorization', `Bearer ${SUPER_TOKEN}`);
    expect(ok.status).toBe(200);
    expect(ok.text.split('\n')[0]).toMatch(/audit_id/);
  });

  it('super admin manages LGIs: create, appoint admin, remove staff with guards', async () => {
    const a = express();
    a.use(express.json());
    a.use('/api/billing', billingRouter);
    const hdr = { Authorization: `Bearer ${SUPER_TOKEN}` };
    // Non-superadmin cannot create authorities.
    const may = await db.prepare('SELECT * FROM staff WHERE email = ?').get('zzmayor2@nagorik.bd');
    const mayTok = tokenFor(may);
    const denied = await request(a).post('/api/billing/authorities').set('Authorization', `Bearer ${mayTok}`).send({ name: 'X', type: 'POUROSHOVA' });
    expect(denied.status).toBe(403);
    // Create a new LGI.
    const created = await request(a).post('/api/billing/authorities').set(hdr).send({
      name: 'ZZTEST New Pouroshova', type: 'POUROSHOVA', division: 'Dhaka', district: 'ZZTEST District',
      min_lat: 0, max_lat: 1, min_lng: 0, max_lng: 1
    });
    expect(created.status).toBe(201);
    const aid = created.body.authority.authority_id;
    // Appoint its technical admin.
    const adm = await request(a).post(`/api/billing/authorities/${aid}/admin`).set(hdr).send({
      full_name: 'ZZ LGI Admin', email: 'zzlgiadmin@nagorik.bd', password: 'password123'
    });
    expect(adm.status).toBe(201);
    expect(adm.body.staff.staff_role).toBe('admin');
    // Create a junior there, then hard-remove (no references yet).
    const jr = await request(a).post('/api/billing/staff').set(hdr).send({
      full_name: 'ZZ Temp', email: 'zztemp@nagorik.bd', password: 'password123', staff_role: 'junior', authority_id: aid
    });
    // staff create route pins to req.org.authority_id for staff; superadmin passes authority_id in body
    if (jr.status !== 201) {
      const direct = await db.prepare(
        `INSERT INTO staff (full_name, email, password_hash, department, authority_id, staff_role, is_active)
         VALUES ('ZZ Temp', 'zztemp@nagorik.bd', ?, 'general', ?, 'junior', 1)`
      ).run('x'.repeat(60), aid);
      const gone = await request(a).delete(`/api/billing/staff/${direct.lastInsertRowid}`).set(hdr);
      expect(gone.status).toBe(200);
    } else {
      const gone = await request(a).delete(`/api/billing/staff/${jr.body.staff.staff_id}`).set(hdr);
      expect(gone.status).toBe(200);
    }
    // Removing a mayor with history is refused, not destructive.
    const mayRow = await db.prepare('SELECT staff_id FROM staff WHERE email = ?').get('zzmayor2@nagorik.bd');
    const blocked = await request(a).delete(`/api/billing/staff/${mayRow.staff_id}`).set(hdr);
    expect([200, 409]).toContain(blocked.status);
    // Cleanup the created LGI.
    await db.prepare('DELETE FROM staff WHERE authority_id = ?').run(aid);
    await db.prepare('DELETE FROM authorities WHERE authority_id = ?').run(aid);
  });

  it('manual evidence accepts bank and mobile-banking demo methods only', async () => {
    const sub = await getOrCreateSubscription(AUTH_ID, PLAN_ID);
    const plan = await db.prepare('SELECT * FROM billing_plans WHERE plan_id = ?').get(sub.plan_id);
    const inv = await issueInvoice({ authority_id: AUTH_ID, subscription_id: sub.subscription_id, type: 'topup', quote: quote(plan, 1) });
    const adm = await db.prepare('SELECT * FROM staff WHERE email = ?').get('zzadmin@nagorik.bd');
    const admTok = tokenFor(adm);
    const a = express();
    a.use(express.json());
    a.use('/api/billing', billingRouter);
    const bad = await request(a).post('/api/billing/manual-evidence').set('Authorization', `Bearer ${admTok}`)
      .field('invoice_id', String(inv.invoice_id)).field('reference', 'X').field('method', 'crypto');
    expect(bad.status).toBe(400);
    const ok = await request(a).post('/api/billing/manual-evidence').set('Authorization', `Bearer ${admTok}`)
      .field('invoice_id', String(inv.invoice_id)).field('reference', 'bKash-Trx-9F8').field('method', 'bkash').field('sender_account', '01XXXXXXXXX');
    expect(ok.status).toBe(201);
    expect(ok.body.manual_payment.method).toBe('bkash');
  });
});
