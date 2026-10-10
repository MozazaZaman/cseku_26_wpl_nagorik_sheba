import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { db } from '../db.js';
import { requireAuth, requireStaff } from '../middleware/auth.js';
import { requireSuperAdmin, requireOrgAccess } from '../billing/rbac.js';
import { quote, fmtMoney } from '../billing/pricing.js';
import {
  audit, tellAuthority, tellSuperAdmins, tellStaff,
  getSubscription, seatUsage, subscriptionPolicy, getOrCreateSubscription, setSubscriptionStatus,
  createSeatRequest, getSeatRequest, transitionSeatRequest,
  createRegistration, getRegistration, setRegistrationStatus, setRegistrationPassword,
  activateRegistration, insertStaffRow, appointAdmin, removeStaff,
  deactivateStaff, reactivateStaff,
  issueInvoice, submitOnboarding, getOrganization, transitionOrganization,
  businessSummary, orgSummary
} from '../billing/service.js';
import {
  gatewayConfigured, gatewayConfig, sslczInit, sslczValidate, logPaymentEvent,
  finalizePayment, markPaymentEvent
} from '../billing/payments.js';
import { uploadsUseCloudinary, uploadBufferToCloudinary } from '../utils/cloudinary.js';
const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
fs.mkdirSync(path.join(__dirname, '..', '..', 'uploads', 'receipts'), { recursive: true });
const receiptUpload = multer({
  storage: uploadsUseCloudinary() ? multer.memoryStorage() : multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, path.join(__dirname, '..', '..', 'uploads', 'receipts')),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${path.extname(file.originalname || '') || '.jpg'}`)
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^(image\/(jpeg|png|webp)|application\/pdf)$/.test(file.mimetype || '');
    cb(ok ? null : new Error('Receipt must be a JPG, PNG, WEBP or PDF file'), ok);
  }
});

function err(res, e) {
  const status = e.status || 500;
  if (status >= 500) console.error('[billing]', e);
  res.status(status).json({ error: e.message || 'Billing error', code: e.code });
}

// ---------- Public: plans & quotes ----------

router.get('/plans', async (_req, res) => {
  const plans = await db.prepare(`SELECT * FROM billing_plans WHERE status = 'active' ORDER BY plan_id`).all();
  res.json({ plans: plans.map((p) => ({ ...p, bands: JSON.parse(p.bands_json || '[]'), features: JSON.parse(p.features_json || '[]') })) });
});

router.post('/quote', async (req, res) => {
  try {
    const plan = await db.prepare('SELECT * FROM billing_plans WHERE plan_id = ?').get(req.body?.plan_id);
    if (!plan) return res.status(404).json({ error: 'Unknown plan' });
    res.json({ quote: quote(plan, req.body?.seats) });
  } catch (e) { err(res, e); }
});

// ---------- Onboarding (any logged-in user may submit for their LGI) ----------

router.post('/onboarding', requireAuth, async (req, res) => {
  try {
    const org = await submitOnboarding(req.body || {}, req.auth?.id || null);
    res.status(201).json({ organization: org });
  } catch (e) { err(res, e); }
});

router.get('/organizations/mine', requireAuth, async (req, res) => {
  const rows = await db.prepare('SELECT * FROM billing_organizations WHERE rep_user_id = ? ORDER BY org_id DESC').all(req.auth.id);
  res.json({ organizations: rows });
});

// ---------- Public staff join request (no seat granted here) ----------

router.post('/staff-requests', async (req, res) => {
  try {
    const reg = await createRegistration(req.body || {});
    const auth = await db.prepare('SELECT name FROM authorities WHERE authority_id = ?').get(reg.authority_id);
    await tellAuthority(reg.authority_id, ['mayor', 'admin'],
      'New staff registration request',
      `${reg.full_name} (${reg.email}) requested a ${reg.staff_role_requested} account at ${auth?.name || 'your LGI'}. Verify them in the LGI admin console.`);
    res.status(201).json({ registration: reg });
  } catch (e) { err(res, e); }
});

// ---------- LGI dashboards (mayor / admin of own org) ----------

router.get('/summary', requireAuth, requireStaff, requireOrgAccess({ allow: ['mayor', 'admin'] }), async (req, res) => {
  if (!req.org.authority_id) return res.status(400).json({ error: 'No organization context' });
  res.json(await orgSummary(req.org.authority_id));
});

router.get('/seats', requireAuth, requireStaff, requireOrgAccess({ allow: ['mayor', 'admin'] }), async (req, res) => {
  if (!req.org.authority_id) return res.status(400).json({ error: 'No organization context' });
  const usage = await seatUsage(req.org.authority_id);
  res.json({ seats: { paid: usage.paid, allocated: usage.allocated, reserved: usage.reserved, available: usage.mode === 'legacy' ? null : usage.available, mode: usage.mode }, policy: await subscriptionPolicy(req.org.authority_id) });
});

router.get('/staff', requireAuth, requireStaff, requireOrgAccess({ allow: ['mayor', 'admin'] }), async (req, res) => {
  const rows = await db.prepare(
    `SELECT staff_id, full_name, email, department, staff_role, is_active FROM staff
      WHERE authority_id = ? ORDER BY is_active DESC, full_name`
  ).all(req.org.authority_id);
  res.json({ staff: rows });
});

// ---------- Registrations queue ----------

router.get('/registrations', requireAuth, requireStaff, requireOrgAccess({ allow: ['admin'] }), async (req, res) => {
  const { status } = req.query;
  let sql = 'SELECT * FROM billing_registrations WHERE authority_id = ?';
  const args = [req.org.authority_id];
  if (status && status !== 'all') { sql += ' AND status = ?'; args.push(status); }
  sql += ' ORDER BY updated_at DESC LIMIT 200';
  res.json({ registrations: await db.prepare(sql).all(...args) });
});

router.post('/registrations/:id/verify', requireAuth, requireStaff, requireOrgAccess({ allow: ['admin'] }), async (req, res) => {
  try {
    const reg = await getRegistration(req.params.id);
    if (!reg || reg.authority_id !== req.org.authority_id) return res.status(404).json({ error: 'Registration not found' });
    const out = await setRegistrationStatus(reg, 'verified', { actor_id: req.auth.id });
    if (req.body?.password) await setRegistrationPassword(out.reg_id, req.body.password, { actor_id: req.auth.id });
    res.json({ registration: await getRegistration(out.reg_id) });
  } catch (e) { err(res, e); }
});

router.post('/registrations/:id/approve', requireAuth, requireStaff, requireOrgAccess({ allow: ['admin'] }), async (req, res) => {
  try {
    const reg = await getRegistration(req.params.id);
    if (!reg || reg.authority_id !== req.org.authority_id) return res.status(404).json({ error: 'Registration not found' });
    if (!['verified'].includes(reg.status)) {
      return res.status(409).json({ error: 'Technical admin must verify this registration first' });
    }
    const out = await setRegistrationStatus(reg, 'approved', { actor_id: req.auth.id });
    // If no free seat, auto-open a linked seat request (no charge happens here).
    const usage = await seatUsage(reg.authority_id);
    let seatRequest = null;
    if (usage.mode === 'managed' && usage.available < 1) {
      seatRequest = await createSeatRequest({ authority_id: reg.authority_id, requested_by: req.auth.id, type: 'topup', quantity: 1, reason: `Seat for ${reg.full_name} (${reg.email})` });
      await db.prepare('UPDATE billing_registrations SET seat_request_id = ? WHERE reg_id = ?').run(seatRequest.request_id, reg.reg_id);
      await tellAuthority(reg.authority_id, ['mayor', 'admin'], 'No free licenses',
        `${reg.full_name} is approved but no license is free. Buy at least 1 more seat to activate them — no charge was made.`);
    }
    res.json({ registration: await getRegistration(out.reg_id), seat_request: seatRequest });
  } catch (e) { err(res, e); }
});

router.post('/registrations/:id/reject', requireAuth, requireStaff, requireOrgAccess({ allow: ['admin'] }), async (req, res) => {
  try {
    const reg = await getRegistration(req.params.id);
    if (!reg || reg.authority_id !== req.org.authority_id) return res.status(404).json({ error: 'Registration not found' });
    const out = await setRegistrationStatus(reg, 'rejected', { actor_id: req.auth.id, reason: req.body?.reason || '' });
    res.json({ registration: out });
  } catch (e) { err(res, e); }
});

router.post('/registrations/:id/activate', requireAuth, requireStaff, requireOrgAccess({ allow: ['admin'] }), async (req, res) => {
  try {
    const reg = await getRegistration(req.params.id);
    if (!reg || reg.authority_id !== req.org.authority_id) return res.status(404).json({ error: 'Registration not found' });
    const out = await activateRegistration(reg.reg_id, { actor_id: req.auth.id, password: req.body?.password || null });
    await tellStaff(out.staff_id, 'Staff account activated', `Your ${reg.staff_role_requested} account is active.`);
    res.json(out);
  } catch (e) { err(res, e); }
});

router.post('/staff/:id/deactivate', requireAuth, requireStaff, requireOrgAccess({ allow: ['admin'] }), async (req, res) => {
  try {
    const row = await db.prepare('SELECT * FROM staff WHERE staff_id = ?').get(req.params.id);
    if (!row || row.authority_id !== req.org.authority_id) return res.status(404).json({ error: 'Staff not found' });
    if (Number(req.params.id) === Number(req.auth.id)) {
      return res.status(400).json({ error: 'You cannot deactivate your own account' });
    }
    res.json({ staff: await deactivateStaff(row.staff_id, { actor_id: req.auth.id, reason: req.body?.reason || '' }) });
  } catch (e) { err(res, e); }
});

router.post('/staff/:id/reactivate', requireAuth, requireStaff, requireOrgAccess({ allow: ['admin'] }), async (req, res) => {
  try {
    const row = await db.prepare('SELECT * FROM staff WHERE staff_id = ?').get(req.params.id);
    if (!row || row.authority_id !== req.org.authority_id) return res.status(404).json({ error: 'Staff not found' });
    res.json({ staff: await reactivateStaff(row.staff_id, { actor_id: req.auth.id }) });
  } catch (e) { err(res, e); }
});

// ---------- Seat purchase requests ----------

router.get('/seat-requests', requireAuth, requireStaff, requireOrgAccess({ allow: ['mayor', 'admin'] }), async (req, res) => {
  const rows = await db.prepare('SELECT * FROM billing_seat_requests WHERE authority_id = ? ORDER BY updated_at DESC LIMIT 100')
    .all(req.org.authority_id);
  res.json({ seat_requests: rows });
});

router.post('/seat-requests', requireAuth, requireStaff, requireOrgAccess({ allow: ['admin'] }), async (req, res) => {
  try {
    const sr = await createSeatRequest({
      authority_id: req.org.authority_id, requested_by: req.auth.id,
      type: req.body?.type === 'initial' ? 'initial' : 'topup',
      quantity: req.body?.quantity, reason: req.body?.reason || ''
    });
    await tellAuthority(req.org.authority_id, ['mayor'], 'Seat purchase requested',
      `${sr.quantity} additional seat(s) requested (${sr.type}). Review and approve in Billing.`);
    res.status(201).json({ seat_request: sr });
  } catch (e) { err(res, e); }
});

router.post('/seat-requests/:id/submit', requireAuth, requireStaff, requireOrgAccess({ allow: ['admin'] }), async (req, res) => {
  try {
    const sr = await getSeatRequest(req.params.id);
    if (!sr || sr.authority_id !== req.org.authority_id) return res.status(404).json({ error: 'Request not found' });
    res.json({ seat_request: await transitionSeatRequest(sr, 'AWAITING_FINANCIAL_APPROVAL', { actor_id: req.auth.id }) });
  } catch (e) { err(res, e); }
});

router.post('/seat-requests/:id/approve', requireAuth, requireStaff, requireOrgAccess({ allow: ['mayor'] }), async (req, res) => {
  try {
    const sr = await getSeatRequest(req.params.id);
    if (!sr || sr.authority_id !== req.org.authority_id) return res.status(404).json({ error: 'Request not found' });
    if (!['AWAITING_FINANCIAL_APPROVAL', 'REQUESTED', 'EMPLOYEE_VERIFICATION_PENDING'].includes(sr.status)) {
      return res.status(409).json({ error: `Request is ${sr.status} and cannot be approved` });
    }
    const sub = await getOrCreateSubscription(sr.authority_id, req.body?.plan_id || await currentPlanId(sr.authority_id));
    const plan = await db.prepare('SELECT * FROM billing_plans WHERE plan_id = ?').get(sub.plan_id);
    const q = quote(plan, sr.quantity);
    const inv = await issueInvoice({ authority_id: sr.authority_id, subscription_id: sub.subscription_id, seat_request_id: sr.request_id, type: sr.type === 'initial' ? 'initial' : 'topup', quote: q });
    await db.prepare('UPDATE billing_seat_requests SET invoice_id = ? WHERE request_id = ?').run(inv.invoice_id, sr.request_id);
    const moved = await transitionSeatRequest(await getSeatRequest(sr.request_id), 'APPROVED_AWAITING_PAYMENT', { actor_id: req.auth.id });
    await tellAuthority(sr.authority_id, ['admin'], 'Seat purchase approved — payment needed',
      `${sr.quantity} seat(s) approved (${fmtMoney(inv.total, inv.currency)}). Invoice ${inv.invoice_no} is ready for payment.`);
    res.json({ seat_request: moved, invoice: inv });
  } catch (e) { err(res, e); }
});

router.post('/seat-requests/:id/reject', requireAuth, requireStaff, requireOrgAccess({ allow: ['mayor'] }), async (req, res) => {
  try {
    const sr = await getSeatRequest(req.params.id);
    if (!sr || sr.authority_id !== req.org.authority_id) return res.status(404).json({ error: 'Request not found' });
    res.json({ seat_request: await transitionSeatRequest(sr, 'REJECTED', { actor_id: req.auth.id, meta: { reject_reason: req.body?.reason || '' } }) });
  } catch (e) { err(res, e); }
});

router.post('/seat-requests/:id/cancel', requireAuth, requireStaff, requireOrgAccess({ allow: ['admin'] }), async (req, res) => {
  try {
    const sr = await getSeatRequest(req.params.id);
    if (!sr || sr.authority_id !== req.org.authority_id) return res.status(404).json({ error: 'Request not found' });
    res.json({ seat_request: await transitionSeatRequest(sr, 'CANCELLED', { actor_id: req.auth.id }) });
  } catch (e) { err(res, e); }
});

async function currentPlanId(authorityId) {
  const sub = await db.prepare('SELECT plan_id FROM billing_subscriptions WHERE authority_id = ?').get(authorityId);
  if (sub) return sub.plan_id;
  return (await db.prepare("SELECT plan_id FROM billing_plans WHERE status = 'active' ORDER BY plan_id LIMIT 1").get())?.plan_id;
}

// ---------- Invoices & checkout ----------

router.get('/invoices', requireAuth, requireStaff, requireOrgAccess({ allow: ['mayor', 'admin'] }), async (req, res) => {
  const rows = await db.prepare('SELECT * FROM billing_invoices WHERE authority_id = ? ORDER BY invoice_id DESC LIMIT 100').all(req.org.authority_id);
  res.json({ invoices: rows });
});

router.get('/invoices/:id', requireAuth, requireStaff, requireOrgAccess({ allow: ['mayor', 'admin'] }), async (req, res) => {
  const inv = await db.prepare('SELECT * FROM billing_invoices WHERE invoice_id = ?').get(req.params.id);
  if (!inv || inv.authority_id !== req.org.authority_id) return res.status(404).json({ error: 'Invoice not found' });
  const payments = await db.prepare('SELECT * FROM billing_payments WHERE invoice_id = ? ORDER BY payment_id DESC').all(inv.invoice_id);
  const authority = await db.prepare('SELECT * FROM authorities WHERE authority_id = ?').get(inv.authority_id);
  res.json({ invoice: { ...inv, lines: JSON.parse(inv.lines_json || '[]') }, payments, authority });
});

router.post('/checkout', requireAuth, requireStaff, requireOrgAccess({ allow: ['admin'] }), async (req, res) => {
  try {
    const inv = await db.prepare('SELECT * FROM billing_invoices WHERE invoice_id = ?').get(req.body?.invoice_id);
    if (!inv || inv.authority_id !== req.org.authority_id) return res.status(404).json({ error: 'Invoice not found' });
    if (!['issued', 'pending', 'failed'].includes(inv.status)) {
      return res.status(409).json({ error: `Invoice is ${inv.status} and cannot be paid` });
    }
    if (!gatewayConfigured()) {
      return res.status(503).json({ error: 'Online payment is not configured. Use bank transfer with receipt upload, or ask the platform administrator to enable the gateway.', code: 'GATEWAY_NOT_CONFIGURED' });
    }
    const cfg = gatewayConfig();
    const txnId = `NSB-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const payInfo = await db.prepare(
      `INSERT INTO billing_payments (txn_id, gateway, invoice_id, authority_id, amount, currency, status, paid_by)
       VALUES (?, 'sslcommerz', ?, ?, ?, ?, 'CREATED', ?)`
    ).run(txnId, inv.invoice_id, inv.authority_id, inv.total, inv.currency, req.auth.id);
    const payment = await db.prepare('SELECT * FROM billing_payments WHERE payment_id = ?').get(payInfo.lastInsertRowid);
    await logPaymentEvent(payment.payment_id, 'created', { invoice_no: inv.invoice_no });
    if (inv.seat_request_id) {
      const sr = await getSeatRequest(inv.seat_request_id);
      if (sr && ['APPROVED_AWAITING_PAYMENT', 'PAYMENT_FAILED'].includes(sr.status)) {
        await transitionSeatRequest(sr, 'PAYMENT_PENDING', { actor_id: req.auth.id });
      }
    }
    const base = cfg.publicWebUrl;
    const session = await sslczInit({
      txnId, amountMinor: inv.total, currency: inv.currency, invoiceNo: inv.invoice_no,
      customer: { name: 'LGI payer', email: req.body?.email || 'billing@nagorik.bd', phone: req.body?.phone, address: 'Bangladesh' },
      urls: {
        success: `${base}/billing/payment/${payment.payment_id}/return?status=success`,
        fail: `${base}/billing/payment/${payment.payment_id}/return?status=fail`,
        cancel: `${base}/billing/payment/${payment.payment_id}/return?status=cancel`,
        ipn: `${base.replace('http://localhost:3000', 'http://localhost:5000')}/api/billing/webhooks/sslcommerz`
      }
    });
    await markPaymentEvent(payment.payment_id, 'PENDING');
    await logPaymentEvent(payment.payment_id, 'gateway_session', { sessionKey: session.sessionKey });
    await audit('payment.checkout', { actor_id: req.auth.id, authority_id: inv.authority_id, target_type: 'payment', target_id: payment.payment_id, meta: { invoice_no: inv.invoice_no } });
    res.json({ payment_id: payment.payment_id, txn_id: txnId, gateway_url: session.gatewayUrl });
  } catch (e) { err(res, e); }
});

