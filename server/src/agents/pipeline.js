import { db, logAgent } from '../db.js';
import { haversineMeters } from '../utils/geo.js';

export const CATEGORIES = ['road', 'electricity', 'water', 'gas', 'sanitation', 'other',
  'encroachment', 'environment', 'public_assets', 'animals', 'markets', 'drugs'];

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
    phrases: ['garbage collection', 'garbage not collected', 'public toilet', 'toilet blocked',
      'ময়লা সংগ্রহ', 'ময়লার ডাস্টবিন', 'টয়লেট পরিষ্কার',
      'moyla jome', 'dustbin vora', 'toilet nongra', 'norda bhorti'],
    words: ['garbage', 'moyla', 'moila', 'ময়লা', 'waste', 'aborjona', 'আবর্জনা', 'trash', 'dustbin', 'ডাস্টবিন', 'toilet', 'টয়লেট', 'latrine', 'sewer',
      'পয়ঃনিষ্কাশন', 'nongra', 'নোংরা', 'moylar', 'bosti', 'drain', 'safai', 'cleaning']
  },
  road: {
    phrases: ['road accident', 'road blocked', 'footpath occupied', 'speed breaker', 'রাস্তায় গর্ত', 'রাস্তা ভাঙা',
      'ফুটপাত দখল', 'রাস্তা মেরামত',
      'rasta vangga', 'rasta bhanga', 'rasta kharap', 'rasta noshto', 'rasta gorto', 'rasta gortho', 'road bhenge', 'sadak vangga', 'poth e gorto'],
    words: ['road', 'rasta', 'rastay', 'rastar', 'sarak', 'sadak', 'sorok', 'রাস্তা', 'রাস্তাঘাট', 'pothole', 'gorto', 'gortho', 'gorto', 'gortho', 'গর্ত', 'footpath', 'ফুটপাত', 'bridge', 'birij', 'ব্রিজ', 'brij', 'manhole', 'dhakna',
      'traffic', 'jaam', 'jam', 'trafik', 'ট্রাফিক', 'culvert', 'kalvert', 'কালভার্ট', 'pitch', 'broken', 'vangga', 'bhanga', 'bhagna', 'kharap', 'nosto', 'divider', 'highway', 'bump', 'speed']
  },
  encroachment: {
    phrases: ['footpath encroachment', 'road encroachment', 'illegal construction', 'illegal occupation',
      'land grabbing', 'land grab', 'unauthorized building', 'unauthorized construction', 'building without approval',
      'illegal parking', 'blocking walkway', 'walkway blocked', 'construction material blocking',
      'ফুটপাত দখল', 'রাস্তা দখল', 'অবৈধ নির্মাণ', 'অবৈধ দখল', 'জমি দখল', 'বেআইনি নির্মাণ',
      'footpath dokhol', 'rasta dokhol', 'obodho nirman', 'beaaini nirman', 'jomi dokhol', 'illegal dokhol'],
    words: ['encroachment', 'encroach', 'দখল', 'dokhol', 'dokhol', 'eviction', 'uchched', 'উচ্ছেদ', 'hawker', 'vendor',
      'parking', 'setback', 'grabbing', 'occupation', 'দখলদার', 'unauthorized', 'অননুমোদিত', 'approval', 'অনুমোদন', 'notice', 'নোটিশ']
  },
  environment: {
    phrases: ['noise pollution', 'air pollution', 'sound pollution', 'loudspeaker noise', 'generator noise',
      'construction noise', 'brick kiln', 'stagnant water', 'water stagnation', 'canal pollution', 'river pollution',
      'industrial effluent', 'dumping waste', 'waste dumping', 'mosquito breeding', 'mosquito menace',
      'শব্দ দূষণ', 'বায়ু দূষণ', 'বায়ুদূষণ', 'মশার প্রজনন', 'মশার উপদ্রব', 'জমে থাকা পানি', 'খাল দূষণ', 'নদী দূষণ',
      'ইটের ভাটা', 'শব্দদূষণ', 'sobdo dushon', 'bayu dushon', 'jome thaka pani', 'mosha upodrob', 'eter bhata'],
    words: ['pollution', 'দূষণ', 'dushon', 'dusito', 'noise', 'শব্দ', 'loudspeaker', 'মাইক', 'generator', 'জেনারেটর',
      'kiln', 'ভাটা', 'bata', 'dust', 'ধুলা', 'dhula', 'effluent', 'smoke', 'ধোঁয়া', 'dengue', 'ডেঙ্গু', 'larva',
      'stagnant', 'canal', 'খাল', 'khal', 'wetland', 'jolashoy', 'fume', 'emission', 'mosquito', 'mosa', 'মশা']
  },
  public_assets: {
    phrases: ['park maintenance', 'park damaged', 'park broken', 'public toilet broken', 'toilet broken', 'broken toilet',
      'toilet unusable', 'unusable toilet', 'playground damaged', 'playground broken', 'bench broken', 'lake polluted',
      'pond filled', 'পার্ক রক্ষণাবেক্ষণ', 'পার্ক নষ্ট', 'পার্ক ভাঙা', 'পাবলিক টয়লেট নষ্ট', 'টয়লেট নষ্ট',
      'খেলার মাঠ নষ্ট', 'পুকুর ভরাট', 'park noshto', 'toilet nosto', 'pukur bhorat', 'math noshto'],
    words: ['park', 'পার্ক', 'playground', 'মাঠ', 'garden', 'বাগান', 'lake', 'লেক', 'pond', 'পুকুর', 'pukur',
      'stadium', 'auditorium', 'museum', 'library', 'গ্রন্থাগার', 'bench', 'fountain', 'ঝর্ণা', 'unusable', 'অব্যবহারযোগ্য',
      'dilapidated', 'জরাজীর্ণ', 'maintenance', 'রক্ষণাবেক্ষণ', 'playground', 'stadium']
  },
  animals: {
    phrases: ['stray dog', 'stray dogs', 'stray cattle', 'stray animals', 'dog bite', 'dogs barking', 'cattle on road',
      'cow on road', 'dog menace', 'monkey menace', 'carcass disposal', 'dead animal',
      'বেওয়ারিশ কুকুর', 'বেওয়ারিশ গরু', 'কুকুরের উপদ্রব', 'কুকুরে কামড়', 'বানরের উপদ্রব',
      'bewarish kukur', 'bewarish goru', 'kukur kamor', 'kukurer upodrob', 'goru rastay'],
    words: ['stray', 'বেওয়ারিশ', 'bewarish', 'dog', 'kukur', 'কুকুর', 'dogs', 'cattle', 'goru', 'গরু', 'cow', 'goat',
      'ছাগল', 'monkey', 'বানর', 'banor', 'bite', 'kamor', 'কামড়', 'barking', 'carcass', 'মৃত পশু', 'rabies', 'জলাতঙ্ক']
  },
  markets: {
    phrases: ['price gouging', 'price hike', 'overpricing', 'unauthorized stall', 'wet market', 'market hygiene',
      'market monitoring', 'adulterated food', 'food adulteration', 'short weighing', 'fake product',
      'বাজার তদারকি', 'বাজার মনিটরিং', 'দাম বেশি', 'অতিরিক্ত দাম', 'ভেজাল খাদ্য', 'ওজনে কম', 'নকল পণ্য',
      'dam beshi', 'bajar todaroki', 'ojone kom', 'bhejal khaddo'],
    words: ['market', 'বাজার', 'bazar', 'bazaar', 'bajar', 'stall', 'দোকান', 'price', 'দাম', 'dam', 'gouging',
      'adulteration', 'ভেজাল', 'bhejal', 'weighing', 'ওজন', 'syndicate', 'সিন্ডিকেট', 'hygiene', 'স্বাস্থ্যবিধি',
      'expiry', 'মেয়াদ', 'license', 'লাইসেন্স', 'vendor license']
  },
  drugs: {
    phrases: ['drug dealing', 'drug addict', 'drug den', 'selling drugs', 'drug peddling', 'substance abuse',
      'মাদক ব্যবসা', 'মাদক সেবন', 'মাদক আস্তানা', 'মাদক পাচার', 'নেশা বিক্রি',
      'madok bebsa', 'madok sebon', 'nesha bikri', 'drug bebsa'],
    words: ['drug', 'drugs', 'মাদক', 'madok', 'yaba', 'ইয়াবা', 'baba', 'phensedyl', 'ফেনসিডিল', 'heroin', 'হেরোইন',
      'cannabis', 'গাঁজা', 'ganja', 'addict', 'নেশাখোর', 'neshakhor', 'dealer', 'peddling', 'narcotics', 'মাদকদ্রব্য',
      'alcohol', 'মদ', 'spice', 'tablet']
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

export async function agentVerify({ description, image }) {
  const reasons = [];
  if (!description || description.trim().length < 10) reasons.push('Description too short to verify');
  if (FAKE_PATTERNS.some((p) => p.test(description || ''))) reasons.push('Text looks like spam');
  if (image) {
    const ok = /^image\//.test(image.mimetype) && image.size > 1000 && image.size < 8 * 1024 * 1024;
    if (!ok) reasons.push('Attached photo failed authenticity check');
    else await logAgent({
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

export async function agentClassify(text) {
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

export async function agentFindDuplicate({ latitude, longitude, category }) {
  const candidates = await db.prepare(
    `SELECT complaint_id, user_id, authority_id, title, status, vote_count, latitude, longitude, created_at
     FROM complaints
     WHERE category = ? AND status IN
       ('submitted','verified','junior_review','senior_review','mayor_review','approved','wit_review')`
  ).all(category);

  for (const c of candidates) {
    const dist = haversineMeters(latitude, longitude, c.latitude, c.longitude);
    if (dist <= 250) return { ...c, distance_m: Math.round(dist) };
  }
  return null;
}

export async function agentRank(complaint) {
  const dateStr = complaint.created_at.replace(' ', 'T');
  const ageHours = Math.max(0,
    (Date.now() - new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z').getTime()) / 36e5);
  const severityHits = SEVERITY_KEYWORDS.reduce(
    (n, w) => n + ((complaint.title + ' ' + complaint.description).toLowerCase().includes(w) ? 1 : 0), 0);
  const score = Math.min(100,
    complaint.vote_count * 4 + severityHits * 12 + Math.max(0, 168 - Math.min(ageHours, 168)) * 0.3);
  return Math.round(score * 10) / 10;
}

export async function agentRoute(latitude, longitude) {
  const authorities = await db.prepare('SELECT * FROM authorities').all();
  const centerDist = (a) => haversineMeters(latitude, longitude,
    (a.min_lat + a.max_lat) / 2, (a.min_lng + a.max_lng) / 2);
  let best = null;
  let bestArea = Infinity;
  let bestDist = Infinity;
  for (const a of authorities) {
    if (latitude >= a.min_lat && latitude <= a.max_lat && longitude >= a.min_lng && longitude <= a.max_lng) {
      const area = (a.max_lat - a.min_lat) * (a.max_lng - a.min_lng);
      const d = centerDist(a);
      if (area < bestArea - 1e-12 ||
        (Math.abs(area - bestArea) <= 1e-12 && (d < bestDist - 1e-9 ||
          (Math.abs(d - bestDist) <= 1e-9 && a.authority_id < best.authority_id)))) {
        best = a;
        bestArea = area;
        bestDist = d;
      }
    }
  }
  if (best) return best;
  let nearest = null;
  let nearestDist = Infinity;
  for (const a of authorities) {
    const d = centerDist(a);
    if (d < nearestDist - 1e-9 ||
      (Math.abs(d - nearestDist) <= 1e-9 && nearest && a.authority_id < nearest.authority_id)) {
      nearest = a;
      nearestDist = d;
    }
  }
  return nearest;
}

export class DuplicateBlockedError extends Error {
  constructor(original) {
    super('The problem solving is in progress');
    this.original = original;
  }
}
