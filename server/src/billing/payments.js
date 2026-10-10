import { db } from '../db.js';
import { audit, tellAuthority, tellSuperAdmins, tellStaff, seatUsage } from './service.js';

const SSLCZ_SANDBOX_INIT = 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php';
const SSLCZ_LIVE_INIT = 'https://securepay.sslcommerz.com/gwprocess/v4/api.php';
const SSLCZ_SANDBOX_VALIDATE = 'https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php';
const SSLCZ_LIVE_VALIDATE = 'https://securepay.sslcommerz.com/validator/api/validationserverAPI.php';

export function gatewayConfig() {
  return {
    provider: process.env.BILL_GATEWAY_PROVIDER || 'sslcommerz',
    sandbox: (process.env.BILL_SSLCZ_SANDBOX || 'true').toLowerCase() !== 'false',
    storeId: process.env.BILL_SSLCZ_STORE_ID || '',
    storePasswd: process.env.BILL_SSLCZ_STORE_PASSWD || '',
    currency: process.env.BILL_CURRENCY || 'BDT',
    publicWebUrl: (process.env.BILL_PUBLIC_WEB_URL || 'http://localhost:3000').replace(/\/$/, '')
  };
}

export function gatewayConfigured() {
  const c = gatewayConfig();
  return Boolean(c.storeId && c.storePasswd);
}

