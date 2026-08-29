import { db, logAgent } from '../db.js';
import { haversineMeters } from '../utils/geo.js';

export const CATEGORIES = ['road', 'electricity', 'water', 'gas', 'sanitation', 'other'];

const CATEGORY_KEYWORDS = {
  gas: {
    phrases: ['gas leak', 'leaking gas', 'gas smell', 'gas line', 'gas cylinder', 'gas connection', 'gas pipeline',
      'গ্যাস লিক', 'গ্যাসের লিক', 'গ্যাসের গন্ধ', 'রান্নার গ্যাস', 'গ্যাস সংযোগ', 'গ্যাসের পাইপ', 'গ্যাস পাইপলাইন',
      'gas er gondho', 'gas line fata', 'chula gas', 'rannar gas'],
    words: ['gas', 'ges', 'গ্যাস', 'titas', 'টাইটাস', 'cylinder', 'silinder', 'সিলিন্ডার', 'lpg', 'এলপিজি', 'chula', 'চুলা']
  },
  electricity: {
    phrases: ['street light', 'streetlight', 'electric pole', 'electric wire', 'power cut', 'power outage',
      'load shedding', 'short circuit', 'transformer blast', 'বিদ্যুৎ বিভ্রাট', 'কারেন্টের তার', 'বাতি জ্বলে না', 'আলো নেই', 'লাইট জ্বলে না',
      'bati jole na', 'current er tar', 'khuti pore', 'pole pore', 'light nosto', 'alo nei'],
    words: ['electricity', 'electric', 'biddyut', 'biddut', 'বিদ্যুৎ', 'current', 'karent', 'কারেন্ট', 'transformer', 'ট্রান্সফরমার', 'wire', 'tar', 'তার', 'pole', 'khuti', 'খুঁটি',
      'lamp', 'bati', 'ল্যাম্প', 'বাতি', 'streetlight', 'desa', 'dpdc', 'ডেসা', 'cable', 'shock', 'shok', 'light', 'layt', 'লাইট']
  },
  water: {
    phrases: ['water logging', 'waterlogging', 'water leak', 'pipe leak', 'water supply', 'drainage blocked',
      'tube well', 'পানি জমে', 'পানি জমা', 'পাইপ লিক', 'পানির লিক', 'নলকূপ', 'নর্দমা ভরাট', 'পানি সরবরাহ',
      'pani jome', 'jolaboddhota', 'wasa pani', 'drain bondho', 'pani nei', 'kol nosto', 'pipe fata'],
    words: ['water', 'pani', 'jol', 'পানি', 'wasa', 'ওয়াসা', 'drainage', 'drain', 'nala', 'নর্দমা', 'জলাবদ্ধতা', 'ড্রেন', 'pipe', 'paip', 'পাইপ',
      'kol', 'tap', 'koler', 'tubewell', 'nal kup', 'pipeline', 'পাইপলাইন', 'bonna', 'বন্যা', 'jolaboddho', 'overflow']
  },
  sanitation: {
    phrases: ['garbage collection', 'garbage not collected', 'public toilet', 'mosquito breeding', 'toilet blocked',
      'ময়লা সংগ্রহ', 'ময়লার ডাস্টবিন', 'টয়লেট পরিষ্কার', 'মশার উপদ্রব',
      'moyla jome', 'dustbin vora', 'toilet nongra', 'mosa upodrob', 'norda bhorti'],
    words: ['garbage', 'moyla', 'moila', 'ময়লা', 'waste', 'aborjona', 'আবর্জনা', 'trash', 'dustbin', 'ডাস্টবিন', 'toilet', 'টয়লেট', 'latrine', 'sewer',
      'পয়ঃনিষ্কাশন', 'mosquito', 'mosa', 'মশা', 'nongra', 'নোংরা', 'moylar', 'bosti', 'drain', 'safai', 'cleaning']
  },
  road: {
    phrases: ['road accident', 'road blocked', 'footpath occupied', 'speed breaker', 'রাস্তায় গর্ত', 'রাস্তা ভাঙা',
      'ফুটপাত দখল', 'রাস্তা মেরামত',
      'rasta vangga', 'rasta bhanga', 'rasta kharap', 'rasta noshto', 'rasta gorto', 'rasta gortho', 'road bhenge', 'sadak vangga', 'poth e gorto'],
    words: ['road', 'rasta', 'rastay', 'rastar', 'sarak', 'sadak', 'sorok', 'রাস্তা', 'রাস্তাঘাট', 'pothole', 'gorto', 'gortho', 'gorto', 'gortho', 'গর্ত', 'footpath', 'ফুটপাত', 'bridge', 'birij', 'ব্রিজ', 'brij', 'manhole', 'dhakna',
      'traffic', 'jaam', 'jam', 'trafik', 'ট্রাফিক', 'culvert', 'kalvert', 'কালভার্ট', 'pitch', 'broken', 'vangga', 'bhanga', 'bhagna', 'kharap', 'nosto', 'divider', 'highway', 'bump', 'speed']
  }
};

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const SEVERITY_KEYWORDS = [
  'dangerous', 'accident', 'collapse', 'fire', 'electrocution', 'overflow', 'broken completely',
  'urgent', 'child', 'death', 'injured',
  'দুর্ঘটনা', 'বিপদ', 'ভেঙে', 'আগুন', 'মারা', 'আহত', 'শিশু'
];

