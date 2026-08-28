import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { db, logAgent, notify } from '../db.js';
import { requireAuth, requireCitizen, requireStaff } from '../middleware/auth.js';
import {
  agentVerify, agentClassify, agentFindDuplicate, agentRank, agentRoute,
  DuplicateBlockedError
} from '../agents/pipeline.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '') || '.jpg';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

const router = Router();

const COMPLAINT_SELECT = `
  SELECT c.*, u.full_name AS submitter_name, u.phone AS submitter_phone,
         a.name AS authority_name, a.type AS authority_type,
         s.full_name AS staff_name
  FROM complaints c
  JOIN users u ON u.user_id = c.user_id
  LEFT JOIN authorities a ON a.authority_id = c.authority_id
  LEFT JOIN staff s ON s.staff_id = c.assigned_staff_id
`;

const ACTIVE_STATUSES = "('submitted','verified','in_process')";

function refreshPriority(complaintId) {
  const c = db.prepare('SELECT * FROM complaints WHERE complaint_id = ?').get(complaintId);
  if (!c) return;
  db.prepare("UPDATE complaints SET priority_score = ?, updated_at = datetime('now') WHERE complaint_id = ?")
    .run(agentRank(c), complaintId);
}

function serializeComplaint(row, viewer) {
  if (!row) return null;
  const base = { ...row, image_url: row.image_url ? `/uploads/${path.basename(row.image_url)}` : null };
  if (viewer?.role === 'citizen') {
    base.voted_by_me = !!db.prepare('SELECT 1 FROM votes WHERE user_id = ? AND complaint_id = ?')
      .get(viewer.id, row.complaint_id);
    base.is_mine = row.user_id === viewer.id;
  }
  return base;
}

function composeFullAddress(b, authorityName) {
  const parts = [
    b.road && `Road ${b.road}`,
    b.sector,
    b.ward && `Ward ${b.ward}`,
    b.area_text,
    b.village,
    b.upazila,
    authorityName,
    b.district,
    b.division,
    'Bangladesh'
  ].filter(Boolean);
  return parts.join(', ') || null;
}