function redact(obj) {
  const s = JSON.stringify(obj || {});
  return s.replace(/("store_passwd"\s*:\s*")[^"]*(")/g, '$1***$2');
}

/** Initiate an SSLCommerz hosted-checkout session. Amount in minor units. */
export async function sslczInit({ txnId, amountMinor, currency, invoiceNo, customer, urls }) {
  const c = gatewayConfig();
  if (!gatewayConfigured()) {
    throw Object.assign(new Error('Payment gateway is not configured (sandbox credentials missing)'), { status: 503, code: 'GATEWAY_NOT_CONFIGURED' });
  }
  const params = new URLSearchParams({
    store_id: c.storeId,
    store_passwd: c.storePasswd,
    total_amount: (amountMinor / 100).toFixed(2),
    currency: currency || c.currency,
    tran_id: txnId,
    success_url: urls.success,
    fail_url: urls.fail,
    cancel_url: urls.cancel,
    ipn_url: urls.ipn || '',
    product_name: `Nagorik Sheba — ${invoiceNo}`,
    product_category: 'Service',
    product_profile: 'general',
    cus_name: customer.name || 'LGI payer',
    cus_email: customer.email || 'billing@nagorik.bd',
    cus_phone: customer.phone || '01XXXXXXXXX',
    cus_add1: customer.address || 'Bangladesh',
    cus_city: customer.city || 'Dhaka',
    cus_country: 'Bangladesh',
    shipping_method: 'NO',
    num_of_item: '1'
  });
  const endpoint = c.sandbox ? SSLCZ_SANDBOX_INIT : SSLCZ_LIVE_INIT;
  const r = await fetch(endpoint, { method: 'POST', body: params });
  const j = await r.json().catch(() => ({}));
  if (j.status !== 'SUCCESS' || !j.GatewayPageURL) {
    throw Object.assign(new Error(`Gateway refused checkout: ${j.failedreason || 'unknown'}`), { status: 502, code: 'GATEWAY_REFUSED', detail: redact(j) });
  }
  return { gatewayUrl: j.GatewayPageURL, sessionKey: j.sessionkey || null, raw: j };
}

/** Server-side validation of a val_id — the ONLY trusted success signal. */
export async function sslczValidate(valId) {
  const c = gatewayConfig();
  if (!gatewayConfigured()) {
    throw Object.assign(new Error('Payment gateway is not configured'), { status: 503 });
  }
  const url = `${c.sandbox ? SSLCZ_SANDBOX_VALIDATE : SSLCZ_LIVE_VALIDATE}?val_id=${encodeURIComponent(valId)}&store_id=${encodeURIComponent(c.storeId)}&store_passwd=${encodeURIComponent(c.storePasswd)}&format=json`;
  const r = await fetch(url);
  const j = await r.json().catch(() => ({}));
  return j;
}

export async function logPaymentEvent(paymentId, event, payload = {}) {
  await db.prepare('INSERT INTO billing_payment_events (payment_id, event, payload_json) VALUES (?, ?, ?)')
    .run(paymentId, event, JSON.stringify(payload));
  await db.prepare('UPDATE billing_payments SET raw_json = ?, updated_at = NOW() WHERE payment_id = ?')
    .run(JSON.stringify(payload).slice(0, 4000), paymentId);
}

async function setPaymentStatus(paymentId, status, extra = {}) {
  await db.prepare(`UPDATE billing_payments SET status = ?, gateway_txn_id = COALESCE(?, gateway_txn_id), updated_at = NOW() WHERE payment_id = ?`)
    .run(status, extra.gateway_txn_id || null, paymentId);
}

/**
 * Idempotent finalization. Only a gateway-VALIDATED success (or an audited
 * manual verification) allocates capacity. Safe to call repeatedly and from
 * webhooks, return-URL polling, and reconciliation.
 */
export async function finalizePayment(paymentId, verification, { actor_type = 'system', actor_id = null } = {}) {
  const pay = await db.prepare('SELECT * FROM billing_payments WHERE payment_id = ?').get(paymentId);
  if (!pay) throw Object.assign(new Error('Payment not found'), { status: 404 });
  if (pay.status === 'SUCCESS') {
    return { payment: pay, already: true };
  }
  if (!['CREATED', 'PENDING', 'FAILED'].includes(pay.status)) {
    throw Object.assign(new Error(`Payment is ${pay.status} and cannot be finalized`), { status: 409 });
  }
  const inv = await db.prepare('SELECT * FROM billing_invoices WHERE invoice_id = ?').get(pay.invoice_id);
  if (!inv) throw Object.assign(new Error('Linked invoice not found'), { status: 500 });

  if (!verification || verification.ok !== true) {
    await setPaymentStatus(paymentId, 'FAILED');
    await logPaymentEvent(paymentId, 'finalize_failed', verification || {});
    if (inv.seat_request_id) {
      await db.prepare(`UPDATE billing_seat_requests SET status = 'PAYMENT_FAILED', updated_at = NOW() WHERE request_id = ? AND status = 'PAYMENT_PENDING'`)
        .run(inv.seat_request_id);
    }
    await audit('payment.failed', { actor_type, actor_id, authority_id: pay.authority_id, target_type: 'payment', target_id: paymentId, outcome: 'failed', meta: { reason: verification?.reason || 'verification failed' } });
    return { payment: await db.prepare('SELECT * FROM billing_payments WHERE payment_id = ?').get(paymentId), already: false };
  }

  if (Number(verification.amountMinor) !== Number(pay.amount) || String(verification.currency || '') !== String(pay.currency)) {
    await setPaymentStatus(paymentId, 'FAILED');
    await logPaymentEvent(paymentId, 'amount_mismatch', verification);
    await audit('payment.amount_mismatch', { actor_type, actor_id, authority_id: pay.authority_id, target_type: 'payment', target_id: paymentId, outcome: 'rejected', meta: verification });
    throw Object.assign(new Error('Amount/currency mismatch — payment rejected, no seats allocated'), { status: 409 });
  }

  await setPaymentStatus(paymentId, 'SUCCESS', { gateway_txn_id: verification.gatewayTxnId || null });
  await logPaymentEvent(paymentId, 'finalize_success', verification);
  await db.prepare(`UPDATE billing_invoices SET status = 'paid', paid_at = NOW() WHERE invoice_id = ?`).run(inv.invoice_id);

  const applied = await applyCapacity(inv, pay, { actor_type, actor_id });

  const invDone = await db.prepare('SELECT * FROM billing_invoices WHERE invoice_id = ?').get(inv.invoice_id);
  await audit('payment.success', { actor_type, actor_id, authority_id: pay.authority_id, target_type: 'payment', target_id: paymentId, meta: { invoice_no: invDone.invoice_no, amount: pay.amount } });
  await tellAuthority(pay.authority_id, ['mayor', 'admin'], 'Payment received', `Invoice ${invDone.invoice_no} is paid. ${applied.note}`);
  return { payment: await db.prepare('SELECT * FROM billing_payments WHERE payment_id = ?').get(paymentId), already: false, applied };
}

async function applyCapacity(inv, pay, { actor_type, actor_id }) {
  const notes = [];
  if (inv.seat_request_id) {
    const req = await db.prepare('SELECT * FROM billing_seat_requests WHERE request_id = ?').get(inv.seat_request_id);
    if (req && req.status !== 'COMPLETED') {
      const sub = await db.prepare('SELECT * FROM billing_subscriptions WHERE authority_id = ?').get(inv.authority_id);
      if (!sub) throw Object.assign(new Error('No subscription for this organization'), { status: 409 });
      await db.prepare('UPDATE billing_subscriptions SET paid_seats = paid_seats + ?, updated_at = NOW() WHERE subscription_id = ?')
        .run(req.quantity, sub.subscription_id);
      await db.prepare(`UPDATE billing_seat_requests SET status = 'COMPLETED', payment_id = ?, updated_at = NOW() WHERE request_id = ?`)
        .run(pay.payment_id, req.request_id);
      notes.push(`${req.quantity} additional seat(s) activated`);
      await audit('seats.allocated', { actor_type, actor_id, authority_id: inv.authority_id, target_type: 'seat_request', target_id: req.request_id, meta: { quantity: req.quantity } });
      await autoActivateWaiting(inv.authority_id, actor_id);
    }
  }
  if (inv.type === 'initial' || inv.type === 'renewal' || inv.type === 'upgrade') {
    await activateOrRenewSubscription(inv, pay, { actor_type, actor_id }, notes);
  }
  return { note: notes.join('; ') || 'Payment recorded' };
}

async function activateOrRenewSubscription(inv, pay, { actor_type, actor_id }, notes) {
  const lines = JSON.parse(inv.lines_json || '[]');
  const seatLine = lines.find((l) => l.kind === 'seats' || l.kind === 'band_seats');
  const qty = seatLine ? seatLine.qty : 0;
  const subPlanId = inv.subscription_id
    ? (await db.prepare('SELECT plan_id FROM billing_subscriptions WHERE subscription_id = ?').get(inv.subscription_id))?.plan_id
    : null;
  const fallbackPlanId = (await db.prepare("SELECT plan_id FROM billing_plans WHERE status = 'active' ORDER BY plan_id LIMIT 1").get())?.plan_id;
  const plan = await db.prepare('SELECT * FROM billing_plans WHERE plan_id = ?').get(
    subPlanId || lines.find((l) => l.plan_id)?.plan_id || fallbackPlanId
  );
  if (!plan) throw Object.assign(new Error('No active plan available'), { status: 409 });
  const months = plan.billing_period === 'monthly' ? 1 : 12;
  const now = new Date();
  const start = now.toISOString().slice(0, 19).replace('T', ' ');
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + months, now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds()))
    .toISOString().slice(0, 19).replace('T', ' ');
  const grace = new Date(new Date(end + 'Z').getTime() + (plan.grace_days || 14) * 86400000).toISOString().slice(0, 19).replace('T', ' ');

  let sub = inv.subscription_id ? await db.prepare('SELECT * FROM billing_subscriptions WHERE subscription_id = ?').get(inv.subscription_id) : null;
  if (!sub) {
    const info = await db.prepare(
      `INSERT INTO billing_subscriptions (authority_id, plan_id, status, paid_seats, starts_at, expires_at, grace_until, last_renewal_at)
       VALUES (?, ?, 'ACTIVE', ?, ?, ?, ?, NOW())`
    ).run(inv.authority_id, plan.plan_id, qty, start, end, grace);
    sub = await db.prepare('SELECT * FROM billing_subscriptions WHERE subscription_id = ?').get(info.lastInsertRowid);
    notes.push(`Subscription activated with ${qty} seat(s) until ${end.slice(0, 10)}`);
    await audit('subscription.activated', { actor_type, actor_id, authority_id: inv.authority_id, target_type: 'subscription', target_id: sub.subscription_id, meta: { seats: qty } });
  } else if (inv.type === 'initial' && sub.status === 'PENDING') {
    await db.prepare(`UPDATE billing_subscriptions SET plan_id = ?, status = 'ACTIVE', paid_seats = paid_seats + ?, starts_at = ?, expires_at = ?, grace_until = ?, last_renewal_at = NOW(), updated_at = NOW() WHERE subscription_id = ?`)
      .run(plan.plan_id, qty, start, end, grace, sub.subscription_id);
    notes.push(`Subscription activated with ${qty} seat(s) until ${end.slice(0, 10)}`);
    await audit('subscription.activated', { actor_type, actor_id, authority_id: inv.authority_id, target_type: 'subscription', target_id: sub.subscription_id, meta: { seats: qty } });
  } else if (inv.type === 'renewal') {
    if (qty < await activeStaffCount(sub.authority_id)) {
      throw Object.assign(new Error('Renewal seats are fewer than active staff — deactivate staff or buy more seats first (no silent invalidation)'), { status: 409 });
    }
    await db.prepare(`UPDATE billing_subscriptions SET plan_id = ?, status = 'ACTIVE', paid_seats = ?, starts_at = ?, expires_at = ?, grace_until = ?, last_renewal_at = NOW(), updated_at = NOW() WHERE subscription_id = ?`)
      .run(plan.plan_id, qty, start, end, grace, sub.subscription_id);
    notes.push(`Subscription renewed with ${qty} seat(s) until ${end.slice(0, 10)}`);
    await audit('subscription.renewed', { actor_type, actor_id, authority_id: inv.authority_id, target_type: 'subscription', target_id: sub.subscription_id, meta: { seats: qty } });
  } else if (inv.type === 'upgrade') {
    await db.prepare(`UPDATE billing_subscriptions SET plan_id = ?, status = 'ACTIVE', paid_seats = paid_seats + ?, expires_at = ?, grace_until = ?, updated_at = NOW() WHERE subscription_id = ?`)
      .run(plan.plan_id, qty, end, grace, sub.subscription_id);
    notes.push(`Plan upgraded; ${qty} seat(s) added`);
    await audit('subscription.upgraded', { actor_type, actor_id, authority_id: inv.authority_id, target_type: 'subscription', target_id: sub.subscription_id, meta: { added: qty } });
  }
  await tellAuthority(inv.authority_id, ['mayor', 'admin'], 'Subscription active', notes.join('; '));
}