router.get('/payments', requireAuth, requireStaff, requireOrgAccess({ allow: ['mayor', 'admin'] }), async (req, res) => {
  const rows = await db.prepare('SELECT * FROM billing_payments WHERE authority_id = ? ORDER BY payment_id DESC LIMIT 100').all(req.org.authority_id);
  res.json({ payments: rows.map((p) => ({ ...p, raw: undefined })) });
});

router.get('/payments/:id', requireAuth, requireStaff, requireOrgAccess({ allow: ['mayor', 'admin'] }), async (req, res) => {
  const p = await db.prepare('SELECT * FROM billing_payments WHERE payment_id = ?').get(req.params.id);
  if (!p || p.authority_id !== req.org.authority_id) return res.status(404).json({ error: 'Payment not found' });
  const { raw_json, ...safe } = p;
  res.json({ payment: safe });
});

router.post('/payments/:id/reconcile', requireAuth, requireStaff, requireOrgAccess({ allow: ['admin'] }), async (req, res) => {
  try {
    const p = await db.prepare('SELECT * FROM billing_payments WHERE payment_id = ?').get(req.params.id);
    if (!p || p.authority_id !== req.org.authority_id) return res.status(404).json({ error: 'Payment not found' });
    if (p.status === 'SUCCESS') return res.json({ payment: p, reconciled: false, note: 'Already successful' });
    if (!gatewayConfigured()) return res.status(503).json({ error: 'Gateway not configured', code: 'GATEWAY_NOT_CONFIGURED' });
    const events = await db.prepare('SELECT * FROM billing_payment_events WHERE payment_id = ? ORDER BY event_id DESC').all(p.payment_id);
    const val = events.map((e) => { try { return JSON.parse(e.payload_json || '{}'); } catch { return {}; } }).find((o) => o.val_id);
    if (!val?.val_id) return res.json({ payment: p, reconciled: false, note: 'No gateway reference recorded yet — complete checkout first' });
    const v = await sslczValidate(val.val_id);
    await logPaymentEvent(p.payment_id, 'reconcile', v);
    if (v.status === 'VALID') {
      const out = await finalizePayment(p.payment_id, { ok: true, amountMinor: Math.round(Number(v.amount) * 100), currency: v.currency, gatewayTxnId: v.tran_id, provider: 'sslcommerz' }, { actor_id: req.auth.id });
      return res.json({ payment: out.payment, reconciled: true });
    }
    await markPaymentEvent(p.payment_id, 'FAILED');
    res.json({ payment: await db.prepare('SELECT * FROM billing_payments WHERE payment_id = ?').get(p.payment_id), reconciled: true, note: 'Gateway reports failure' });
  } catch (e) { err(res, e); }
});

