import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDbPath = path.join(__dirname, '../data/test.db');

// Test database setup
let db;

function initTestDb() {
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  
  db = new Database(testDbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'citizen',
      face_verified INTEGER NOT NULL DEFAULT 0,
      selfie_url TEXT,
      id_photo_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS authorities (
      authority_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('CITY_CORPORATION','POUROSHOVA','UNION_PARISHAD')),
      min_lat REAL NOT NULL, max_lat REAL NOT NULL,
      min_lng REAL NOT NULL, max_lng REAL NOT NULL,
      center_lat REAL,
      center_lng REAL,
      division TEXT,
      district TEXT,
      upazila TEXT,
      phone TEXT, email TEXT
    );

    CREATE TABLE IF NOT EXISTS complaints (
      complaint_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(user_id),
      authority_id INTEGER REFERENCES authorities(authority_id),
      duplicate_of_id INTEGER REFERENCES complaints(complaint_id),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'other',
      image_url TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      address_text TEXT,
      status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','verified','rejected','merged','in_process','resolved')),
      priority_score REAL NOT NULL DEFAULT 0,
      vote_count INTEGER NOT NULL DEFAULT 0,
      eta_hours INTEGER,
      division TEXT,
      district TEXT,
      area_text TEXT,
      ward TEXT,
      road TEXT,
      sector TEXT,
      village TEXT,
      upazila TEXT,
      full_address TEXT,
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

    CREATE TABLE IF NOT EXISTS agent_logs (
      log_id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id INTEGER REFERENCES complaints(complaint_id),
      agent_name TEXT NOT NULL,
      decision TEXT NOT NULL,
      input_summary TEXT,
      output_summary TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
  `);
  
  return db;
}

describe('Database - Users', () => {
  beforeEach(() => {
    initTestDb();
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  it('should insert and retrieve a user', () => {
    const stmt = db.prepare(
      'INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)'
    );
    const result = stmt.run('John Doe', 'john@example.com', 'hashed_password');
    expect(result.changes).toBe(1);
    expect(result.lastInsertRowid).toBeGreaterThan(0);

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get('john@example.com');
    expect(user).toBeDefined();
    expect(user.full_name).toBe('John Doe');
    expect(user.role).toBe('citizen');
  });

  it('should enforce unique email constraint', () => {
    const stmt = db.prepare(
      'INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)'
    );
    stmt.run('User A', 'duplicate@example.com', 'hash1');
    
    expect(() => {
      stmt.run('User B', 'duplicate@example.com', 'hash2');
    }).toThrow();
  });

  it('should update user face verification status', () => {
    db.prepare(
      'INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)'
    ).run('Test User', 'test@example.com', 'hashed');

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get('test@example.com');
    expect(user.face_verified).toBe(0);

    db.prepare('UPDATE users SET face_verified = 1 WHERE user_id = ?').run(user.user_id);
    const updated = db.prepare('SELECT * FROM users WHERE user_id = ?').get(user.user_id);
    expect(updated.face_verified).toBe(1);
  });
});

describe('Database - Authorities', () => {
  beforeEach(() => {
    initTestDb();
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  it('should insert authority and query by division', () => {
    db.prepare(
      `INSERT INTO authorities (name, type, min_lat, max_lat, min_lng, max_lng, division, district)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('Dhaka South', 'CITY_CORPORATION', 23.7, 23.8, 90.3, 90.5, 'Dhaka', 'Dhaka');

    const auth = db.prepare(
      'SELECT * FROM authorities WHERE division = ?'
    ).get('Dhaka');
    
    expect(auth).toBeDefined();
    expect(auth.name).toBe('Dhaka South');
    expect(auth.type).toBe('CITY_CORPORATION');
  });

  it('should validate type constraint', () => {
    expect(() => {
      db.prepare(
        `INSERT INTO authorities (name, type, min_lat, max_lat, min_lng, max_lng)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run('Invalid', 'INVALID_TYPE', 23.7, 23.8, 90.3, 90.5);
    }).toThrow();
  });

  it('should find authority by geographic bounds', () => {
    db.prepare(
      `INSERT INTO authorities (name, type, min_lat, max_lat, min_lng, max_lng, center_lat, center_lng)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('Dhaka', 'CITY_CORPORATION', 23.7, 23.8, 90.3, 90.5, 23.75, 90.4);

    // Test point within bounds
    const found = db.prepare(
      'SELECT * FROM authorities WHERE ? >= min_lat AND ? <= max_lat AND ? >= min_lng AND ? <= max_lng'
    ).get(23.75, 23.75, 90.4, 90.4);

    expect(found).toBeDefined();
    expect(found.name).toBe('Dhaka');
  });
});

describe('Database - Complaints', () => {
  beforeEach(() => {
    initTestDb();
    // Insert test user and authority
    db.prepare(
      'INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)'
    ).run('Citizen', 'citizen@example.com', 'hash');
    
    db.prepare(
      `INSERT INTO authorities (name, type, min_lat, max_lat, min_lng, max_lng, division, district)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('Dhaka South', 'CITY_CORPORATION', 23.7, 23.8, 90.3, 90.5, 'Dhaka', 'Dhaka');
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  it('should insert a complaint with full details', () => {
    const citizen = db.prepare('SELECT user_id FROM users WHERE email = ?').get('citizen@example.com');
    const authority = db.prepare('SELECT authority_id FROM authorities LIMIT 1').get();

    const result = db.prepare(
      `INSERT INTO complaints 
       (user_id, authority_id, title, description, latitude, longitude, category, status, division, district)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      citizen.user_id, authority.authority_id, 
      'Pothole on Road', 'Deep pothole causing accidents',
      23.75, 90.4, 'road', 'verified', 'Dhaka', 'Dhaka'
    );

    expect(result.changes).toBe(1);
    
    const complaint = db.prepare('SELECT * FROM complaints WHERE complaint_id = ?').get(result.lastInsertRowid);
    expect(complaint.title).toBe('Pothole on Road');
    expect(complaint.category).toBe('road');
    expect(complaint.status).toBe('verified');
  });

  it('should update complaint status', () => {
    const citizen = db.prepare('SELECT user_id FROM users WHERE email = ?').get('citizen@example.com');
    const authority = db.prepare('SELECT authority_id FROM authorities LIMIT 1').get();

    const result = db.prepare(
      `INSERT INTO complaints 
       (user_id, authority_id, title, description, latitude, longitude, category)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      citizen.user_id, authority.authority_id, 
      'Test', 'Description', 23.75, 90.4, 'road'
    );

    db.prepare(
      "UPDATE complaints SET status = ?, eta_hours = ?, updated_at = datetime('now') WHERE complaint_id = ?"
    ).run('in_process', 48, result.lastInsertRowid);

    const updated = db.prepare('SELECT * FROM complaints WHERE complaint_id = ?').get(result.lastInsertRowid);
    expect(updated.status).toBe('in_process');
    expect(updated.eta_hours).toBe(48);
  });

  it('should fetch complaints by status with pagination', () => {
    const citizen = db.prepare('SELECT user_id FROM users WHERE email = ?').get('citizen@example.com');
    const authority = db.prepare('SELECT authority_id FROM authorities LIMIT 1').get();

    // Insert multiple complaints
    for (let i = 0; i < 5; i++) {
      db.prepare(
        `INSERT INTO complaints 
         (user_id, authority_id, title, description, latitude, longitude, category, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        citizen.user_id, authority.authority_id,
        `Issue ${i}`, `Description ${i}`, 23.75 + i * 0.01, 90.4 + i * 0.01, 'road', 'verified'
      );
    }

    const verified = db.prepare(
      'SELECT * FROM complaints WHERE status = ? LIMIT 10'
    ).all('verified');

    expect(verified.length).toBe(5);
  });

  it('should record votes and update vote count', () => {
    const citizen1 = db.prepare('INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)').run('C1', 'c1@test.com', 'h').lastInsertRowid;
    const citizen2 = db.prepare('INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)').run('C2', 'c2@test.com', 'h').lastInsertRowid;
    const authority = db.prepare('SELECT authority_id FROM authorities LIMIT 1').get();

    const complaint = db.prepare(
      `INSERT INTO complaints 
       (user_id, authority_id, title, description, latitude, longitude, category)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(citizen1, authority.authority_id, 'Test', 'Desc', 23.75, 90.4, 'road').lastInsertRowid;

    // Add votes
    db.prepare('INSERT INTO votes (user_id, complaint_id) VALUES (?, ?)').run(citizen2, complaint);
    db.prepare('UPDATE complaints SET vote_count = vote_count + 1 WHERE complaint_id = ?').run(complaint);

    const updated = db.prepare('SELECT vote_count FROM complaints WHERE complaint_id = ?').get(complaint);
    expect(updated.vote_count).toBe(1);
  });
});

describe('Database - Agent Logs', () => {
  beforeEach(() => {
    initTestDb();
    db.prepare('INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)').run('User', 'u@test.com', 'h');
    db.prepare('INSERT INTO authorities (name, type, min_lat, max_lat, min_lng, max_lng) VALUES (?, ?, ?, ?, ?, ?)').run('Test', 'CITY_CORPORATION', 0, 1, 0, 1);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  it('should log agent decisions', () => {
    const user = db.prepare('SELECT user_id FROM users LIMIT 1').get();
    const authority = db.prepare('SELECT authority_id FROM authorities LIMIT 1').get();
    
    const complaint = db.prepare(
      'INSERT INTO complaints (user_id, authority_id, title, description, latitude, longitude, category) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(user.user_id, authority.authority_id, 'T', 'D', 0.5, 0.5, 'road').lastInsertRowid;

    const log = db.prepare(
      'INSERT INTO agent_logs (complaint_id, agent_name, decision, input_summary, output_summary) VALUES (?, ?, ?, ?, ?)'
    ).run(complaint, 'agent_1_verifier', 'verified', 'spam check', 'passed');

    expect(log.changes).toBe(1);

    const recorded = db.prepare('SELECT * FROM agent_logs WHERE complaint_id = ?').get(complaint);
    expect(recorded.agent_name).toBe('agent_1_verifier');
    expect(recorded.decision).toBe('verified');
  });
});

describe('Database - Notifications', () => {
  beforeEach(() => {
    initTestDb();
    db.prepare('INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)').run('User', 'u@test.com', 'h');
    db.prepare('INSERT INTO authorities (name, type, min_lat, max_lat, min_lng, max_lng) VALUES (?, ?, ?, ?, ?, ?)').run('Test', 'CITY_CORPORATION', 0, 1, 0, 1);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  it('should insert and retrieve notifications', () => {
    const user = db.prepare('SELECT user_id FROM users LIMIT 1').get();
    const authority = db.prepare('SELECT authority_id FROM authorities LIMIT 1').get();
    
    const complaint = db.prepare(
      'INSERT INTO complaints (user_id, authority_id, title, description, latitude, longitude, category) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(user.user_id, authority.authority_id, 'T', 'D', 0.5, 0.5, 'road').lastInsertRowid;

    const notif = db.prepare(
      'INSERT INTO notifications (user_id, complaint_id, title, message) VALUES (?, ?, ?, ?)'
    ).run(user.user_id, complaint, 'Issue Updated', 'Your complaint status changed');

    expect(notif.changes).toBe(1);

    const retrieved = db.prepare(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC'
    ).all(user.user_id);

    expect(retrieved.length).toBeGreaterThan(0);
    expect(retrieved[0].title).toBe('Issue Updated');
  });
});