router.post('/', requireAuth, requireCitizen, upload.single('image'), async (req, res) => {
  const { title, description, latitude, longitude, address_text, category_hint } = req.body || {};
  const {
    division, district, area_text, ward, road, sector, village, upazila
  } = req.body || {};
  const lat = parseFloat(latitude), lng = parseFloat(longitude);

  if (!title || !description || Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ error: 'Title, description and GPS location are required' });
  }

  const imagePath = req.file ? req.file.filename : null;
  const me = req.auth;

  // AGENT 1 — Photo / content verifier
  const verdict = agentVerify({ description, image: req.file });
  if (!verdict.passed) {
    const info = db.prepare(
      `INSERT INTO complaints (user_id, title, description, image_url, latitude, longitude, address_text, category, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'other', 'rejected')`
    ).run(me.id, title.trim(), description.trim(), imagePath, lat, lng, address_text || null);
    const id = info.lastInsertRowid;
    logAgent({
      complaintId: id, agentName: 'agent_1_photo_verifier', decision: 'rejected',
      inputSummary: `title="${title}" photo=${imagePath ? 'yes' : 'no'}`,
      outputSummary: verdict.reason
    });
    notify(me.id, id, 'Complaint rejected',
      `Our verification agent could not accept your report: ${verdict.reason}`);
    return res.status(202).json({ rejected: true, reason: verdict.reason, complaint_id: id });
  }

  // AGENT 2 — Classifier
  const category = category_hint && category_hint !== 'auto' ? category_hint : agentClassify(`${title} ${description}`);

  // AGENT 3 — Duplicate checker (GPS radius scan)
  try {
    const original = agentFindDuplicate({ latitude: lat, longitude: lng, category });

    if (original && original.user_id === me.id) {
      logAgent({
        agentName: 'agent_3_duplicate_checker', decision: 'blocked_own_duplicate',
        inputSummary: `GPS (${lat.toFixed(5)}, ${lng.toFixed(5)}) radius scan by citizen #${me.id}`,
        outputSummary: `Citizen already owns #${original.complaint_id} "${original.title}" ${original.distance_m}m away - no self-merge, no self-vote`
      });
      return res.status(409).json({
        alert: 'You have already reported this issue',
        detail: `Your complaint #${original.complaint_id} "${original.title}" already covers this location (${original.distance_m}m away). You cannot submit the same issue twice, and re-submitting your own complaint does not add votes.`,
        original_id: original.complaint_id,
        own_duplicate: true
      });
    }

    if (original && original.status === 'in_process') {
      throw new DuplicateBlockedError(original);
    }

    if (original) {
      const info = db.prepare(
        `INSERT INTO complaints
           (user_id, authority_id, duplicate_of_id, title, description, image_url,
            latitude, longitude, address_text, category, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'merged')`
      ).run(me.id, original.authority_id, original.complaint_id,
        title.trim(), description.trim(), imagePath, lat, lng, address_text || null, category);
      const mergedId = info.lastInsertRowid;

      logAgent({
        complaintId: mergedId, agentName: 'agent_3_duplicate_checker', decision: 'duplicate_merged',
        inputSummary: `GPS (${lat.toFixed(5)}, ${lng.toFixed(5)}) radius scan`,
        outputSummary: `Matches #${original.complaint_id} "${original.title}" ${original.distance_m}m away`
      });
      logAgent({
        complaintId: original.complaint_id, agentName: 'agent_4_priority_ranker', decision: 'rescored',
        inputSummary: 'duplicate merge event',
        outputSummary: `vote_count -> ${original.vote_count + 1}`
      });

      const vote = db.prepare(
        'INSERT OR IGNORE INTO votes (user_id, complaint_id) VALUES (?, ?)'
      ).run(me.id, original.complaint_id);
      if (vote.changes > 0) {
        db.prepare('UPDATE complaints SET vote_count = vote_count + 1 WHERE complaint_id = ?')
          .run(original.complaint_id);
      }
      refreshPriority(original.complaint_id);

      const fresh = db.prepare('SELECT * FROM complaints WHERE complaint_id = ?').get(original.complaint_id);
      if (fresh.user_id !== me.id) {
        notify(fresh.user_id, fresh.complaint_id, 'Your complaint gained a supporter',
          `${me.name} reported the same problem nearby. Vote count is now ${fresh.vote_count}.`);
      }
      notify(me.id, fresh.complaint_id, 'Merged into an existing complaint',
        `A similar complaint "${original.title}" already exists ${original.distance_m}m away - your report was counted as a vote.`);

      return res.status(200).json({
        merged: true,
        original: serializeComplaint(
          db.prepare(`${COMPLAINT_SELECT} WHERE c.complaint_id = ?`).get(fresh.complaint_id),
          me
        ),
        merged_complaint_id: mergedId
      });
    }

    logAgent({
      agentName: 'agent_3_duplicate_checker', decision: 'unique',
      inputSummary: `GPS (${lat.toFixed(5)}, ${lng.toFixed(5)}) radius scan for "${category}"`,
      outputSummary: 'No similar active complaint found within 250m'
    });
  } catch (err) {
    if (err instanceof DuplicateBlockedError) {
      logAgent({
        agentName: 'agent_3_duplicate_checker', decision: 'blocked_in_progress',
        inputSummary: `GPS (${lat.toFixed(5)}, ${lng.toFixed(5)}) radius scan`,
        outputSummary: `Original #${err.original.complaint_id} already in process`
      });
      return res.status(409).json({
        alert: 'The problem solving is in progress',
        detail: `This issue (#${err.original.complaint_id} "${err.original.title}") is already being solved by the authority.`,
        original_id: err.original.complaint_id
      });
    }
    throw err;
  }

  // AGENT 5 — Destination router (citizen-selected authority wins, else GPS nearest)
  let authority = null;
  let routingMode = 'gps-nearest';
  const selectedId = parseInt(req.body.authority_id);
  if (selectedId) {
    authority = db.prepare('SELECT * FROM authorities WHERE authority_id = ?').get(selectedId) || null;
    if (authority) routingMode = 'citizen-address-selection';
  }
  if (!authority) {
    authority = agentRoute(lat, lng);
  }

  const fullAddress = composeFullAddress(
    { road, sector, ward, area_text, village, upazila, district, division },
    authority?.name
  );

  const info = db.prepare(
    `INSERT INTO complaints
       (user_id, authority_id, title, description, image_url, latitude, longitude,
        address_text, category, status, division, district, area_text, ward, road,
        sector, village, upazila, full_address)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'verified', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(me.id, authority?.authority_id ?? null, title.trim(), description.trim(),
    imagePath, lat, lng, address_text || null, category,
    division || null, district || null, area_text || null, ward || null, road || null,
    sector || null, village || null, upazila || null, fullAddress);

  const newId = info.lastInsertRowid;
  refreshPriority(newId);

  logAgent({
    complaintId: newId, agentName: 'agent_2_classifier', decision: `classified:${category}`,
    inputSummary: `"${title}"`, outputSummary: `Category detected: ${category}`
  });
  logAgent({
    complaintId: newId, agentName: 'agent_4_priority_ranker', decision: 'scored',
    inputSummary: 'new verified complaint', outputSummary: 'Initial priority computed'
  });
  logAgent({
    complaintId: newId, agentName: 'agent_5_destination_router', decision: `routed:${authority?.type || 'unknown'}`,
    inputSummary: routingMode === 'citizen-address-selection'
      ? `Citizen selected authority from address form (${district || '-'}, ${division || '-'})`
      : `GPS (${lat.toFixed(5)}, ${lng.toFixed(5)}) nearest match`,
    outputSummary: `Routed to ${authority?.name || 'nearest authority'} (${routingMode})`
  });

  res.status(201).json({
    complaint: serializeComplaint(
      db.prepare(`${COMPLAINT_SELECT} WHERE c.complaint_id = ?`).get(newId), me
    ),
    routed_to: authority ? `${authority.name}` : 'Unassigned area'
  });
});

// Public browse / search (no login needed) — searches text AND location
router.get('/', (req, res) => {
  const { q, category, status, sort = 'recent', limit = 60 } = req.query;
  let sql = `${COMPLAINT_SELECT} WHERE c.status NOT IN ('merged')`;
  const args = [];

  if (q) {
    sql += ` AND (c.title LIKE ? OR c.description LIKE ? OR c.address_text LIKE ? OR c.full_address LIKE ?
             OR c.district LIKE ? OR c.division LIKE ? OR c.area_text LIKE ? OR c.village LIKE ? OR c.upazila LIKE ?)`;
    const like = `%${q}%`;
    for (let i = 0; i < 9; i++) args.push(like);
  }
  if (category && category !== 'all') { sql += ` AND c.category = ?`; args.push(category); }
  if (status && status !== 'all') { sql += ` AND c.status = ?`; args.push(status); }
  else if (!status) { sql += ` AND c.status != 'rejected'`; }

  if (sort === 'priority') sql += ` ORDER BY c.priority_score DESC, c.created_at DESC`;
  else if (sort === 'votes') sql += ` ORDER BY c.vote_count DESC, c.created_at DESC`;
  else sql += ` ORDER BY c.created_at DESC`;

  sql += ` LIMIT ?`;
  args.push(Math.min(parseInt(limit) || 60, 100));

  const rows = db.prepare(sql).all(...args).map((r) => serializeComplaint(r, req.auth || null));
  res.json({ complaints: rows });
});

// Citizen's own complaints
router.get('/mine', requireAuth, requireCitizen, (req, res) => {
  const rows = db.prepare(
    `${COMPLAINT_SELECT} WHERE c.user_id = ? ORDER BY c.created_at DESC`
  ).all(req.auth.id).map((r) => serializeComplaint(r, req.auth));
  res.json({ complaints: rows });
});

// Complaint detail (public transparency) + timeline + agent trace
router.get('/:id', (req, res) => {
  const row = db.prepare(`${COMPLAINT_SELECT} WHERE c.complaint_id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Complaint not found' });

  const history = db.prepare(
    `SELECT * FROM status_history WHERE complaint_id = ? ORDER BY changed_at ASC`
  ).all(row.complaint_id);
  const agents = db.prepare(
    `SELECT agent_name, decision, input_summary, output_summary, created_at
     FROM agent_logs WHERE complaint_id = ? ORDER BY created_at ASC`
  ).all(row.complaint_id);

  let duplicateReports = [];
  if (['submitted', 'verified', 'in_process'].includes(row.status)) {
    duplicateReports = db.prepare(
      `SELECT complaint_id, title, created_at FROM complaints
       WHERE duplicate_of_id = ? AND status = 'merged' ORDER BY created_at DESC LIMIT 20`
    ).all(row.complaint_id);
  }

  res.json({
    complaint: serializeComplaint(row, req.auth || null),
    history, agents, duplicate_reports: duplicateReports
  });
});

