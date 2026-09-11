import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(path.join(dataDir, 'nagorik.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'citizen',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS authorities (
      authority_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('CITY_CORPORATION','POUROSHOVA','UNION_PARISHAD')),
      min_lat REAL NOT NULL, max_lat REAL NOT NULL,
      min_lng REAL NOT NULL, max_lng REAL NOT NULL,
      phone TEXT, email TEXT
    );

    CREATE TABLE IF NOT EXISTS staff (
      staff_id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      department TEXT NOT NULL DEFAULT 'general',
      authority_id INTEGER NOT NULL REFERENCES authorities(authority_id)
    );

    CREATE TABLE IF NOT EXISTS complaints (
      complaint_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(user_id),
      authority_id INTEGER REFERENCES authorities(authority_id),
      assigned_staff_id INTEGER REFERENCES staff(staff_id),
      duplicate_of_id INTEGER REFERENCES complaints(complaint_id),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'other',
      image_url TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      address_text TEXT,
      status TEXT NOT NULL DEFAULT 'submitted',
      priority_score REAL NOT NULL DEFAULT 0,
      vote_count INTEGER NOT NULL DEFAULT 0,
      eta_hours INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
    CREATE INDEX IF NOT EXISTS idx_complaints_authority ON complaints(authority_id);

    CREATE TABLE IF NOT EXISTS votes (
      vote_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(user_id),
      complaint_id INTEGER NOT NULL REFERENCES complaints(complaint_id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (user_id, complaint_id)
    );

    CREATE TABLE IF NOT EXISTS emergency_services (
      service_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL
        CHECK (type IN ('fire_service','police_station','wasa','lged','desa','titas_gas','public_toilet')),
      phone TEXT NOT NULL,
      address TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS status_history (
      history_id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id INTEGER NOT NULL REFERENCES complaints(complaint_id),
      old_status TEXT,
      new_status TEXT NOT NULL,
      note TEXT,
      changed_by TEXT,
      changed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      recipient_type TEXT NOT NULL DEFAULT 'citizen' CHECK (recipient_type IN ('citizen','staff')),
      complaint_id INTEGER REFERENCES complaints(complaint_id),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS agent_logs (
      log_id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id INTEGER REFERENCES complaints(complaint_id),
      agent_name TEXT NOT NULL,
      decision TEXT NOT NULL,
      input_summary TEXT,
      output_summary TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS workflow_steps (
      step_id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id INTEGER NOT NULL REFERENCES complaints(complaint_id),
      stage TEXT NOT NULL
        CHECK (stage IN ('junior_review','senior_review','mayor_review','wit_inspection','assignment','execution')),
      action TEXT NOT NULL
        CHECK (action IN ('pending','reviewing','approved','rejected','assigned','resolved','returned')),
      actor_staff_id INTEGER REFERENCES staff(staff_id),
      actor_name TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      comment TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_workflow_complaint ON workflow_steps(complaint_id);
  `);

  migrate();
}

function addColumn(table, column, decl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
  }
}

function migrate() {
  addColumn('users', 'face_verified', 'INTEGER NOT NULL DEFAULT 0');
  addColumn('users', 'selfie_url', 'TEXT');
  addColumn('users', 'id_photo_url', 'TEXT');

  addColumn('complaints', 'division', 'TEXT');
  addColumn('complaints', 'district', 'TEXT');
  addColumn('complaints', 'area_text', 'TEXT');
  addColumn('complaints', 'ward', 'TEXT');
  addColumn('complaints', 'road', 'TEXT');
  addColumn('complaints', 'sector', 'TEXT');
  addColumn('complaints', 'village', 'TEXT');
  addColumn('complaints', 'upazila', 'TEXT');
  addColumn('complaints', 'full_address', 'TEXT');
  addColumn('complaints', 'current_stage', 'TEXT');
  addColumn('complaints', 'stage_owner_role', 'TEXT');
  addColumn('complaints', 'assigned_staff_id', 'INTEGER');
  addColumn('complaints', 'executor_staff_id', 'INTEGER');
  addColumn('complaints', 'executor_name', 'TEXT');
  addColumn('complaints', 'rejected_at_stage', 'TEXT');

  addColumn('authorities', 'division', 'TEXT');
  addColumn('authorities', 'district', 'TEXT');
  addColumn('authorities', 'center_lat', 'REAL');
  addColumn('authorities', 'center_lng', 'REAL');
  addColumn('authorities', 'upazila', 'TEXT');

  // Staff hierarchy: junior (initial check), senior (feasibility), mayor
  // (permission), wit (work inspection team, assigns field staff), field
  // (executor). Old installs may carry 'field'/'mid' roles — remap them.
  addColumn('staff', 'staff_role', "TEXT NOT NULL DEFAULT 'junior'");
  addColumn('notifications', 'recipient_type', "TEXT NOT NULL DEFAULT 'citizen'");

  // The notifications table originally had user_id REFERENCES users(user_id),
  // which made staff notifications impossible (staff live in the staff table).
  // Rebuild without the FK so both citizen and staff can be notified.
  const notifHasFk = db.prepare(
    `SELECT 1 FROM pragma_foreign_key_list('notifications') WHERE "table" = 'users'`
  ).get();
  if (notifHasFk) {
    db.exec(`
      CREATE TABLE notifications_new (
        notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        recipient_type TEXT NOT NULL DEFAULT 'citizen' CHECK (recipient_type IN ('citizen','staff')),
        complaint_id INTEGER REFERENCES complaints(complaint_id),
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        is_read INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO notifications_new (user_id, recipient_type, complaint_id, title, message, is_read, created_at)
        SELECT user_id, 'citizen', complaint_id, title, message, is_read, created_at FROM notifications;
      DROP TABLE notifications;
      ALTER TABLE notifications_new RENAME TO notifications;
    `);
  }

  // Existing 'verified' complaints in the old flat flow are, in the new
  // hierarchical flow, complaints waiting for the junior staff initial check.
  db.exec(`UPDATE complaints SET current_stage = 'junior_review', stage_owner_role = 'junior'
           WHERE status = 'verified'`);
  db.exec(`UPDATE complaints SET current_stage = 'senior_review', stage_owner_role = 'senior'
           WHERE status IN ('in_process','resolved') AND current_stage IS NULL`);
}

export function logAgent({ complaintId = null, agentName, decision, inputSummary = '', outputSummary = '' }) {
  db.prepare(
    `INSERT INTO agent_logs (complaint_id, agent_name, decision, input_summary, output_summary)
     VALUES (?, ?, ?, ?, ?)`
  ).run(complaintId, agentName, decision, inputSummary, outputSummary);
}

export function logWorkflowStep({ complaintId, stage, action, actorStaffId = null, actorName, actorRole, comment = null }) {
  db.prepare(
    `INSERT INTO workflow_steps (complaint_id, stage, action, actor_staff_id, actor_name, actor_role, comment)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(complaintId, stage, action, actorStaffId, actorName, actorRole, comment);
}

export function notify(userId, complaintId, title, message, recipientType = 'citizen') {
  db.prepare(
    `INSERT INTO notifications (user_id, recipient_type, complaint_id, title, message) VALUES (?, ?, ?, ?, ?)`
  ).run(userId, recipientType, complaintId, title, message);
}
