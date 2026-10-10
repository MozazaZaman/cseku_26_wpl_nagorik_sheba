import { db } from '../db.js';

const TABLES = `
CREATE TABLE IF NOT EXISTS billing_plans (
  plan_id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  billing_period TEXT NOT NULL DEFAULT 'annual' CHECK (billing_period IN ('monthly','annual')),
  currency TEXT NOT NULL DEFAULT 'BDT',
  pricing_model TEXT NOT NULL DEFAULT 'per_seat' CHECK (pricing_model IN ('per_seat','band','base_plus_seat')),
  base_fee INTEGER NOT NULL DEFAULT 0,
  per_seat_fee INTEGER NOT NULL DEFAULT 0,
  bands_json TEXT DEFAULT '[]',
  min_seats INTEGER NOT NULL DEFAULT 1,
  max_seats INTEGER,
  vat_percent DOUBLE PRECISION NOT NULL DEFAULT 0,
  grace_days INTEGER NOT NULL DEFAULT 14,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  terms_version TEXT DEFAULT 'v1',
  features_json TEXT DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS billing_subscriptions (
  subscription_id SERIAL PRIMARY KEY,
  authority_id INTEGER NOT NULL UNIQUE REFERENCES authorities(authority_id),
  plan_id INTEGER NOT NULL REFERENCES billing_plans(plan_id),
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','ACTIVE','RENEWAL_PENDING','EXPIRED','SUSPENDED','CANCELLED')),
  paid_seats INTEGER NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  grace_until TIMESTAMPTZ,
  last_renewal_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_billing_sub_auth ON billing_subscriptions(authority_id);
CREATE INDEX IF NOT EXISTS idx_billing_sub_status ON billing_subscriptions(status, expires_at);

CREATE TABLE IF NOT EXISTS billing_invoices (
  invoice_id SERIAL PRIMARY KEY,
  invoice_no TEXT NOT NULL UNIQUE,
  authority_id INTEGER NOT NULL REFERENCES authorities(authority_id),
  subscription_id INTEGER REFERENCES billing_subscriptions(subscription_id),
  seat_request_id INTEGER,
  type TEXT NOT NULL DEFAULT 'seats' CHECK (type IN ('initial','topup','renewal','upgrade')),
  lines_json TEXT NOT NULL DEFAULT '[]',
  subtotal INTEGER NOT NULL DEFAULT 0,
  vat INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BDT',
  status TEXT NOT NULL DEFAULT 'issued'
    CHECK (status IN ('issued','pending','paid','failed','cancelled','refunded','partially_refunded')),
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inv_auth ON billing_invoices(authority_id, status);

CREATE TABLE IF NOT EXISTS billing_seat_requests (
  request_id SERIAL PRIMARY KEY,
  authority_id INTEGER NOT NULL REFERENCES authorities(authority_id),
  requested_by INTEGER,
  type TEXT NOT NULL DEFAULT 'topup' CHECK (type IN ('initial','topup')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  reason TEXT DEFAULT '',
  price_snapshot_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'REQUESTED'
    CHECK (status IN ('REQUESTED','EMPLOYEE_VERIFICATION_PENDING','AWAITING_FINANCIAL_APPROVAL','REJECTED','APPROVED_AWAITING_PAYMENT','PAYMENT_PENDING','PAYMENT_FAILED','PAYMENT_VERIFICATION_PENDING','COMPLETED','CANCELLED','EXPIRED')),
  decided_by INTEGER,
  decided_at TIMESTAMPTZ,
  reject_reason TEXT DEFAULT '',
  invoice_id INTEGER REFERENCES billing_invoices(invoice_id),
  payment_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_seatreq_auth_status ON billing_seat_requests(authority_id, status);

CREATE TABLE IF NOT EXISTS billing_registrations (
  reg_id SERIAL PRIMARY KEY,
  authority_id INTEGER NOT NULL REFERENCES authorities(authority_id),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  staff_role_requested TEXT NOT NULL DEFAULT 'junior',
  department TEXT NOT NULL DEFAULT 'general',
  employee_ref TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','verified','approved','rejected','activated')),
  verified_by INTEGER,
  decided_by INTEGER,
  reject_reason TEXT DEFAULT '',
  pending_password_hash TEXT,
  seat_request_id INTEGER REFERENCES billing_seat_requests(request_id),
  staff_id INTEGER REFERENCES staff(staff_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reg_auth_status ON billing_registrations(authority_id, status);
CREATE INDEX IF NOT EXISTS idx_reg_email ON billing_registrations(email);

CREATE TABLE IF NOT EXISTS billing_payments (
  payment_id SERIAL PRIMARY KEY,
  txn_id TEXT NOT NULL UNIQUE,
  gateway TEXT NOT NULL DEFAULT 'sslcommerz' CHECK (gateway IN ('sslcommerz','manual')),
  gateway_txn_id TEXT UNIQUE,
  invoice_id INTEGER NOT NULL REFERENCES billing_invoices(invoice_id),
  authority_id INTEGER NOT NULL REFERENCES authorities(authority_id),
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BDT',
  status TEXT NOT NULL DEFAULT 'CREATED'
    CHECK (status IN ('CREATED','PENDING','SUCCESS','FAILED','CANCELLED','EXPIRED','REFUND_PENDING','PARTIALLY_REFUNDED','REFUNDED')),
  raw_json TEXT DEFAULT '{}',
  paid_by INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pay_invoice ON billing_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_pay_auth ON billing_payments(authority_id, status);

CREATE TABLE IF NOT EXISTS billing_payment_events (
  event_id SERIAL PRIMARY KEY,
  payment_id INTEGER NOT NULL REFERENCES billing_payments(payment_id),
  event TEXT NOT NULL,
  payload_json TEXT DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payev_pay ON billing_payment_events(payment_id);

CREATE TABLE IF NOT EXISTS billing_refunds (
  refund_id SERIAL PRIMARY KEY,
  payment_id INTEGER NOT NULL REFERENCES billing_payments(payment_id),
  amount INTEGER NOT NULL,
  reason TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'REQUESTED'
    CHECK (status IN ('REQUESTED','APPROVED','PROCESSING','COMPLETED','REJECTED')),
  decided_by INTEGER,
  gateway_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS billing_manual_payments (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES billing_invoices(invoice_id),
  authority_id INTEGER NOT NULL REFERENCES authorities(authority_id),
  reference TEXT NOT NULL,
  evidence_path TEXT,
  status TEXT NOT NULL DEFAULT 'UNDER_REVIEW'
    CHECK (status IN ('UNDER_REVIEW','VERIFIED','REJECTED')),
  submitted_by INTEGER,
  reviewer INTEGER,
  review_note TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS billing_organizations (
  org_id SERIAL PRIMARY KEY,
  authority_id INTEGER UNIQUE REFERENCES authorities(authority_id),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  division TEXT,
  district TEXT,
  address TEXT DEFAULT '',
  contact_email TEXT NOT NULL,
  contact_phone TEXT DEFAULT '',
  rep_name TEXT NOT NULL,
  rep_designation TEXT NOT NULL,
  rep_user_id INTEGER,
  requested_seats INTEGER NOT NULL DEFAULT 1,
  plan_id INTEGER REFERENCES billing_plans(plan_id),
  status TEXT NOT NULL DEFAULT 'SUBMITTED'
    CHECK (status IN ('DRAFT','SUBMITTED','UNDER_REVIEW','NEEDS_INFORMATION','VERIFIED','REJECTED','PENDING_PAYMENT','ACTIVE','SUSPENDED')),
  reviewer INTEGER,
  review_note TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_borg_status ON billing_organizations(status);

CREATE TABLE IF NOT EXISTS billing_audit (
  audit_id SERIAL PRIMARY KEY,
  actor_type TEXT NOT NULL DEFAULT 'user',
  actor_id INTEGER,
  authority_id INTEGER,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id INTEGER,
  outcome TEXT NOT NULL DEFAULT 'ok',
  meta_json TEXT DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_auth ON billing_audit(authority_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_action ON billing_audit(action, created_at);

CREATE TABLE IF NOT EXISTS billing_counters (
  name TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);
`;