// ---------- Gateway webhook (no auth; verified server-to-server) ----------

router.post('/webhooks/sslcommerz', async (req, res) => {
  try {
    const { val_id, tran_id, status } = req.body || {};
    if (!tran_id) return res.status(200).json({ ok: false, error: 'missing tran_id' });
    const pay = await db.prepare('SELECT * FROM billing_payments WHERE txn_id = ?').get(tran_id);
    if (!pay) return res.status(200).json({ ok: false, error: 'unknown payment' });
    await logPaymentEvent(pay.payment_id, 'ipn_received', { val_id, status });
    if (!val_id) return res.status(200).json({ ok: true, note: 'recorded, awaiting validation reference' });
    let v;
    try {
      v = await sslczValidate(val_id);
    } catch (e) {
      await logPaymentEvent(pay.payment_id, 'validation_error', { message: e.message });
      return res.status(200).json({ ok: true, note: 'validation deferred — reconcile later' });
    }
    await logPaymentEvent(pay.payment_id, 'validation_result', v);
    if (v.status === 'VALID') {
      try {
        await finalizePayment(pay.payment_id, { ok: true, amountMinor: Math.round(Number(v.amount) * 100), currency: v.currency, gatewayTxnId: v.tran_id, provider: 'sslcommerz' });
      } catch (e) {
        await logPaymentEvent(pay.payment_id, 'finalize_error', { message: e.message });
      }
    } else {
      await markPaymentEvent(pay.payment_id, 'FAILED');
      const inv = await db.prepare('SELECT * FROM billing_invoices WHERE invoice_id = ?').get(pay.invoice_id);
      if (inv?.seat_request_id) {
        try {
          const sr = await getSeatRequest(inv.seat_request_id);
          if (sr && sr.status === 'PAYMENT_PENDING') await transitionSeatRequest(sr, 'PAYMENT_FAILED', {});
        } catch {}
      }
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[billing webhook]', e.message);
    res.status(200).json({ ok: false });
  }
});

// ---------- Manual / institutional settlement ----------

router.post('/manual-evidence', requireAuth, requireStaff, requireOrgAccess({ allow: ['admin'] }), receiptUpload.single('receipt'), async (req, res) => {
  try {
    const inv = await db.prepare('SELECT * FROM billing_invoices WHERE invoice_id = ?').get(req.body?.invoice_id);
    if (!inv || inv.authority_id !== req.org.authority_id) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    if (!['issued', 'pending', 'failed'].includes(inv.status)) {
      return res.status(409).json({ error: `Invoice is ${inv.status}` });
    }
    if (!req.body?.reference?.trim()) return res.status(400).json({ error: 'Payment reference is required' });
    const method = (req.body?.method || 'bank').toLowerCase();
    if (!['bank', 'bkash', 'nagad', 'rocket'].includes(method)) {
      return res.status(400).json({ error: 'Method must be bank, bkash, nagad or rocket' });
    }
    let evidencePath = null;
    if (req.file) {
      if (uploadsUseCloudinary()) {
        try {
          const isPdf = (req.file.mimetype || '').includes('pdf');
          const up = await uploadBufferToCloudinary(req.file.buffer, {
            folder: `${process.env.CLOUDINARY_FOLDER || 'nagorik-sheba'}/receipts`,
            resourceType: isPdf ? 'raw' : 'image'
          });
          evidencePath = up.secure_url;
        } catch (e) {
          return res.status(502).json({ error: 'Receipt upload failed, please retry' });
        }
      } else {
        evidencePath = req.file.filename;
      }
    }
    const info = await db.prepare(
      `INSERT INTO billing_manual_payments (invoice_id, authority_id, reference, evidence_path, method, sender_account, status, submitted_by)
       VALUES (?, ?, ?, ?, ?, ?, 'UNDER_REVIEW', ?)`
    ).run(inv.invoice_id, inv.authority_id, req.body.reference.trim(), evidencePath,
      method, (req.body?.sender_account || '').trim(), req.auth.id);
    await audit('manual_payment.submitted', { actor_id: req.auth.id, authority_id: inv.authority_id, target_type: 'manual_payment', target_id: info.lastInsertRowid, meta: { invoice_no: inv.invoice_no, method } });
    await tellSuperAdmins('Payment evidence submitted', `Invoice ${inv.invoice_no} has new ${method} payment evidence. Review it in Finance.`);
    res.status(201).json({ manual_payment: await db.prepare('SELECT * FROM billing_manual_payments WHERE id = ?').get(info.lastInsertRowid) });
  } catch (e) { err(res, e); }
});

// ---------- Subscriptions ----------

router.post('/subscriptions/:id/renew', requireAuth, requireStaff, requireOrgAccess({ allow: ['admin'] }), async (req, res) => {
  try {
    const sub = await db.prepare('SELECT * FROM billing_subscriptions WHERE subscription_id = ?').get(req.params.id);
    if (!sub || sub.authority_id !== req.org.authority_id) return res.status(404).json({ error: 'Subscription not found' });
    const plan = await db.prepare('SELECT * FROM billing_plans WHERE plan_id = ?').get(req.body?.plan_id || sub.plan_id);
    if (!plan) return res.status(404).json({ error: 'Unknown plan' });
    const seats = parseInt(req.body?.seats ?? sub.paid_seats);
    const q = quote(plan, seats);
    const inv = await issueInvoice({ authority_id: sub.authority_id, subscription_id: sub.subscription_id, type: 'renewal', quote: { ...q, plan_id: plan.plan_id } });
    await db.prepare(`UPDATE billing_subscriptions SET status = 'RENEWAL_PENDING', plan_id = ?, updated_at = NOW() WHERE subscription_id = ?`)
      .run(plan.plan_id, sub.subscription_id);
    await audit('subscription.renewal_invoiced', { actor_id: req.auth.id, authority_id: sub.authority_id, target_type: 'subscription', target_id: sub.subscription_id, meta: { invoice_no: inv.invoice_no } });
    res.status(201).json({ invoice: inv });
  } catch (e) { err(res, e); }
});

// ---------- Super admin ----------

router.get('/organizations', requireAuth, requireSuperAdmin, async (req, res) => {
  const { status } = req.query;
  let sql = 'SELECT * FROM billing_organizations';
  const args = [];
  if (status && status !== 'all') { sql += ' WHERE status = ?'; args.push(status); }
  sql += ' ORDER BY updated_at DESC LIMIT 200';
  res.json({ organizations: await db.prepare(sql).all(...args) });
});

router.patch('/organizations/:id/status', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    let org = await getOrganization(req.params.id);
    if (!org) return res.status(404).json({ error: 'Organization not found' });
    // Match the org to the authority registry on verification (spec: org must
    // map to exactly one existing authority; duplicates are rejected).
    if (req.body?.authority_id) {
      if (!['UNDER_REVIEW', 'NEEDS_INFORMATION', 'VERIFIED'].includes(org.status)) {
        return res.status(409).json({ error: 'Authority can only be mapped while under review' });
      }
      const a = await db.prepare('SELECT authority_id, name FROM authorities WHERE authority_id = ?').get(req.body.authority_id);
      if (!a) return res.status(404).json({ error: 'Unknown authority' });
      const dup = await db.prepare(`SELECT org_id FROM billing_organizations WHERE authority_id = ? AND org_id != ? AND status NOT IN ('REJECTED')`).get(a.authority_id, org.org_id);
      if (dup) return res.status(409).json({ error: 'Another organization already maps to this authority' });
      await db.prepare(`UPDATE billing_organizations SET authority_id = ?, updated_at = NOW() WHERE org_id = ?`).run(a.authority_id, org.org_id);
      await audit('org.mapped', { actor_type: 'super_admin', actor_id: req.auth.id, authority_id: a.authority_id, target_type: 'organization', target_id: org.org_id, meta: { authority: a.name } });
      org = await getOrganization(org.org_id);
    }
    const out = await transitionOrganization(org, req.body?.status, { actor_id: req.auth.id, note: req.body?.note || '' });
    if (req.body?.status === 'VERIFIED' && out.authority_id) {
      const sub = await getOrCreateSubscription(out.authority_id, out.plan_id || await currentDefaultPlan());
      const plan = await db.prepare('SELECT * FROM billing_plans WHERE plan_id = ?').get(sub.plan_id);
      const sr = await createSeatRequest({ authority_id: out.authority_id, requested_by: null, type: 'initial', quantity: Math.max(1, out.requested_seats), reason: 'Initial subscription seats' });
      const inv = await issueInvoice({ authority_id: out.authority_id, subscription_id: sub.subscription_id, seat_request_id: sr.request_id, type: 'initial', quote: quote(plan, sr.quantity) });
      await db.prepare('UPDATE billing_seat_requests SET invoice_id = ? WHERE request_id = ?').run(inv.invoice_id, sr.request_id);
      await transitionSeatRequest(await getSeatRequest(sr.request_id), 'AWAITING_FINANCIAL_APPROVAL', { actor_type: 'super_admin', actor_id: req.auth.id });
      await db.prepare(`UPDATE billing_organizations SET status = 'PENDING_PAYMENT', updated_at = NOW() WHERE org_id = ?`).run(out.org_id);
      await tellAuthority(out.authority_id, ['mayor', 'admin'], 'Subscription invoice ready', `Invoice ${inv.invoice_no} for ${sr.quantity} seat(s) is ready. Complete payment to activate.`);
      return res.json({ organization: await getOrganization(out.org_id), invoice: inv });
    }
    res.json({ organization: out });
  } catch (e) { err(res, e); }
});

