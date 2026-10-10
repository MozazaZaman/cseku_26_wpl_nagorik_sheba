import pg from 'pg';

const { Pool, types } = pg;

types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));

const fmtTs = (v) => {
  if (v === null || v === undefined) return v;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
};
types.setTypeParser(1114, fmtTs);
types.setTypeParser(1184, fmtTs);
types.setTypeParser(1082, fmtTs);

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required (Neon PostgreSQL). Set it in server/.env or Render env vars.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000
});

export function toPg(sql) {
  let i = 0;
  let out = '';
  let inStr = false;
  for (let k = 0; k < sql.length; k++) {
    const c = sql[k];
    if (c === "'") {
      if (sql[k + 1] === "'") { out += "''"; k++; continue; }
      inStr = !inStr;
      out += c;
      continue;
    }
    if (c === '?' && !inStr) { out += `$${++i}`; continue; }
    out += c;
  }
  return out;
}

function makeApi(queryFn) {
  const prepare = (sql) => ({
    get: async (...params) => {
      const r = await queryFn(toPg(sql), params);
      return r.rows[0] ?? null;
    },
    all: async (...params) => (await queryFn(toPg(sql), params)).rows,
    run: async (...params) => {
      let q = sql;
      const ins = /^\s*insert\s+into\s+["']?(\w+)/i.exec(sql);
      if (ins) q = `${sql} RETURNING *`;
      const r = await queryFn(toPg(q), params);
      const first = r.rows[0];
      return {
        changes: r.rowCount,
        lastInsertRowid: first ? first[Object.keys(first)[0]] : undefined
      };
    }
  });
  const exec = async (sql) => {
    const cleaned = sql
      .split('\n')
      .filter((l) => !l.trim().startsWith('--'))
      .join('\n');
    const stmts = cleaned.split(';').map((s) => s.trim()).filter(Boolean);
    for (const s of stmts) await queryFn(s, []);
  };
  return { prepare, exec };
}

export const db = {
  ...makeApi((t, p) => pool.query(t, p)),
  transaction: async (fn) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const out = await fn(makeApi((t, p) => client.query(t, p)));
      await client.query('COMMIT');
      return out;
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch {}
      throw e;
    } finally {
      client.release();
    }
  }
};

export function closeDb() {
  return pool.end();
}

const CORE_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  user_id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'citizen',
  face_verified INTEGER NOT NULL DEFAULT 0,
  selfie_url TEXT,
  id_photo_url TEXT,
  is_system_admin INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS authorities (
  authority_id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('CITY_CORPORATION','POUROSHOVA','UNION_PARISHAD')),
  min_lat DOUBLE PRECISION NOT NULL, max_lat DOUBLE PRECISION NOT NULL,
  min_lng DOUBLE PRECISION NOT NULL, max_lng DOUBLE PRECISION NOT NULL,
  phone TEXT, email TEXT,
  division TEXT, district TEXT,
  center_lat DOUBLE PRECISION, center_lng DOUBLE PRECISION,
  upazila TEXT
);

