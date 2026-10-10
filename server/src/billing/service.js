import bcrypt from 'bcryptjs';
import { db, notify } from '../db.js';
import { quote, nextInvoiceNo, addMonths } from './pricing.js';
import { orgStaffIds, superAdminUserIds } from './rbac.js';

export async function audit(action, { actor_type = 'user', actor_id = null, authority_id = null, target_type = null, target_id = null, outcome = 'ok', meta = {} } = {}) {
  await db.prepare(
    `INSERT INTO billing_audit (actor_type, actor_id, authority_id, action, target_type, target_id, outcome, meta_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(actor_type, actor_id, authority_id, action, target_type, target_id, outcome, JSON.stringify(meta));
}

export async function tellAuthority(authorityId, roles, title, message) {
  for (const id of await orgStaffIds(authorityId, roles)) {
    try { await notify(id, null, title, message, 'staff', 'billing'); } catch {}
  }
}

export async function tellSuperAdmins(title, message) {
  for (const id of await superAdminUserIds()) {
    try { await notify(id, null, title, message, 'citizen', 'billing'); } catch {}
  }
}

export async function tellStaff(staffId, title, message) {
  try { await notify(staffId, null, title, message, 'staff', 'billing'); } catch {}
}

// ---------- Subscriptions & seat math ----------

export async function getSubscription(authorityId) {
  return await db.prepare('SELECT * FROM billing_subscriptions WHERE authority_id = ?').get(authorityId) || null;
}

export async function activeStaffCount(authorityId) {
  return (await db.prepare(
    'SELECT COUNT(*) AS n FROM staff WHERE authority_id = ? AND is_active = 1'
  ).get(authorityId)).n;
}

export async function reservedSeats(authorityId) {
  const row = await db.prepare(
    `SELECT COALESCE(SUM(quantity), 0) AS n FROM billing_seat_requests
      WHERE authority_id = ? AND status IN ('APPROVED_AWAITING_PAYMENT','PAYMENT_PENDING','PAYMENT_VERIFICATION_PENDING')`
  ).get(authorityId);
  return row.n;
}

export async function seatUsage(authorityId) {
  const sub = await getSubscription(authorityId);
  const allocated = await activeStaffCount(authorityId);
  if (!sub) return { mode: 'legacy', paid: 0, allocated, reserved: 0, available: Infinity, subscription: null };
  const reserved = await reservedSeats(authorityId);
  return {
    mode: 'managed', paid: sub.paid_seats, allocated, reserved,
    available: sub.paid_seats - allocated - reserved, subscription: sub
  };
}

/**
 * Operational policy for an authority's staff writes.
 * - No subscription row  -> legacy grandfathered mode, everything allowed.
 * - ACTIVE / in-grace   -> allowed (warning flag when expiring soon).
 * - Past grace / SUSPENDED / CANCELLED -> staff writes blocked (402), but
 *   login, reads, billing and citizen flows are NEVER blocked.
 */
export async function subscriptionPolicy(authorityId) {
  const sub = await getSubscription(authorityId);
  if (!sub) return { mode: 'legacy', allowed: true, status: 'LEGACY', message: '' };
  const now = Date.now();
  const exp = sub.expires_at ? new Date(sub.expires_at + 'Z').getTime() : Infinity;
  const grace = sub.grace_until ? new Date(sub.grace_until + 'Z').getTime() : exp;
  if (sub.status === 'ACTIVE' || sub.status === 'RENEWAL_PENDING') {
    if (now <= exp) {
      const soon = exp - now < 30 * 86400000;
      return { mode: 'managed', allowed: true, status: sub.status, expiringSoon: soon, message: '' };
    }
    if (now <= grace) {
      return { mode: 'managed', allowed: true, status: 'EXPIRED', inGrace: true, message: 'Subscription expired — within grace period. Renew to stay active.' };
    }
  }
  const reason = sub.status === 'CANCELLED' ? 'cancelled' : sub.status === 'SUSPENDED' ? 'suspended' : 'expired';
  return { mode: 'managed', allowed: false, status: sub.status, message: `Organization subscription ${reason}. Staff actions are paused until renewal — citizens are unaffected.` };
}

// ---------- Seat requests ----------

export const SEAT_TRANSITIONS = {
  REQUESTED: ['EMPLOYEE_VERIFICATION_PENDING', 'AWAITING_FINANCIAL_APPROVAL', 'REJECTED', 'CANCELLED'],
  EMPLOYEE_VERIFICATION_PENDING: ['AWAITING_FINANCIAL_APPROVAL', 'REJECTED', 'CANCELLED'],
  AWAITING_FINANCIAL_APPROVAL: ['APPROVED_AWAITING_PAYMENT', 'REJECTED', 'CANCELLED', 'EXPIRED'],
  APPROVED_AWAITING_PAYMENT: ['PAYMENT_PENDING', 'CANCELLED', 'EXPIRED'],
  PAYMENT_PENDING: ['COMPLETED', 'PAYMENT_FAILED', 'CANCELLED'],
  PAYMENT_FAILED: ['PAYMENT_PENDING', 'CANCELLED'],
  PAYMENT_VERIFICATION_PENDING: ['COMPLETED', 'PAYMENT_FAILED'],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
  EXPIRED: []
};

export async function createSeatRequest({ authority_id, requested_by = null, type = 'topup', quantity, reason = '', registration_ids = [] }) {
  const qty = parseInt(quantity);
  if (!Number.isInteger(qty) || qty < 1) {
    throw Object.assign(new Error('Quantity must be a positive integer'), { status: 400 });
  }
  const info = await db.prepare(
    `INSERT INTO billing_seat_requests (authority_id, requested_by, type, quantity, reason, status)
     VALUES (?, ?, ?, ?, ?, 'REQUESTED')`
  ).run(authority_id, requested_by, type, qty, reason);
  return await getSeatRequest(info.lastInsertRowid);
}

export async function getSeatRequest(id) {
  return await db.prepare('SELECT * FROM billing_seat_requests WHERE request_id = ?').get(id);
}

export async function transitionSeatRequest(req, to, { actor_type = 'user', actor_id = null, meta = {} } = {}) {
  const allowed = SEAT_TRANSITIONS[req.status] || [];
  if (!allowed.includes(to)) {
    throw Object.assign(new Error(`Cannot move seat request from ${req.status} to ${to}`), { status: 409 });
  }
  if (['REJECTED'].includes(to)) {
    await db.prepare(`UPDATE billing_seat_requests SET status = ?, reject_reason = ?, decided_by = ?, decided_at = NOW(), updated_at = NOW() WHERE request_id = ?`)
      .run(to, meta.reject_reason || '', actor_id, req.request_id);
  } else if (to === 'APPROVED_AWAITING_PAYMENT') {
    await db.prepare(`UPDATE billing_seat_requests SET status = ?, decided_by = ?, decided_at = NOW(), updated_at = NOW() WHERE request_id = ?`)
      .run(to, actor_id, req.request_id);
  } else {
    await db.prepare(`UPDATE billing_seat_requests SET status = ?, updated_at = NOW() WHERE request_id = ?`)
      .run(to, req.request_id);
  }
  await audit('seat_request.transition', { actor_type, actor_id, authority_id: req.authority_id, target_type: 'seat_request', target_id: req.request_id, meta: { from: req.status, to, ...meta } });
  return await getSeatRequest(req.request_id);
}

// ---------- Staff registrations (join queue) ----------

const VALID_STAFF_ROLES = ['junior', 'senior', 'mayor', 'wit', 'field', 'admin'];

export async function createRegistration({ authority_id, full_name, email, phone = null, staff_role_requested = 'junior', department = 'general', employee_ref = '' }) {
  const emailLc = String(email || '').trim().toLowerCase();
  if (!full_name?.trim() || !emailLc || !emailLc.includes('@')) {
    throw Object.assign(new Error('Full name and a valid email are required'), { status: 400 });
  }
  if (!VALID_STAFF_ROLES.includes(staff_role_requested)) {
    throw Object.assign(new Error('Invalid staff role requested'), { status: 400 });
  }
  const auth = await db.prepare('SELECT authority_id FROM authorities WHERE authority_id = ?').get(authority_id);
  if (!auth) throw Object.assign(new Error('Unknown organization'), { status: 404 });
  const dupStaff = await db.prepare('SELECT staff_id FROM staff WHERE email = ?').get(emailLc);
  if (dupStaff) throw Object.assign(new Error('This email is already a staff account'), { status: 409 });
  try {
    const info = await db.prepare(
      `INSERT INTO billing_registrations (authority_id, full_name, email, phone, staff_role_requested, department, employee_ref, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`
    ).run(authority_id, full_name.trim(), emailLc, phone, staff_role_requested, department, employee_ref);
    return await getRegistration(info.lastInsertRowid);
  } catch (e) {
    throw Object.assign(new Error('Could not record registration request'), { status: 500 });
  }
}

export async function getRegistration(id) {
  return await db.prepare('SELECT * FROM billing_registrations WHERE reg_id = ?').get(id);
}

export async function setRegistrationStatus(reg, to, { actor_id = null, reason = '' } = {}) {
  const flow = { pending: ['verified', 'rejected'], verified: ['approved', 'rejected'], approved: ['activated', 'rejected'], rejected: [], activated: [] };
  if (!(flow[reg.status] || []).includes(to)) {
    throw Object.assign(new Error(`Cannot move registration from ${reg.status} to ${to}`), { status: 409 });
  }
  await db.prepare(
    `UPDATE billing_registrations SET status = ?, reject_reason = ?, decided_by = ?, updated_at = NOW() WHERE reg_id = ?`
  ).run(to, reason, actor_id, reg.reg_id);
  await audit('registration.transition', { actor_id, authority_id: reg.authority_id, target_type: 'registration', target_id: reg.reg_id, meta: { from: reg.status, to, reason } });
  return await getRegistration(reg.reg_id);
}

/** LGI admin sets the initial password at verification time (stored hashed). */
export async function setRegistrationPassword(regId, password, { actor_id = null } = {}) {
  if (!password || password.length < 8) {
    throw Object.assign(new Error('Initial password must be 8+ characters'), { status: 400 });
  }
  const reg = await getRegistration(regId);
  if (!reg) throw Object.assign(new Error('Registration not found'), { status: 404 });
  if (!['verified', 'approved'].includes(reg.status)) {
    throw Object.assign(new Error('Set the password after verification'), { status: 409 });
  }
  const hash = bcrypt.hashSync(password, 10);
  await db.prepare(`UPDATE billing_registrations SET pending_password_hash = ?, updated_at = NOW() WHERE reg_id = ?`)
    .run(hash, regId);
  await audit('registration.password_set', { actor_id, authority_id: reg.authority_id, target_type: 'registration', target_id: regId });
  return await getRegistration(regId);
}

/**
 * Insert a staff row while consuming exactly one seat, atomically.
 * Throws 409 NO_SEATS when a managed org has no free license.
 * Caller must hold no transaction (this opens its own).
 */
export async function insertStaffRow({ authority_id, full_name, email, password_hash, department = 'general', staff_role = 'junior' }) {
  const usage = await seatUsage(authority_id);
  if (usage.mode === 'managed' && usage.available < 1) {
    throw Object.assign(new Error('No available licenses — request additional seats first'), { status: 409, code: 'NO_SEATS' });
  }
  let staffId;
  try {
    const info = await db.prepare(
      `INSERT INTO staff (full_name, email, password_hash, department, authority_id, staff_role, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`
    ).run(full_name, email, password_hash, department, authority_id, staff_role);
    staffId = info.lastInsertRowid;
  } catch (e) {
    throw Object.assign(new Error('Email is already a staff account'), { status: 409 });
  }
  return await db.prepare('SELECT * FROM staff WHERE staff_id = ?').get(staffId);
}

/**
 * Activate a verified+approved registration: consumes one seat atomically
 * and creates the staff row. Throws 409 when no seat is free (caller then
 * links/creates a seat request instead of charging anything).
 */
export async function activateRegistration(regId, { actor_id = null, password = null } = {}) {
  const reg0 = await getRegistration(regId);
  if (!reg0) throw Object.assign(new Error('Registration not found'), { status: 404 });
  const hash = password
    ? (password.length >= 8 ? bcrypt.hashSync(password, 10) : null)
    : reg0.pending_password_hash;
  if (!hash) {
    throw Object.assign(new Error('An initial password of 8+ characters is required (set at verification or pass one now)'), { status: 400 });
  }
  const reg = await getRegistration(regId);
  if (!reg) throw Object.assign(new Error('Registration not found'), { status: 404 });
  if (reg.status !== 'approved') {
    throw Object.assign(new Error('Registration must be verified and approved first'), { status: 409 });
  }
  const usage = await seatUsage(reg.authority_id);
  if (usage.mode === 'managed' && usage.available < 1) {
    throw Object.assign(new Error('No available licenses — request additional seats first'), { status: 409, code: 'NO_SEATS' });
  }
  let staff;
  try {
    const info = await db.prepare(
      `INSERT INTO staff (full_name, email, password_hash, department, authority_id, staff_role, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`
    ).run(reg.full_name, reg.email, hash, reg.department, reg.authority_id, reg.staff_role_requested);
    staff = await db.prepare('SELECT * FROM staff WHERE staff_id = ?').get(info.lastInsertRowid);
  } catch (e) {
    throw Object.assign(new Error('Email is already a staff account'), { status: 409 });
  }
  await db.prepare(`UPDATE billing_registrations SET status = 'activated', staff_id = ?, updated_at = NOW() WHERE reg_id = ?`)
    .run(staff.staff_id, regId);
  await audit('registration.activated', { actor_id, authority_id: reg.authority_id, target_type: 'staff', target_id: staff.staff_id, meta: { reg_id: regId } });
  return { staff_id: staff.staff_id, registration: await getRegistration(regId) };
}

// ---------- Organizations & onboarding ----------

const ORG_TRANSITIONS = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['UNDER_REVIEW', 'REJECTED'],
  UNDER_REVIEW: ['NEEDS_INFORMATION', 'VERIFIED', 'REJECTED'],
  NEEDS_INFORMATION: ['UNDER_REVIEW', 'REJECTED'],
  VERIFIED: ['PENDING_PAYMENT', 'REJECTED'],
  PENDING_PAYMENT: ['ACTIVE', 'REJECTED'],
  ACTIVE: ['SUSPENDED'],
  SUSPENDED: ['ACTIVE'],
  REJECTED: []
};

export async function submitOnboarding(payload, repUserId = null) {
  const { authority_id = null, name, type, division = null, district = null, address = '',
    contact_email, contact_phone = '', rep_name, rep_designation, requested_seats = 1, plan_id = null } = payload || {};
  if (!name?.trim() || !type || !contact_email?.includes('@') || !rep_name?.trim() || !rep_designation?.trim()) {
    throw Object.assign(new Error('Organization name, type, contact email, representative name and designation are required'), { status: 400 });
  }
  if (!['CITY_CORPORATION', 'POUROSHOVA', 'UNION_PARISHAD'].includes(type)) {
    throw Object.assign(new Error('Invalid LGI type'), { status: 400 });
  }
  if (authority_id) {
    const a = await db.prepare('SELECT authority_id FROM authorities WHERE authority_id = ?').get(authority_id);
    if (!a) throw Object.assign(new Error('Unknown authority'), { status: 404 });
    const dup = await db.prepare('SELECT org_id, status FROM billing_organizations WHERE authority_id = ? AND status NOT IN (\'REJECTED\')').get(authority_id);
    if (dup) throw Object.assign(new Error('This organization already has an onboarding record'), { status: 409 });
  }
  const info = await db.prepare(
    `INSERT INTO billing_organizations (authority_id, name, type, division, district, address, contact_email, contact_phone, rep_name, rep_designation, rep_user_id, requested_seats, plan_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SUBMITTED')`
  ).run(authority_id, name.trim(), type, division, district, address, contact_email.toLowerCase(), contact_phone,
    rep_name.trim(), rep_designation.trim(), repUserId, Math.max(1, parseInt(requested_seats) || 1), plan_id);
  const org = await db.prepare('SELECT * FROM billing_organizations WHERE org_id = ?').get(info.lastInsertRowid);
  await audit('org.submitted', { actor_id: repUserId, authority_id, target_type: 'organization', target_id: org.org_id, meta: { name } });
  await tellSuperAdmins('New LGI onboarding request', `${name} (${type}) requested onboarding with ${org.requested_seats} seat(s). Review it in the Super Admin console.`);
  return org;
}

export async function getOrganization(id) {
  return await db.prepare('SELECT * FROM billing_organizations WHERE org_id = ?').get(id);
}

export async function transitionOrganization(org, to, { actor_id = null, note = '' } = {}) {
  const allowed = ORG_TRANSITIONS[org.status] || [];
  if (!allowed.includes(to)) {
    throw Object.assign(new Error(`Cannot move organization from ${org.status} to ${to}`), { status: 409 });
  }
  await db.prepare(`UPDATE billing_organizations SET status = ?, reviewer = ?, review_note = ?, updated_at = NOW() WHERE org_id = ?`)
    .run(to, actor_id, note, org.org_id);
  await audit('org.transition', { actor_type: 'super_admin', actor_id, authority_id: org.authority_id, target_type: 'organization', target_id: org.org_id, meta: { from: org.status, to, note } });
  return await getOrganization(org.org_id);
}

export async function getOrCreateSubscription(authorityId, planId) {
  let sub = await getSubscription(authorityId);
  if (sub) return sub;
  const plan = await db.prepare('SELECT * FROM billing_plans WHERE plan_id = ?').get(planId);
  if (!plan) throw Object.assign(new Error('Unknown plan'), { status: 404 });
  const info = await db.prepare(
    `INSERT INTO billing_subscriptions (authority_id, plan_id, status, paid_seats) VALUES (?, ?, 'PENDING', 0)`
  ).run(authorityId, planId);
  sub = await db.prepare('SELECT * FROM billing_subscriptions WHERE subscription_id = ?').get(info.lastInsertRowid);
  await audit('subscription.created', { authority_id: authorityId, target_type: 'subscription', target_id: sub.subscription_id, meta: { plan_id: planId } });
  return sub;
}

export async function setSubscriptionStatus(sub, to, { actor_id = null, actor_type = 'super_admin' } = {}) {
  const flow = {
    PENDING: ['ACTIVE', 'CANCELLED'], ACTIVE: ['RENEWAL_PENDING', 'EXPIRED', 'SUSPENDED', 'CANCELLED'],
    RENEWAL_PENDING: ['ACTIVE', 'EXPIRED', 'SUSPENDED', 'CANCELLED'], EXPIRED: ['ACTIVE', 'SUSPENDED', 'CANCELLED'],
    SUSPENDED: ['ACTIVE', 'CANCELLED'], CANCELLED: []
  };
  if (!(flow[sub.status] || []).includes(to)) {
    throw Object.assign(new Error(`Cannot move subscription from ${sub.status} to ${to}`), { status: 409 });
  }
  await db.prepare(`UPDATE billing_subscriptions SET status = ?, updated_at = NOW() WHERE subscription_id = ?`).run(to, sub.subscription_id);
  await audit('subscription.transition', { actor_type, actor_id, authority_id: sub.authority_id, target_type: 'subscription', target_id: sub.subscription_id, meta: { from: sub.status, to } });
  return await db.prepare('SELECT * FROM billing_subscriptions WHERE subscription_id = ?').get(sub.subscription_id);
}

// ---------- Business analytics (super admin) ----------
export async function businessSummary() {
  const q = async (sql, ...a) => await db.prepare(sql).get(...a);
  return {
    organizations: {
      total: (await q('SELECT COUNT(*) AS n FROM billing_organizations')).n,
      by_status: await db.prepare('SELECT status, COUNT(*) AS n FROM billing_organizations GROUP BY status').all()
    },
    subscriptions: {
      active: (await q("SELECT COUNT(*) AS n FROM billing_subscriptions WHERE status = 'ACTIVE'")).n,
      expired: (await q("SELECT COUNT(*) AS n FROM billing_subscriptions WHERE status = 'EXPIRED'")).n,
      suspended: (await q("SELECT COUNT(*) AS n FROM billing_subscriptions WHERE status = 'SUSPENDED'")).n,
      paid_seats: (await q('SELECT COALESCE(SUM(paid_seats),0) AS n FROM billing_subscriptions')).n,
      allocated_seats: (await q('SELECT COUNT(*) AS n FROM staff WHERE is_active = 1 AND authority_id IN (SELECT authority_id FROM billing_subscriptions)')).n
    },
    seat_requests: {
      pending: (await q("SELECT COUNT(*) AS n FROM billing_seat_requests WHERE status IN ('REQUESTED','EMPLOYEE_VERIFICATION_PENDING','AWAITING_FINANCIAL_APPROVAL')")).n,
      awaiting_payment: (await q("SELECT COUNT(*) AS n FROM billing_seat_requests WHERE status IN ('APPROVED_AWAITING_PAYMENT','PAYMENT_PENDING','PAYMENT_VERIFICATION_PENDING')")).n
    },
    money: {
      gross_collected: (await q("SELECT COALESCE(SUM(amount),0) AS n FROM billing_payments WHERE status = 'SUCCESS'")).n,
      refunded: (await q("SELECT COALESCE(SUM(amount),0) AS n FROM billing_refunds WHERE status = 'COMPLETED'")).n,
      outstanding_invoices: (await q("SELECT COALESCE(SUM(total),0) AS n FROM billing_invoices WHERE status IN ('issued','pending')")).n,
      by_status: await db.prepare('SELECT status, COUNT(*) AS n, COALESCE(SUM(amount),0) AS amount FROM billing_payments GROUP BY status').all()
    },
    expiring_soon: await db.prepare(
      `SELECT s.*, a.name AS authority_name FROM billing_subscriptions s
       JOIN authorities a ON a.authority_id = s.authority_id
       WHERE s.status = 'ACTIVE' AND s.expires_at IS NOT NULL
         AND s.expires_at <= NOW() + INTERVAL '30 days' ORDER BY s.expires_at ASC LIMIT 50`
    ).all()
  };
}

export async function orgSummary(authorityId) {
  const sub = await getSubscription(authorityId);
  const usage = await seatUsage(authorityId);
  return {
    subscription: sub,
    seats: { paid: usage.paid, allocated: usage.allocated, reserved: usage.reserved, available: usage.mode === 'legacy' ? null : usage.available, mode: usage.mode },
    policy: await subscriptionPolicy(authorityId),
    pending_registrations: (await db.prepare(`SELECT COUNT(*) AS n FROM billing_registrations WHERE authority_id = ? AND status IN ('pending','verified','approved')`).get(authorityId)).n,
    open_seat_requests: await db.prepare(`SELECT * FROM billing_seat_requests WHERE authority_id = ? AND status NOT IN ('COMPLETED','REJECTED','CANCELLED','EXPIRED') ORDER BY updated_at DESC`).all(authorityId),
    recent_invoices: await db.prepare('SELECT * FROM billing_invoices WHERE authority_id = ? ORDER BY invoice_id DESC LIMIT 10').all(authorityId),
    recent_payments: await db.prepare('SELECT * FROM billing_payments WHERE authority_id = ? ORDER BY payment_id DESC LIMIT 10').all(authorityId)
  };
}

export async function deactivateStaff(staffId, { actor_id = null, reason = '' } = {}) {
  const row = await db.prepare('SELECT * FROM staff WHERE staff_id = ?').get(staffId);
  if (!row) throw Object.assign(new Error('Staff not found'), { status: 404 });
  await db.prepare('UPDATE staff SET is_active = 0 WHERE staff_id = ?').run(staffId);
  await audit('staff.deactivated', { actor_id, authority_id: row.authority_id, target_type: 'staff', target_id: staffId, meta: { reason } });
  return await db.prepare('SELECT * FROM staff WHERE staff_id = ?').get(staffId);
}

export async function reactivateStaff(staffId, { actor_id = null } = {}) {
  const row = await db.prepare('SELECT * FROM staff WHERE staff_id = ?').get(staffId);
  if (!row) throw Object.assign(new Error('Staff not found'), { status: 404 });
  const usage = await seatUsage(row.authority_id);
  if (usage.mode === 'managed' && usage.available < 1) {
    throw Object.assign(new Error('No available licenses to reactivate this account'), { status: 409, code: 'NO_SEATS' });
  }
  await db.prepare('UPDATE staff SET is_active = 1 WHERE staff_id = ?').run(staffId);
  await audit('staff.reactivated', { actor_id, authority_id: row.authority_id, target_type: 'staff', target_id: staffId });
  return await db.prepare('SELECT * FROM staff WHERE staff_id = ?').get(staffId);
}

// ---------- Invoices ----------

export async function issueInvoice({ authority_id, subscription_id = null, seat_request_id = null, type = 'topup', quote: q, due_days = 7 }) {
  const year = new Date().getUTCFullYear();
  const invoiceNo = await nextInvoiceNo(year);
  const due = new Date(Date.now() + due_days * 86400000).toISOString().slice(0, 19).replace('T', ' ');
  const info = await db.prepare(
    `INSERT INTO billing_invoices (invoice_no, authority_id, subscription_id, seat_request_id, type, lines_json, subtotal, vat, total, currency, status, due_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'issued', ?)`
  ).run(invoiceNo, authority_id, subscription_id, seat_request_id, type,
    JSON.stringify(q.lines), q.subtotal, q.vat, q.total, q.currency, due);
  const inv = await db.prepare('SELECT * FROM billing_invoices WHERE invoice_id = ?').get(info.lastInsertRowid);
  await audit('invoice.issued', { authority_id, target_type: 'invoice', target_id: inv.invoice_id, meta: { invoice_no: invoiceNo, total: q.total } });
  return inv;
}

/**
 * Suspension gate for staff write actions (workflow decisions, status
 * changes). Authorities WITHOUT a subscription row are grandfathered
 * (legacy mode, always allowed) so every existing seeded/demo account
 * keeps working exactly as before. Citizens are never gated.
 */
export async function billingWriteGate(req, res, next) {
  try {
    if (req.auth?.role !== 'staff') return next();
    const row = await db.prepare('SELECT authority_id FROM staff WHERE staff_id = ?').get(req.auth.id);
    if (!row) return next();
    const policy = await subscriptionPolicy(row.authority_id);
    if (policy.allowed) {
      if (policy.expiringSoon || policy.inGrace) res.setHeader('X-Billing-Warning', policy.message || 'Subscription expiring soon');
      return next();
    }
    return res.status(402).json({ error: policy.message, code: 'SUBSCRIPTION_INACTIVE' });
  } catch (e) {
    return next();
  }
}

/**
 * Appoint (or promote) the LGI Technical Admin for an authority.
 * Shared by the onboarding flow and the super-admin direct tool.
 */
export async function appointAdmin(authorityId, { full_name, name, email, password }, { actor_id = null, actor_type = 'super_admin' } = {}) {
  const auth = await db.prepare('SELECT authority_id, name FROM authorities WHERE authority_id = ?').get(authorityId);
  if (!auth) throw Object.assign(new Error('Unknown authority'), { status: 404 });
  const displayName = (full_name || name || '').trim();
  if (!displayName || !email?.includes('@') || !password || password.length < 8) {
    throw Object.assign(new Error('Name, valid email and 8+ character password are required'), { status: 400 });
  }
  const emailLc = email.trim().toLowerCase();
  const existing = await db.prepare('SELECT * FROM staff WHERE email = ?').get(emailLc);
  if (existing) {
    if (existing.authority_id !== authorityId) {
      throw Object.assign(new Error('This email already belongs to another organization'), { status: 409 });
    }
    await db.prepare(`UPDATE staff SET staff_role = 'admin', is_active = 1 WHERE staff_id = ?`).run(existing.staff_id);
    await audit('org.admin_assigned', { actor_type, actor_id, authority_id: authorityId, target_type: 'staff', target_id: existing.staff_id });
    return await db.prepare('SELECT staff_id, full_name, email, staff_role, is_active FROM staff WHERE staff_id = ?').get(existing.staff_id);
  }
  const hash = bcrypt.hashSync(password, 10);
  const info = await db.prepare(
    `INSERT INTO staff (full_name, email, password_hash, department, authority_id, staff_role, is_active)
     VALUES (?, ?, ?, 'general', ?, 'admin', 1)`
  ).run(displayName, emailLc, hash, authorityId);
  await audit('org.admin_created', { actor_type, actor_id, authority_id: authorityId, target_type: 'staff', target_id: info.lastInsertRowid });
  await tellStaff(info.lastInsertRowid, 'LGI admin account created', `You are the technical admin for your LGI. Use your email and the password given to you to log in.`);
  return await db.prepare('SELECT staff_id, full_name, email, staff_role, is_active FROM staff WHERE staff_id = ?').get(info.lastInsertRowid);
}

/**
 * Hard-remove a staff account (super admin only via routes). Refuses when
 * live references exist, listing the blockers instead of breaking history.
 */
export async function removeStaff(staffId, { actor_id = null } = {}) {
  const row = await db.prepare('SELECT * FROM staff WHERE staff_id = ?').get(staffId);
  if (!row) throw Object.assign(new Error('Staff not found'), { status: 404 });
  const blockers = [];
  const refCount = async (sql) => (await db.prepare(sql).get(staffId, staffId)).n;
  const checks = [
    ['assigned complaints', 'SELECT COUNT(*) AS n FROM complaints WHERE assigned_staff_id = ? OR executor_staff_id = ?'],
    ['workflow steps', 'SELECT COUNT(*) AS n FROM workflow_steps WHERE actor_staff_id = ? OR actor_staff_id = ?'],
    ['badges', 'SELECT COUNT(*) AS n FROM staff_badges WHERE staff_id = ? OR staff_id = ?'],
    ['recognitions', 'SELECT COUNT(*) AS n FROM staff_recognitions WHERE staff_id = ? OR awarded_by = ?'],
    ['pending registrations', 'SELECT COUNT(*) AS n FROM billing_registrations WHERE staff_id = ? OR staff_id = ?'],
  ];
  for (const [label, sql] of checks) {
    if ((await refCount(sql)) > 0) blockers.push(label);
  }
  if (blockers.length) {
    throw Object.assign(new Error(`Cannot remove: referenced by ${blockers.join(', ')}. Deactivate instead to preserve history.`), { status: 409 });
  }
  await db.prepare('DELETE FROM notifications WHERE user_id = ?').run(staffId);
  await db.prepare('DELETE FROM staff WHERE staff_id = ?').run(staffId);
  await audit('staff.removed', { actor_type: 'super_admin', actor_id, authority_id: row.authority_id, target_type: 'staff', target_id: staffId, meta: { email: row.email, staff_role: row.staff_role } });
  return { removed: staffId };
}
