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
      status TEXT NOT NULL DEFAULT 'submitted'
        CHECK (status IN ('submitted','verified','rejected','merged','in_process','resolved')),
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
      user_id INTEGER NOT NULL REFERENCES users(user_id),
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

  addColumn('authorities', 'division', 'TEXT');
  addColumn('authorities', 'district', 'TEXT');
  addColumn('authorities', 'center_lat', 'REAL');
  addColumn('authorities', 'center_lng', 'REAL');
  addColumn('authorities', 'upazila', 'TEXT');
}

export function logAgent({ complaintId = null, agentName, decision, inputSummary = '', outputSummary = '' }) {
  db.prepare(
    `INSERT INTO agent_logs (complaint_id, agent_name, decision, input_summary, output_summary)
     VALUES (?, ?, ?, ?, ?)`
  ).run(complaintId, agentName, decision, inputSummary, outputSummary);
}

export function notify(userId, complaintId, title, message) {
  db.prepare(
    `INSERT INTO notifications (user_id, complaint_id, title, message) VALUES (?, ?, ?, ?)`
  ).run(userId, complaintId, title, message);
}