router.post('/organizations/:id/admin', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const org = await getOrganization(req.params.id);
    if (!org?.authority_id) return res.status(404).json({ error: 'Organization not found or not mapped to an authority' });
    res.status(201).json({ staff: await appointAdmin(org.authority_id, req.body || {}, { actor_id: req.auth.id }) });
  } catch (e) { err(res, e); }
});

async function currentDefaultPlan() {
  return (await db.prepare("SELECT plan_id FROM billing_plans WHERE status = 'active' ORDER BY plan_id LIMIT 1").get())?.plan_id;
}

router.get('/plans/manage', requireAuth, requireSuperAdmin, async (req, res) => {
  res.json({ plans: await db.prepare('SELECT * FROM billing_plans ORDER BY plan_id').all() });
});

router.post('/plans', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    const info = await db.prepare(
      `INSERT INTO billing_plans (name, description, billing_period, currency, pricing_model, base_fee, per_seat_fee, bands_json, min_seats, max_seats, vat_percent, grace_days, status, terms_version, features_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`
    ).run(
      b.name.trim(), b.description || '', ['monthly', 'annual'].includes(b.billing_period) ? b.billing_period : 'annual',
      b.currency || 'BDT', ['per_seat', 'band', 'base_plus_seat'].includes(b.pricing_model) ? b.pricing_model : 'per_seat',
      Math.max(0, parseInt(b.base_fee) || 0), Math.max(0, parseInt(b.per_seat_fee) || 0),
      JSON.stringify(b.bands || []), Math.max(1, parseInt(b.min_seats) || 1),
      b.max_seats ? parseInt(b.max_seats) : null, Number(b.vat_percent) || 0,
      Math.max(0, parseInt(b.grace_days) || 14), b.terms_version || 'v1', JSON.stringify(b.features || [])
    );
    const plan = await db.prepare('SELECT * FROM billing_plans WHERE plan_id = ?').get(info.lastInsertRowid);
    await audit('plan.created', { actor_type: 'super_admin', actor_id: req.auth.id, target_type: 'plan', target_id: plan.plan_id, meta: { name: plan.name } });
    res.status(201).json({ plan });
  } catch (e) { err(res, e); }
});

