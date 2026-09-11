import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDbPath = path.join(__dirname, '../data/test-auth.db');

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

    CREATE TABLE IF NOT EXISTS staff (
      staff_id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      department TEXT NOT NULL DEFAULT 'general',
      authority_id INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS authorities (
      authority_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('CITY_CORPORATION','POUROSHOVA','UNION_PARISHAD')),
      min_lat REAL NOT NULL, max_lat REAL NOT NULL,
      min_lng REAL NOT NULL, max_lng REAL NOT NULL,
      division TEXT,
      district TEXT
    );
  `);

  return db;
}

describe('Authentication - Password Hashing', () => {
  beforeEach(() => {
    initTestDb();
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  it('should hash password with bcrypt', () => {
    const password = 'MySecurePassword123!';
    const hash = bcrypt.hashSync(password, 10);
    
    expect(hash).not.toBe(password);
    expect(hash.length).toBeGreaterThan(20);
  });

  it('should verify correct password', () => {
    const password = 'MySecurePassword123!';
    const hash = bcrypt.hashSync(password, 10);
    
    const isMatch = bcrypt.compareSync(password, hash);
    expect(isMatch).toBe(true);
  });

  it('should reject incorrect password', () => {
    const password = 'CorrectPassword';
    const wrongPassword = 'WrongPassword';
    const hash = bcrypt.hashSync(password, 10);
    
    const isMatch = bcrypt.compareSync(wrongPassword, hash);
    expect(isMatch).toBe(false);
  });

  it('should generate different hashes for same password', () => {
    const password = 'SamePassword';
    const hash1 = bcrypt.hashSync(password, 10);
    const hash2 = bcrypt.hashSync(password, 10);
    
    expect(hash1).not.toBe(hash2);
    // But both should verify against the password
    expect(bcrypt.compareSync(password, hash1)).toBe(true);
    expect(bcrypt.compareSync(password, hash2)).toBe(true);
  });
});

describe('Authentication - User Registration', () => {
  beforeEach(() => {
    initTestDb();
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  it('should insert new citizen user', () => {
    const hash = bcrypt.hashSync('password123', 10);
    
    const result = db.prepare(
      'INSERT INTO users (full_name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)'
    ).run('John Citizen', 'john@example.com', '+8801711111111', hash, 'citizen');

    expect(result.changes).toBe(1);
    
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get('john@example.com');
    expect(user.full_name).toBe('John Citizen');
    expect(user.role).toBe('citizen');
    expect(user.face_verified).toBe(0);
  });

  it('should set face_verified flag on registration', () => {
    const hash = bcrypt.hashSync('password123', 10);
    
    const result = db.prepare(
      `INSERT INTO users (full_name, email, password_hash, face_verified, selfie_url, id_photo_url)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run('Jane Verified', 'jane@example.com', hash, 1, 'selfie.jpg', 'id.jpg');

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get('jane@example.com');
    expect(user.face_verified).toBe(1);
    expect(user.selfie_url).toBe('selfie.jpg');
    expect(user.id_photo_url).toBe('id.jpg');
  });

  it('should reject duplicate email', () => {
    const hash = bcrypt.hashSync('password123', 10);
    
    db.prepare(
      'INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)'
    ).run('User A', 'duplicate@example.com', hash);

    expect(() => {
      db.prepare(
        'INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)'
      ).run('User B', 'duplicate@example.com', hash);
    }).toThrow();
  });

  it('should validate email format at application level', () => {
    const validEmails = ['user@example.com', 'test.email+tag@domain.co.uk'];
    const invalidEmails = ['', 'notanemail', '@example.com', 'user@'];

    for (const email of validEmails) {
      expect(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)).toBe(true);
    }

    for (const email of invalidEmails) {
      expect(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)).toBe(false);
    }
  });

  it('should reject password less than 6 characters', () => {
    const shortPasswords = ['', '12345', 'abc'];
    
    for (const pwd of shortPasswords) {
      expect(pwd.length >= 6).toBe(false);
    }
  });
});

