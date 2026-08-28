import jwt from 'jsonwebtoken';
import { db } from '../db.js';

const SECRET = process.env.JWT_SECRET || 'nagorik-sheba-dev-secret';

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '30d' });
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Login required' });
  try {
    req.auth = jwt.verify(token, SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired, please login again' });
  }
}

export function requireCitizen(req, res, next) {
  if (req.auth?.role !== 'citizen') return res.status(403).json({ error: 'Citizen account required' });
  next();
}

export function requireStaff(req, res, next) {
  if (req.auth?.role !== 'staff') return res.status(403).json({ error: 'Authority staff access only' });
  next();
}

export function getStaffFromAuth(authId) {
  return db.prepare(
    `SELECT s.staff_id, s.full_name, s.email, s.department,
            a.authority_id, a.name AS authority_name, a.type AS authority_type
     FROM staff s JOIN authorities a ON a.authority_id = s.authority_id
     WHERE s.staff_id = ?`
  ).get(authId);
}