export async function migrateBilling() {
  await db.exec(TABLES);
  await db.exec('ALTER TABLE staff ADD COLUMN IF NOT EXISTS is_active INTEGER NOT NULL DEFAULT 1');
  await db.exec('ALTER TABLE billing_registrations ADD COLUMN IF NOT EXISTS pending_password_hash TEXT');
  await db.exec(`ALTER TABLE billing_manual_payments ADD COLUMN IF NOT EXISTS method TEXT NOT NULL DEFAULT 'bank'`);
  await db.exec(`ALTER TABLE billing_manual_payments ADD COLUMN IF NOT EXISTS sender_account TEXT DEFAULT ''`);
  await db.exec('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_system_admin INTEGER NOT NULL DEFAULT 0');
  await db.exec(`UPDATE users SET is_system_admin = 1 WHERE role = 'super_admin'`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_staff_auth_active ON staff(authority_id, is_active)`);
  const planCount = (await db.prepare('SELECT COUNT(*) AS n FROM billing_plans').get()).n;
  if (planCount === 0) {
    await db.prepare(
      `INSERT INTO billing_plans
        (name, description, billing_period, currency, pricing_model, base_fee, per_seat_fee,
         min_seats, max_seats, vat_percent, grace_days, status, terms_version, features_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 'v1', ?)`
    ).run(
      'Standard Annual', 'Default institutional plan: annual per-seat licensing with VAT.',
      'annual', 'BDT', 'per_seat', 0, 50000, 1, null, 0, 14,
      JSON.stringify(['complaint_console', 'sla_tracking', 'badges', 'analytics', 'support'])
    );
  }
}