async function activeStaffCount(authorityId) {
  return (await db.prepare('SELECT COUNT(*) AS n FROM staff WHERE authority_id = ? AND is_active = 1').get(authorityId)).n;
}

/** After capacity grows, activate verified+approved registrations FIFO. */
async function autoActivateWaiting(authorityId, actorId) {
  const waiting = await db.prepare(
    `SELECT * FROM billing_registrations WHERE authority_id = ? AND status = 'approved' ORDER BY updated_at ASC LIMIT 25`
  ).all(authorityId);
  for (const reg of waiting) {
    if (!reg.pending_password_hash) continue;
    const sub = await db.prepare('SELECT * FROM billing_subscriptions WHERE authority_id = ?').get(authorityId);
    if (!sub) continue;
    const allocated = await activeStaffCount(authorityId);
    if (sub.paid_seats - allocated < 1) break;
    try {
      const info = await db.prepare(
        `INSERT INTO staff (full_name, email, password_hash, department, authority_id, staff_role, is_active)
         VALUES (?, ?, ?, ?, ?, ?, 1)`
      ).run(reg.full_name, reg.email, reg.pending_password_hash, reg.department, reg.authority_id, reg.staff_role_requested);
      await db.prepare(`UPDATE billing_registrations SET status = 'activated', staff_id = ?, updated_at = NOW() WHERE reg_id = ?`)
        .run(info.lastInsertRowid, reg.reg_id);
      await audit('registration.activated', { actor_type: 'system', actor_id: actorId, authority_id, target_type: 'staff', target_id: info.lastInsertRowid, meta: { reg_id: reg.reg_id, auto: true } });
      await tellStaff(info.lastInsertRowid, 'Staff account activated', `Your ${reg.staff_role_requested} account is active. Use the password your LGI admin gave you.`);
    } catch {}
  }
}

export async function markPaymentEvent(paymentId, status, gatewayTxnId = null) {
  await db.prepare(`UPDATE billing_payments SET status = ?, gateway_txn_id = COALESCE(?, gateway_txn_id), updated_at = NOW() WHERE payment_id = ?`)
    .run(status, gatewayTxnId, paymentId);
  await logPaymentEvent(paymentId, `status_${status.toLowerCase()}`, { gatewayTxnId });
}