router.patch('/plans/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const plan = await db.prepare('SELECT * FROM billing_plans WHERE plan_id = ?').get(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    const b = req.body || {};
    const patch = {
      name: b.name?.trim() || plan.name,
      description: b.description ?? plan.description,
      billing_period: ['monthly', 'annual'].includes(b.billing_period) ? b.billing_period : plan.billing_period,
      currency: b.currency || plan.currency,
      pricing_model: ['per_seat', 'band', 'base_plus_seat'].includes(b.pricing_model) ? b.pricing_model : plan.pricing_model,
      base_fee: b.base_fee != null ? Math.max(0, parseInt(b.base_fee) || 0) : plan.base_fee,
      per_seat_fee: b.per_seat_fee != null ? Math.max(0, parseInt(b.per_seat_fee) || 0) : plan.per_seat_fee,
      bands_json: b.bands ? JSON.stringify(b.bands) : plan.bands_json,
      min_seats: b.min_seats != null ? Math.max(1, parseInt(b.min_seats) || 1) : plan.min_seats,
      max_seats: b.max_seats !== undefined ? (b.max_seats ? parseInt(b.max_seats) : null) : plan.max_seats,
      vat_percent: b.vat_percent != null ? Number(b.vat_percent) || 0 : plan.vat_percent,
      grace_days: b.grace_days != null ? Math.max(0, parseInt(b.grace_days) || 0) : plan.grace_days,
      status: ['active', 'archived'].includes(b.status) ? b.status : plan.status,
      terms_version: b.terms_version || plan.terms_version,
      features_json: b.features ? JSON.stringify(b.features) : plan.features_json
    };
    await db.prepare(`UPDATE billing_plans SET name=?, description=?, billing_period=?, currency=?, pricing_model=?, base_fee=?, per_seat_fee=?, bands_json=?, min_seats=?, max_seats=?, vat_percent=?, grace_days=?, status=?, terms_version=?, features_json=?, updated_at=NOW() WHERE plan_id=?`)
      .run(patch.name, patch.description, patch.billing_period, patch.currency, patch.pricing_model, patch.base_fee, patch.per_seat_fee, patch.bands_json, patch.min_seats, patch.max_seats, patch.vat_percent, patch.grace_days, patch.status, patch.terms_version, patch.features_json, plan.plan_id);
    await audit('plan.updated', { actor_type: 'super_admin', actor_id: req.auth.id, target_type: 'plan', target_id: plan.plan_id, meta: { name: patch.name } });
    res.json({ plan: await db.prepare('SELECT * FROM billing_plans WHERE plan_id = ?').get(plan.plan_id) });
  } catch (e) { err(res, e); }
});