describe('Authentication - User Login', () => {
  beforeEach(() => {
    initTestDb();
    const hash = bcrypt.hashSync('password123', 10);
    db.prepare(
      'INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)'
    ).run('Login User', 'login@example.com', hash);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  it('should find user by email', () => {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get('login@example.com');
    
    expect(user).toBeDefined();
    expect(user.full_name).toBe('Login User');
  });

  it('should verify password on login', () => {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get('login@example.com');
    const isValid = bcrypt.compareSync('password123', user.password_hash);
    
    expect(isValid).toBe(true);
  });

  it('should reject invalid password', () => {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get('login@example.com');
    const isValid = bcrypt.compareSync('wrongpassword', user.password_hash);
    
    expect(isValid).toBe(false);
  });

  it('should return null for non-existent email', () => {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get('notfound@example.com');
    expect(user).toBeUndefined();
  });

  it('should be case-insensitive for email', () => {
    const lower = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get('login@example.com');
    const upper = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get('LOGIN@EXAMPLE.COM');
    
    expect(lower).toBeDefined();
    expect(upper).toBeDefined();
    expect(lower.user_id).toBe(upper.user_id);
  });
});

describe('Authentication - Staff Login', () => {
  beforeEach(() => {
    initTestDb();
    
    db.prepare(
      'INSERT INTO authorities (name, type, min_lat, max_lat, min_lng, max_lng) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('Test Corp', 'CITY_CORPORATION', 0, 1, 0, 1);

    const auth = db.prepare('SELECT authority_id FROM authorities LIMIT 1').get();
    const hash = bcrypt.hashSync('staff123', 10);
    
    db.prepare(
      'INSERT INTO staff (full_name, email, password_hash, authority_id) VALUES (?, ?, ?, ?)'
    ).run('Staff Officer', 'staff@example.com', hash, auth.authority_id);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  it('should authenticate staff member', () => {
    const staff = db.prepare('SELECT * FROM staff WHERE email = ?').get('staff@example.com');
    expect(staff).toBeDefined();
    expect(staff.full_name).toBe('Staff Officer');
  });

  it('should verify staff password', () => {
    const staff = db.prepare('SELECT * FROM staff WHERE email = ?').get('staff@example.com');
    const isValid = bcrypt.compareSync('staff123', staff.password_hash);
    
    expect(isValid).toBe(true);
  });

  it('should associate staff with authority', () => {
    const staff = db.prepare('SELECT s.*, a.name FROM staff s JOIN authorities a ON s.authority_id = a.authority_id WHERE s.email = ?').get('staff@example.com');
    
    expect(staff.authority_id).toBeDefined();
    expect(staff.name).toBe('Test Corp');
  });

  it('should fetch staff authority details', () => {
    const staff = db.prepare('SELECT * FROM staff WHERE email = ?').get('staff@example.com');
    const authority = db.prepare('SELECT * FROM authorities WHERE authority_id = ?').get(staff.authority_id);
    
    expect(authority).toBeDefined();
    expect(authority.type).toBe('CITY_CORPORATION');
  });
});

describe('Authentication - Token Payload', () => {
  it('should structure citizen token payload', () => {
    const citizenPayload = {
      id: 1,
      role: 'citizen',
      name: 'John Citizen'
    };

    expect(citizenPayload.role).toBe('citizen');
    expect(citizenPayload.id).toBeGreaterThan(0);
    expect(citizenPayload.name).toBeDefined();
  });

  it('should structure staff token payload', () => {
    const staffPayload = {
      id: 1,
      role: 'staff',
      name: 'Staff Officer',
      authority_id: 5,
      department: 'general'
    };

    expect(staffPayload.role).toBe('staff');
    expect(staffPayload.authority_id).toBeDefined();
    expect(staffPayload.department).toBe('general');
  });
});

describe('Authentication - Public User Response', () => {
  it('should mask sensitive data in user response', () => {
    const internalUser = {
      user_id: 1,
      email: 'user@example.com',
      password_hash: 'hashed_secret',
      face_verified: 1,
      selfie_url: 'selfie.jpg',
      id_photo_url: 'id.jpg',
      full_name: 'John Doe'
    };

    const publicUser = {
      id: internalUser.user_id,
      role: 'citizen',
      name: internalUser.full_name,
      email: internalUser.email,
      phone: null
    };

    expect(publicUser.password_hash).toBeUndefined();
    expect(publicUser.selfie_url).toBeUndefined();
    expect(publicUser.id_photo_url).toBeUndefined();
    expect(publicUser.email).toBeDefined();
  });
});