// Vote for a complaint
router.post('/:id/vote', requireAuth, requireCitizen, (req, res) => {
  const complaint = db.prepare('SELECT * FROM complaints WHERE complaint_id = ?').get(req.params.id);
  if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

  if (complaint.user_id === req.auth.id) {
    return res.status(400).json({ error: 'You cannot vote for your own complaint' });
  }
  if (complaint.status === 'in_process') {
    return res.status(409).json({ alert: 'The problem solving is in progress' });
  }
  if (complaint.status === 'resolved') {
    return res.status(409).json({ alert: 'This problem has already been resolved' });
  }
  if (complaint.status === 'merged') {
    const original = db.prepare(`${COMPLAINT_SELECT} WHERE c.complaint_id = ?`)
      .get(complaint.duplicate_of_id);
    return res.status(409).json({
      alert: 'This report was merged - vote the original instead',
      redirect_complaint_id: original?.complaint_id
    });
  }
  if (!['submitted', 'verified', 'in_process'].includes(complaint.status)) {
    return res.status(409).json({ alert: 'Voting is closed for this complaint' });
  }

  const r = db.prepare('INSERT OR IGNORE INTO votes (user_id, complaint_id) VALUES (?, ?)')
    .run(req.auth.id, complaint.complaint_id);
  if (r.changes === 0) {
    return res.status(409).json({ alert: 'You already voted for this complaint' });
  }

  db.prepare('UPDATE complaints SET vote_count = vote_count + 1 WHERE complaint_id = ?')
    .run(complaint.complaint_id);
  refreshPriority(complaint.complaint_id);

  logAgent({
    complaintId: complaint.complaint_id, agentName: 'agent_4_priority_ranker', decision: 'rescored',
    inputSummary: `vote cast by citizen #${req.auth.id}`,
    outputSummary: `vote_count -> ${complaint.vote_count + 1}`
  });
  if (complaint.user_id !== req.auth.id) {
    notify(complaint.user_id, complaint.complaint_id, 'Your complaint gained a supporter',
      `${req.auth.name} supported your report. Vote count is now ${complaint.vote_count + 1}.`);
  }

  res.json({
    voted: true,
    vote_count: complaint.vote_count + 1,
    message: 'Your vote was recorded. You will now receive updates about this complaint too.'
  });
});