router.get('/analytics/summary', requireAuth, requireSuperAdmin, async (_req, res) => {
  res.json(await businessSummary());
});

router.get('/audit', requireAuth, requireSuperAdmin, async (req, res) => {
  const { authority_id, action, limit } = req.query;
  let sql = 'SELECT * FROM billing_audit WHERE 1=1';
  const args = [];
  if (authority_id) { sql += ' AND authority_id = ?'; args.push(authority_id); }
  if (action) { sql += ' AND action = ?'; args.push(action); }
  sql += ' ORDER BY audit_id DESC LIMIT ?';
  args.push(Math.min(500, parseInt(limit) || 100));
  res.json({ audit: await db.prepare(sql).all(...args) });
});

router.get('/manual-queue', requireAuth, requireSuperAdmin, async (_req, res) => {
  const rows = await db.prepare(
    `SELECT m.*, i.invoice_no, i.total, a.name AS authority_name FROM billing_manual_payments m
     JOIN billing_invoices i ON i.invoice_id = m.invoice_id
     JOIN authorities a ON a.authority_id = m.authority_id
     ORDER BY m.created_at DESC LIMIT 100`
  ).all();
  res.json({ queue: rows });
});

router.post('/manual/:id/verify', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const m = await db.prepare('SELECT * FROM billing_manual_payments WHERE id = ?').get(req.params.id);
    if (!m) return res.status(404).json({ error: 'Record not found' });
    if (m.status !== 'UNDER_REVIEW') return res.status(409).json({ error: `Already ${m.status}` });
    const inv = await db.prepare('SELECT * FROM billing_invoices WHERE invoice_id = ?').get(m.invoice_id);
    if (!['issued', 'pending', 'failed'].includes(inv.status)) {
      return res.status(409).json({ error: `Invoice is ${inv.status}` });
    }
    await db.prepare(`UPDATE billing_manual_payments SET status = 'VERIFIED', reviewer = ?, review_note = ?, reviewed_at = NOW() WHERE id = ?`)
      .run(req.auth.id, req.body?.note || '', m.id);
    const payInfo = await db.prepare(
      `INSERT INTO billing_payments (txn_id, gateway, invoice_id, authority_id, amount, currency, status, paid_by)
       VALUES (?, 'manual', ?, ?, ?, ?, 'CREATED', ?)`
    ).run(`MAN-${Date.now()}-${m.id}`, inv.invoice_id, inv.authority_id, inv.total, inv.currency, req.auth.id);
    const out = await finalizePayment(payInfo.lastInsertRowid,
      { ok: true, amountMinor: inv.total, currency: inv.currency, gatewayTxnId: `MANUAL-${m.reference}`, provider: 'manual' },
      { actor_type: 'super_admin', actor_id: req.auth.id });
    if (inv.seat_request_id) {
      try {
        const sr = await getSeatRequest(inv.seat_request_id);
        if (sr && sr.status === 'PAYMENT_PENDING') await transitionSeatRequest(sr, 'COMPLETED', { actor_type: 'super_admin', actor_id: req.auth.id });
      } catch {}
    }
    await audit('manual_payment.verified', { actor_type: 'super_admin', actor_id: req.auth.id, authority_id: m.authority_id, target_type: 'manual_payment', target_id: m.id });
    res.json({ payment: out.payment });
  } catch (e) { err(res, e); }
});

router.post('/manual/:id/reject', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const m = await db.prepare('SELECT * FROM billing_manual_payments WHERE id = ?').get(req.params.id);
    if (!m) return res.status(404).json({ error: 'Record not found' });
    if (m.status !== 'UNDER_REVIEW') return res.status(409).json({ error: `Already ${m.status}` });
    await db.prepare(`UPDATE billing_manual_payments SET status = 'REJECTED', reviewer = ?, review_note = ?, reviewed_at = NOW() WHERE id = ?`)
      .run(req.auth.id, req.body?.note || '', m.id);
    await audit('manual_payment.rejected', { actor_type: 'super_admin', actor_id: req.auth.id, authority_id: m.authority_id, target_type: 'manual_payment', target_id: m.id, outcome: 'rejected', meta: { note: req.body?.note || '' } });
    res.json({ ok: true });
  } catch (e) { err(res, e); }
});

router.post('/refunds', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const pay = await db.prepare('SELECT * FROM billing_payments WHERE payment_id = ?').get(req.body?.payment_id);
    if (!pay) return res.status(404).json({ error: 'Payment not found' });
    if (pay.status !== 'SUCCESS') return res.status(409).json({ error: 'Only successful payments can be refunded' });
    const amount = parseInt(req.body?.amount ?? pay.amount);
    if (!amount || amount <= 0 || amount > pay.amount) return res.status(400).json({ error: 'Invalid refund amount' });
    const info = await db.prepare(
      `INSERT INTO billing_refunds (payment_id, amount, reason, status, decided_by) VALUES (?, ?, ?, 'REQUESTED', ?)`
    ).run(pay.payment_id, amount, req.body?.reason || '', req.auth.id);
    await audit('refund.requested', { actor_type: 'super_admin', actor_id: req.auth.id, authority_id: pay.authority_id, target_type: 'refund', target_id: info.lastInsertRowid, meta: { amount } });
    res.status(201).json({ refund: await db.prepare('SELECT * FROM billing_refunds WHERE refund_id = ?').get(info.lastInsertRowid) });
  } catch (e) { err(res, e); }
});

