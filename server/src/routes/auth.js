import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import { db, logAgent } from '../db.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { initFaceEngine, compareFaces, engineAvailable } from '../agents/faceEngine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const facesDir = path.join(__dirname, '..', '..', 'uploads', 'faces');
fs.mkdirSync(facesDir, { recursive: true });

const faceStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, facesDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '') || '.jpg';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  }
});
const faceUpload = multer({
  storage: faceStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

const router = Router();
const publicUser = (u) => ({
  id: u.user_id ?? u.staff_id,
  role: u.role,
  name: u.full_name,
  email: u.email,
  phone: u.phone || null,
  department: u.department || null,
  authority_id: u.authority_id || null,
  authority_name: u.authority_name || null
});

router.post('/register', faceUpload.fields([
  { name: 'selfie', maxCount: 1 },
  { name: 'id_photo', maxCount: 1 }
]), async (req, res) => {
  const { full_name, email, phone, password } = req.body || {};
  if (!full_name || !email || !password || password.length < 6) {
    return res.status(400).json({ error: 'Name, email and a password of 6+ characters are required' });
  }
  const selfie = req.files?.selfie?.[0];
  const idPhoto = req.files?.id_photo?.[0];
  if (!selfie || !idPhoto) {
    return res.status(400).json({ error: 'Selfie and ID card photo are both required for identity verification' });
  }
  const exists = db.prepare('SELECT user_id FROM users WHERE email = ?').get(email.toLowerCase());
  if (exists) return res.status(409).json({ error: 'An account with this email already exists' });

  // AGENT 1 — Face match between selfie and ID document
  let verdict;
  if (engineAvailable()) {
    verdict = await compareFaces(selfie.path, idPhoto.path);
  } else {
    const clientClaimed = req.body.face_verified === 'true';
    verdict = clientClaimed
      ? { available: false, matched: true, reason: 'verified on client device' }
      : { available: false, matched: false, reason: 'Face verification service unavailable' };
  }

  if (!verdict.matched) {
    logAgent({
      agentName: 'agent_1_photo_verifier', decision: 'registration_rejected',
      inputSummary: `face match attempt for ${email.toLowerCase()}`,
      outputSummary: verdict.reason || 'Selfie and ID faces did not match'
    });
    try { fs.unlinkSync(selfie.path); } catch {}
    try { fs.unlinkSync(idPhoto.path); } catch {}
    return res.status(422).json({
      error: verdict.reason || 'Face verification failed — the selfie and your ID photo do not appear to be the same person. Please try again.',
      rejected: true
    });
  }

  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare(
    `INSERT INTO users (full_name, email, phone, password_hash, role, face_verified, selfie_url, id_photo_url)
     VALUES (?, ?, ?, ?, 'citizen', 1, ?, ?)`
  ).run(full_name.trim(), email.toLowerCase(), phone || null, hash, selfie.filename, idPhoto.filename);

  logAgent({
    agentName: 'agent_1_photo_verifier', decision: 'registration_verified',
    inputSummary: `face match for ${email.toLowerCase()}`,
    outputSummary: verdict.available
      ? `Selfie and ID faces matched (distance ${verdict.distance}, threshold 0.55)`
      : 'Verified by client device (server engine unavailable)'
  });

  const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(info.lastInsertRowid);
  const token = signToken({ id: user.user_id, role: 'citizen', name: user.full_name });
  res.status(201).json({ token, user: publicUser(user), face_verified: true });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const staff = db.prepare(
    `SELECT s.*, a.name AS authority_name FROM staff s
     JOIN authorities a ON a.authority_id = s.authority_id WHERE s.email = ?`
  ).get(email.toLowerCase());

  if (staff) {
    if (!bcrypt.compareSync(password, staff.password_hash)) {
      return res.status(401).json({ error: 'Incorrect email or password' });
    }
    const token = signToken({
      id: staff.staff_id, role: 'staff', name: staff.full_name,
      authority_id: staff.authority_id, department: 'general'
    });
    return res.json({ token, user: publicUser({ ...staff, role: 'staff' }) });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect email or password' });
  }
  const token = signToken({ id: user.user_id, role: 'citizen', name: user.full_name });
  res.json({ token, user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => {
  if (req.auth.role === 'staff') {
    const row = db.prepare('SELECT * FROM staff WHERE staff_id = ?').get(req.auth.id);
    if (!row) return res.status(404).json({ error: 'Account not found' });
    return res.json({ user: publicUser(row) });
  }
  const row = db.prepare('SELECT * FROM users WHERE user_id = ?').get(req.auth.id);
  if (!row) return res.status(404).json({ error: 'Account not found' });
  res.json({ user: publicUser(row) });
});

export default router;