// Staff updates status ("in process" with ETA, or "done")
router.patch('/:id/status', requireAuth, requireStaff, (req, res) => {
  const { status, eta_hours, note } = req.body || {};
  const complaint = db.prepare('SELECT * FROM complaints WHERE complaint_id = ?').get(req.params.id);
  if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

  const staffAuthority = req.auth.authority_id;
  if (complaint.authority_id && complaint.authority_id !== staffAuthority) {
    return res.status(403).json({ error: 'This complaint belongs to another authority' });
  }
  if (!['in_process', 'resolved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Status must be in_process, resolved or rejected' });
  }
  if (status === 'in_process') {
    const eta = parseInt(eta_hours);
    if (!eta || eta <= 0) {
      return res.status(400).json({ error: 'Please provide an ETA in hours when marking in process' });
    }
  }

  db.prepare(
    `UPDATE complaints SET status = ?, eta_hours = ?, assigned_staff_id = ?,
       resolved_at = CASE WHEN ? = 'resolved' THEN datetime('now') ELSE resolved_at END,
       updated_at = datetime('now')
     WHERE complaint_id = ?`
  ).run(status,
    status === 'in_process' ? parseInt(eta_hours) : complaint.eta_hours,
    complaint.assigned_staff_id || req.auth.id,
    status, complaint.complaint_id);

  db.prepare(
    `INSERT INTO status_history (complaint_id, old_status, new_status, note, changed_by)
     VALUES (?, ?, ?, ?, ?)`
  ).run(complaint.complaint_id, complaint.status, status,
    note || null, req.auth.name);

  const messages = {
    in_process: ['Problem solving started',
      `The problem solving is in progress. Estimated time: ${eta_hours} hours.`],
    resolved: ['Problem resolved',
      'Your reported problem has been marked as DONE by the authority. Thank you for making your city better.'],
    rejected: ['Complaint rejected by authority', note || 'The authority rejected this report after inspection.']
  };
  notify(complaint.user_id, complaint.complaint_id, ...messages[status]);

  // Notify every citizen who voted for this complaint as well
  const voters = db.prepare(
    `SELECT DISTINCT user_id FROM votes WHERE complaint_id = ? AND user_id != ?`
  ).all(complaint.complaint_id, complaint.user_id);
  for (const v of voters) {
    notify(v.user_id, complaint.complaint_id,
      `Update on an issue you voted for (#${complaint.complaint_id})`,
      `"${complaint.title}" — ${messages[status][0]}: ${messages[status][1]}`);
  }

  res.json({
    complaint: serializeComplaint(
      db.prepare(`${COMPLAINT_SELECT} WHERE c.complaint_id = ?`).get(complaint.complaint_id),
      req.auth
    )
  });
});

// Staff queue for their authority
router.get('/staff/queue', requireAuth, requireStaff, (req, res) => {
  const { category, status } = req.query;
  let sql = `${COMPLAINT_SELECT}
     WHERE c.authority_id = ? AND c.status IN ('verified','in_process','resolved','rejected')`;
  const args = [req.auth.authority_id];
  if (category && category !== 'all') { sql += ` AND c.category = ?`; args.push(category); }
  if (status && status !== 'all') { sql += ` AND c.status = ?`; args.push(status); }
  sql += ` ORDER BY c.priority_score DESC, c.created_at DESC LIMIT 200`;
  const rows = db.prepare(sql).all(...args).map((r) => serializeComplaint(r, req.auth));
  res.json({ complaints: rows });
});

export default router;