router.post('/refunds/:id/complete', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const r = await db.prepare('SELECT * FROM billing_refunds WHERE refund_id = ?').get(req.params.id);
    if (!r) return res.status(404).json({ error: 'Refund not found' });
    if (!['REQUESTED', 'APPROVED', 'PROCESSING'].includes(r.status)) {
      return res.status(409).json({ error: `Refund is ${r.status}` });
    }
    await db.prepare(`UPDATE billing_refunds SET status = 'COMPLETED', gateway_ref = ?, completed_at = NOW() WHERE refund_id = ?`)
      .run(req.body?.gateway_ref || 'manual', r.refund_id);
    const pay = await db.prepare('SELECT * FROM billing_payments WHERE payment_id = ?').get(r.payment_id);
    const full = r.amount >= pay.amount;
    await db.prepare(`UPDATE billing_payments SET status = ?, updated_at = NOW() WHERE payment_id = ?`)
      .run(full ? 'REFUNDED' : 'PARTIALLY_REFUNDED', r.payment_id);
    await audit('refund.completed', { actor_type: 'super_admin', actor_id: req.auth.id, authority_id: pay.authority_id, target_type: 'refund', target_id: r.refund_id, meta: { amount: r.amount, gateway_ref: req.body?.gateway_ref || 'manual' } });
    res.json({ refund: await db.prepare('SELECT * FROM billing_refunds WHERE refund_id = ?').get(r.refund_id) });
  } catch (e) { err(res, e); }
});

router.patch('/subscriptions/:id/status', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const sub = await db.prepare('SELECT * FROM billing_subscriptions WHERE subscription_id = ?').get(req.params.id);
    if (!sub) return res.status(404).json({ error: 'Subscription not found' });
    res.json({ subscription: await setSubscriptionStatus(sub, req.body?.status, { actor_id: req.auth.id }) });
  } catch (e) { err(res, e); }
});

// ---------- LGI staff administration (Technical Admin + Mayor) ----------

const STAFF_ADMIN_ROLES = ['junior', 'senior', 'mayor', 'wit', 'field', 'admin'];

/**
 * Target guard: Technical Admins may manage anyone EXCEPT mayors and
 * themselves-role-wise; Mayors may manage anyone except changing their own
 * role (lockout protection). Super admin is unrestricted (audited).
 */
function staffTargetGuard(req, target) {
  const me = req.org.requester;
  if (me.kind === 'super_admin') return null;
  if (Number(target.staff_id) === Number(me.id) && req.body?.staff_role && req.body.staff_role !== target.staff_role) {
    return 'You cannot change your own role';
  }
  if (me.staff_role === 'admin') {
    if (target.staff_role === 'mayor') return 'Only the platform admin can change a Mayor/Chairman account';
    if (req.body?.staff_role === 'mayor' || req.body?.staff_role === 'admin') {
      return 'Technical Admins cannot grant mayor or admin roles';
    }
  }
  return null;
}

async function scopedStaff(req, id) {
  const row = await db.prepare('SELECT * FROM staff WHERE staff_id = ?').get(id);
  if (!row) return { error: 404 };
  const me = req.org.requester;
  if (me.kind !== 'super_admin' && row.authority_id !== req.org.authority_id) return { error: 404 };
  return { row };
}

router.post('/staff', requireAuth, requireStaff, requireOrgAccess({ allow: ['admin'] }), async (req, res) => {
  try {
    const me = req.org.requester;
    const { full_name, email, password, staff_role = 'junior', department = 'general' } = req.body || {};
    if (!full_name?.trim() || !email?.includes('@') || !password || password.length < 8) {
      return res.status(400).json({ error: 'Name, valid email and 8+ character password are required' });
    }
    if (!STAFF_ADMIN_ROLES.includes(staff_role)) return res.status(400).json({ error: 'Invalid role' });
    if (me.kind !== 'super_admin' && me.staff_role === 'admin' && ['mayor', 'admin'].includes(staff_role)) {
      return res.status(403).json({ error: 'Technical Admins cannot create mayor or admin accounts' });
    }
    const emailLc = email.trim().toLowerCase();
    if (await db.prepare('SELECT staff_id FROM staff WHERE email = ?').get(emailLc)) {
      return res.status(409).json({ error: 'This email is already a staff account' });
    }
    const hash = bcrypt.hashSync(password, 10);
    const staff = await insertStaffRow({
      authority_id: req.org.authority_id, full_name: full_name.trim(), email: emailLc,
      password_hash: hash, department: department || 'general', staff_role
    });
    await audit('staff.created', { actor_type: me.kind, actor_id: me.id, authority_id: req.org.authority_id, target_type: 'staff', target_id: staff.staff_id, meta: { staff_role } });
    await tellStaff(staff.staff_id, 'Staff account created', `Your ${staff_role} account is active. Use your email and the password given to you to log in.`);
    res.status(201).json({ staff: { staff_id: staff.staff_id, full_name: staff.full_name, email: staff.email, staff_role: staff.staff_role, department: staff.department, is_active: staff.is_active } });
  } catch (e) { err(res, e); }
});

router.patch('/staff/:id', requireAuth, requireStaff, requireOrgAccess({ allow: ['admin'] }), async (req, res) => {
  try {
    const { row, error } = await scopedStaff(req, req.params.id);
    if (error) return res.status(404).json({ error: 'Staff not found' });
    const problem = staffTargetGuard(req, row);
    if (problem) return res.status(403).json({ error: problem });
    const patch = {};
    if (req.body?.staff_role) {
      if (!STAFF_ADMIN_ROLES.includes(req.body.staff_role)) return res.status(400).json({ error: 'Invalid role' });
      patch.staff_role = req.body.staff_role;
    }
    if (req.body?.department !== undefined) patch.department = String(req.body.department || 'general');
    if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'Nothing to update' });
    const sets = Object.keys(patch).map((k) => `${k} = ?`).join(', ');
    await db.prepare(`UPDATE staff SET ${sets} WHERE staff_id = ?`).run(...Object.values(patch), row.staff_id);
    await audit('staff.updated', { actor_id: req.auth.id, authority_id: row.authority_id, target_type: 'staff', target_id: row.staff_id, meta: { from: { staff_role: row.staff_role, department: row.department }, to: patch } });
    res.json({ staff: await db.prepare('SELECT staff_id, full_name, email, department, staff_role, is_active FROM staff WHERE staff_id = ?').get(row.staff_id) });
  } catch (e) { err(res, e); }
});