CREATE TABLE IF NOT EXISTS staff (
  staff_id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT 'general',
  authority_id INTEGER NOT NULL REFERENCES authorities(authority_id),
  staff_role TEXT NOT NULL DEFAULT 'junior',
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS complaints (
  complaint_id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id),
  authority_id INTEGER REFERENCES authorities(authority_id),
  assigned_staff_id INTEGER REFERENCES staff(staff_id),
  duplicate_of_id INTEGER REFERENCES complaints(complaint_id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  image_url TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address_text TEXT,
  status TEXT NOT NULL DEFAULT 'submitted',
  priority_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  vote_count INTEGER NOT NULL DEFAULT 0,
  eta_hours INTEGER,
  division TEXT, district TEXT, area_text TEXT, ward TEXT, road TEXT,
  sector TEXT, village TEXT, upazila TEXT, full_address TEXT,
  current_stage TEXT, stage_owner_role TEXT,
  executor_staff_id INTEGER, executor_name TEXT, rejected_at_stage TEXT,
  resolution_image_url TEXT,
  resolved_confirmed_by_citizen INTEGER NOT NULL DEFAULT 0,
  confirmation_deadline TIMESTAMPTZ,
  stage_entered_at TIMESTAMPTZ, sla_deadline TIMESTAMPTZ,
  overdue_flag INTEGER NOT NULL DEFAULT 0,
  satisfaction_score INTEGER, satisfaction_comment TEXT,
  satisfaction_submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_authority ON complaints(authority_id);
CREATE INDEX IF NOT EXISTS idx_complaints_auth_status_created ON complaints(authority_id, status, created_at);

CREATE TABLE IF NOT EXISTS votes (
  vote_id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id),
  complaint_id INTEGER NOT NULL REFERENCES complaints(complaint_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, complaint_id)
);

CREATE TABLE IF NOT EXISTS emergency_services (
  service_id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL
    CHECK (type IN ('fire_service','police_station','wasa','lged','desa','titas_gas','public_toilet')),
  phone TEXT NOT NULL,
  address TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS status_history (
  history_id SERIAL PRIMARY KEY,
  complaint_id INTEGER NOT NULL REFERENCES complaints(complaint_id),
  old_status TEXT,
  new_status TEXT NOT NULL,
  note TEXT,
  changed_by TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  notification_id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  recipient_type TEXT NOT NULL DEFAULT 'citizen' CHECK (recipient_type IN ('citizen','staff')),
  complaint_id INTEGER REFERENCES complaints(complaint_id),
  type TEXT NOT NULL DEFAULT 'status_change',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(recipient_type, user_id, is_read, created_at);

CREATE TABLE IF NOT EXISTS agent_logs (
  log_id SERIAL PRIMARY KEY,
  complaint_id INTEGER REFERENCES complaints(complaint_id),
  agent_name TEXT NOT NULL,
  decision TEXT NOT NULL,
  input_summary TEXT,
  output_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_reset_otps (
  otp_id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id),
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  reset_token TEXT,
  reset_token_expires_at TIMESTAMPTZ,
  reset_token_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_otp_user ON password_reset_otps(user_id);
CREATE INDEX IF NOT EXISTS idx_otp_token ON password_reset_otps(reset_token);

CREATE TABLE IF NOT EXISTS workflow_steps (
  step_id SERIAL PRIMARY KEY,
  complaint_id INTEGER NOT NULL REFERENCES complaints(complaint_id),
  stage TEXT NOT NULL
    CHECK (stage IN ('junior_review','senior_review','mayor_review','wit_inspection','assignment','execution')),
  action TEXT NOT NULL
    CHECK (action IN ('pending','reviewing','approved','rejected','assigned','resolved','returned')),
  actor_staff_id INTEGER REFERENCES staff(staff_id),
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_workflow_complaint ON workflow_steps(complaint_id);

CREATE TABLE IF NOT EXISTS staff_badges (
  badge_id SERIAL PRIMARY KEY,
  staff_id INTEGER NOT NULL REFERENCES staff(staff_id),
  badge_type TEXT NOT NULL,
  tier TEXT CHECK (tier IN ('bronze','silver','gold')),
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period_start TEXT,
  period_end TEXT,
  UNIQUE (staff_id, badge_type, period_start, period_end)
);
CREATE INDEX IF NOT EXISTS idx_badges_staff ON staff_badges(staff_id);
CREATE INDEX IF NOT EXISTS idx_badges_type ON staff_badges(badge_type);

CREATE TABLE IF NOT EXISTS staff_recognitions (
  recognition_id SERIAL PRIMARY KEY,
  staff_id INTEGER NOT NULL REFERENCES staff(staff_id),
  awarded_by INTEGER NOT NULL REFERENCES staff(staff_id),
  note TEXT NOT NULL,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_recognitions_staff ON staff_recognitions(staff_id);
`;

export async function initDb() {
  await db.exec(CORE_SCHEMA);
  const { migrateBilling } = await import('./billing/schema.js');
  await migrateBilling();
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_staff_auth_active ON staff(authority_id, is_active)`);
  await db.exec(`UPDATE complaints SET current_stage = 'junior_review', stage_owner_role = 'junior'
           WHERE status = 'verified'`);
  await db.exec(`UPDATE complaints SET current_stage = 'senior_review', stage_owner_role = 'senior'
           WHERE status IN ('in_process','resolved') AND current_stage IS NULL`);
}

export async function logAgent({ complaintId = null, agentName, decision, inputSummary = '', outputSummary = '' }) {
  await db.prepare(
    `INSERT INTO agent_logs (complaint_id, agent_name, decision, input_summary, output_summary)
     VALUES (?, ?, ?, ?, ?)`
  ).run(complaintId, agentName, decision, inputSummary, outputSummary);
}

export async function logWorkflowStep({ complaintId, stage, action, actorStaffId = null, actorName, actorRole, comment = null }) {
  await db.prepare(
    `INSERT INTO workflow_steps (complaint_id, stage, action, actor_staff_id, actor_name, actor_role, comment)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(complaintId, stage, action, actorStaffId, actorName, actorRole, comment);
}

export async function notify(userId, complaintId, title, message, recipientType = 'citizen', type = 'status_change') {
  await db.prepare(
    `INSERT INTO notifications (user_id, recipient_type, complaint_id, type, title, message)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(userId, recipientType, complaintId, type, title, message);
}