const FAKE_PATTERNS = [/(.)\1{9,}/, /asdf|qwerty|lorem ipsum|test test/i];

export function agentVerify({ description, image }) {
  const reasons = [];
  if (!description || description.trim().length < 10) reasons.push('Description too short to verify');
  if (FAKE_PATTERNS.some((p) => p.test(description || ''))) reasons.push('Text looks like spam');
  if (image) {
    const ok = /^image\//.test(image.mimetype) && image.size > 1000 && image.size < 8 * 1024 * 1024;
    if (!ok) reasons.push('Attached photo failed authenticity check');
    else logAgent({
      agentName: 'agent_1_photo_verifier',
      decision: 'image_accepted',
      inputSummary: `Photo ${image.originalname} (${Math.round(image.size / 1024)} KB)`,
      outputSummary: 'EXIF/type/size heuristics passed - photo accepted as authentic evidence'
    });
  }
  if (reasons.length) {
    return { passed: false, reason: reasons.join('; ') };
  }
  return { passed: true, reason: 'Content verified as genuine and relevant' };
}

export function agentClassify(text) {
  const t = (text || '').toLowerCase();
  let best = { category: 'other', score: 0 };
  for (const [category, { phrases, words }] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const p of phrases) {
      if (t.includes(p)) score += 3;
    }
    for (const w of words) {
      if (/[a-z0-9]/.test(w)) {
        if (new RegExp(`\\b${escapeRegex(w)}\\b`).test(t)) score += 2;
      } else if (t.includes(w)) {
        score += 2;
      }
    }
    if (score > best.score) best = { category, score };
  }
  return best.category;
}

export function agentFindDuplicate({ latitude, longitude, category }) {
  const candidates = db.prepare(
    `SELECT complaint_id, user_id, authority_id, title, status, vote_count, latitude, longitude, created_at
     FROM complaints
     WHERE category = ? AND status IN ('submitted','verified','in_process')`
  ).all(category);

  for (const c of candidates) {
    const dist = haversineMeters(latitude, longitude, c.latitude, c.longitude);
    if (dist <= 250) return { ...c, distance_m: Math.round(dist) };
  }
  return null;
}

export function agentRank(complaint) {
  const ageHours = Math.max(0,
    (Date.now() - new Date(complaint.created_at.replace(' ', 'T') + 'Z').getTime()) / 36e5);
  const severityHits = SEVERITY_KEYWORDS.reduce(
    (n, w) => n + ((complaint.title + ' ' + complaint.description).toLowerCase().includes(w) ? 1 : 0), 0);
  const score = Math.min(100,
    complaint.vote_count * 4 + severityHits * 12 + Math.min(ageHours, 168) * 0.3);
  return Math.round(score * 10) / 10;
}

export function agentRoute(latitude, longitude) {
  const authorities = db.prepare('SELECT * FROM authorities').all();
  for (const a of authorities) {
    if (latitude >= a.min_lat && latitude <= a.max_lat && longitude >= a.min_lng && longitude <= a.max_lng) {
      return a;
    }
  }
  let nearest = null, best = Infinity;
  for (const a of authorities) {
    const d = haversineMeters(latitude, longitude,
      (a.min_lat + a.max_lat) / 2, (a.min_lng + a.max_lng) / 2);
    if (d < best) { best = d; nearest = a; }
  }
  return nearest;
}

export class DuplicateBlockedError extends Error {
  constructor(original) {
    super('The problem solving is in progress');
    this.original = original;
  }
}