router.post('/staff/:id/reset-password', requireAuth, requireStaff, requireOrgAccess({ allow: ['admin'] }), async (req, res) => {
  try {
    const { row, error } = await scopedStaff(req, req.params.id);
    if (error) return res.status(404).json({ error: 'Staff not found' });
    const me = req.org.requester;
    if (me.kind !== 'super_admin' && row.staff_role === 'mayor' && me.staff_role === 'admin') {
      return res.status(403).json({ error: 'Only the platform admin can reset a Mayor/Chairman password' });
    }
    const pw = req.body?.password || '';
    if (!pw || pw.length < 8) return res.status(400).json({ error: 'New password must be 8+ characters' });
    await db.prepare('UPDATE staff SET password_hash = ? WHERE staff_id = ?').run(bcrypt.hashSync(pw, 10), row.staff_id);
    await audit('staff.password_reset', { actor_id: req.auth.id, authority_id: row.authority_id, target_type: 'staff', target_id: row.staff_id });
    await tellStaff(row.staff_id, 'Password reset', 'Your LGI admin reset your password. Use the new password to log in.');
    res.json({ ok: true });
  } catch (e) { err(res, e); }
});

// ---------- Super admin: transactions, export, gateway metadata ----------

router.get('/txn', requireAuth, requireSuperAdmin, async (req, res) => {
  const { status, authority_id, limit } = req.query;
  let sql = `SELECT p.*, i.invoice_no, a.name AS authority_name FROM billing_payments p
             JOIN billing_invoices i ON i.invoice_id = p.invoice_id
             JOIN authorities a ON a.authority_id = p.authority_id WHERE 1=1`;
  const args = [];
  if (status && status !== 'all') { sql += ' AND p.status = ?'; args.push(status); }
  if (authority_id) { sql += ' AND p.authority_id = ?'; args.push(authority_id); }
  sql += ' ORDER BY p.payment_id DESC LIMIT ?';
  args.push(Math.min(500, parseInt(limit) || 100));
  res.json({ payments: await db.prepare(sql).all(...args) });
});

function toCsv(rows, cols) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

router.get('/export/:kind.csv', requireAuth, requireSuperAdmin, async (req, res) => {
  const kind = req.params.kind;
  let rows = [], cols = [];
  if (kind === 'payments') {
    cols = ['payment_id', 'txn_id', 'gateway', 'gateway_txn_id', 'invoice_id', 'authority_id', 'amount', 'currency', 'status', 'created_at', 'updated_at'];
    rows = await db.prepare('SELECT * FROM billing_payments ORDER BY payment_id DESC LIMIT 2000').all();
  } else if (kind === 'invoices') {
    cols = ['invoice_id', 'invoice_no', 'authority_id', 'type', 'subtotal', 'vat', 'total', 'currency', 'status', 'due_date', 'paid_at', 'created_at'];
    rows = await db.prepare('SELECT * FROM billing_invoices ORDER BY invoice_id DESC LIMIT 2000').all();
  } else if (kind === 'audit') {
    cols = ['audit_id', 'actor_type', 'actor_id', 'authority_id', 'action', 'target_type', 'target_id', 'outcome', 'created_at'];
    rows = await db.prepare('SELECT audit_id, actor_type, actor_id, authority_id, action, target_type, target_id, outcome, created_at FROM billing_audit ORDER BY audit_id DESC LIMIT 2000').all();
  } else {
    return res.status(404).json({ error: 'Unknown export (payments|invoices|audit)' });
  }
  await audit('report.exported', { actor_type: 'super_admin', actor_id: req.auth.id, target_type: 'export', meta: { kind, rows: rows.length } });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="nagorik-billing-${kind}.csv"`);
  res.send(toCsv(rows, cols));
});

router.get('/gateway/status', requireAuth, requireSuperAdmin, async (_req, res) => {
  const c = gatewayConfig();
  // Metadata only — secrets never leave the backend.
  res.json({ provider: c.provider, sandbox: c.sandbox, currency: c.currency, configured: gatewayConfigured(), public_web_url: c.publicWebUrl });
});

// ---------- Super admin: full database control over LGIs & staff ----------

router.post('/authorities', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.name?.trim() || !['CITY_CORPORATION', 'POUROSHOVA', 'UNION_PARISHAD'].includes(b.type)) {
      return res.status(400).json({ error: 'Name and valid LGI type are required' });
    }
    const nums = ['min_lat', 'max_lat', 'min_lng', 'max_lng'].map((k) => Number(b[k]));
    if (nums.some((n) => !Number.isFinite(n))) {
      return res.status(400).json({ error: 'Valid jurisdiction bounds (min/max lat/lng) are required' });
    }
    const info = await db.prepare(
      `INSERT INTO authorities (name, type, min_lat, max_lat, min_lng, max_lng, phone, email, division, district, center_lat, center_lng, upazila)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(b.name.trim(), b.type, nums[0], nums[1], nums[2], nums[3],
      b.phone || null, b.email || null, b.division || null, b.district || null,
      b.center_lat != null ? Number(b.center_lat) : null, b.center_lng != null ? Number(b.center_lng) : null,
      b.upazila || null);
    const created = await db.prepare('SELECT * FROM authorities WHERE authority_id = ?').get(info.lastInsertRowid);
    await audit('authority.created', { actor_type: 'super_admin', actor_id: req.auth.id, authority_id: created.authority_id, target_type: 'authority', target_id: created.authority_id, meta: { name: created.name } });
    res.status(201).json({ authority: created });
  } catch (e) { err(res, e); }
});

router.get('/authorities/unassigned', requireAuth, requireSuperAdmin, async (req, res) => {
  const q = `%${(req.query.q || '').trim()}%`;
  const rows = await db.prepare(
    `SELECT a.authority_id, a.name, a.type, a.district, a.division,
            (SELECT COUNT(*) FROM staff s WHERE s.authority_id = a.authority_id AND s.staff_role = 'admin' AND s.is_active = 1) AS admin_count,
            (SELECT COUNT(*) FROM staff s WHERE s.authority_id = a.authority_id AND s.is_active = 1) AS staff_count,
            (SELECT status FROM billing_subscriptions s WHERE s.authority_id = a.authority_id) AS sub_status
     FROM authorities a
     WHERE (? = '%%' OR a.name LIKE ? OR a.district LIKE ?)
     ORDER BY admin_count ASC, a.name ASC LIMIT 100`
  ).all(q, q, q);
  res.json({ authorities: rows });
});

router.post('/authorities/:id/admin', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    res.status(201).json({ staff: await appointAdmin(Number(req.params.id), req.body || {}, { actor_id: req.auth.id }) });
  } catch (e) { err(res, e); }
});

router.delete('/staff/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    res.json(await removeStaff(Number(req.params.id), { actor_id: req.auth.id }));
  } catch (e) { err(res, e); }
});

export default router;
