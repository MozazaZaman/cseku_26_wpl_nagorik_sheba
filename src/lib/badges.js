// Badge display metadata. Badge types/tiers are produced by the server
// (server/src/utils/badges.js); this mirrors them for rendering and i18n.

export const TIER_STYLE = {
  gold: { ring: 'ring-amber-400/60', text: 'text-amber-300', glow: 'shadow-amber-500/20', label: 'badge.tierGold' },
  silver: { ring: 'ring-slate-300/60', text: 'text-slate-200', glow: 'shadow-slate-400/20', label: 'badge.tierSilver' },
  bronze: { ring: 'ring-orange-400/60', text: 'text-orange-300', glow: 'shadow-orange-500/20', label: 'badge.tierBronze' }
};

export const BADGE_META = {
  volume: { icon: '🛡️', name: 'badge.volume.name', desc: 'badge.volume.desc', tiers: {
    bronze: 'badge.volume.bronze', silver: 'badge.volume.silver', gold: 'badge.volume.gold'
  } },
  satisfaction: { icon: '🤲', name: 'badge.satisfaction.name', desc: 'badge.satisfaction.desc', tiers: {
    bronze: 'badge.satisfaction.bronze', silver: 'badge.satisfaction.silver', gold: 'badge.satisfaction.gold'
  } },
  sla: { icon: '⚡', name: 'badge.sla.name', desc: 'badge.sla.desc', tiers: {
    bronze: 'badge.sla.bronze', silver: 'badge.sla.silver', gold: 'badge.sla.gold'
  } },
  accuracy: { icon: '🎯', name: 'badge.accuracy.name', desc: 'badge.accuracy.desc', tiers: {
    bronze: 'badge.accuracy.bronze', silver: 'badge.accuracy.silver', gold: 'badge.accuracy.gold'
  } },
  specialist_road: { icon: '🛣️', name: 'badge.specialist.road', desc: 'badge.specialist.desc' },
  specialist_electricity: { icon: '💡', name: 'badge.specialist.electricity', desc: 'badge.specialist.desc' },
  specialist_water: { icon: '🚰', name: 'badge.specialist.water', desc: 'badge.specialist.desc' },
  specialist_gas: { icon: '🔥', name: 'badge.specialist.gas', desc: 'badge.specialist.desc' },
  specialist_sanitation: { icon: '🧹', name: 'badge.specialist.sanitation', desc: 'badge.specialist.desc' },
  first10: { icon: '🌱', name: 'badge.first10.name', desc: 'badge.first10.desc' },
  century: { icon: '💯', name: 'badge.century.name', desc: 'badge.century.desc' },
  veteran: { icon: '🎖️', name: 'badge.veteran.name', desc: 'badge.veteran.desc' }
};

export const MILESTONE_TYPES = ['first10', 'century', 'veteran'];

export function badgeMeta(type) {
  return BADGE_META[type] || { icon: '🏅', name: type, desc: 'badge.generic.desc' };
}

export function isMilestone(type) {
  return MILESTONE_TYPES.includes(type);
}

/** Human label for a badge row: e.g. "City Guardian (Gold)" or "Road Specialist". */
export function badgeLabel(type, tier, t) {
  const meta = badgeMeta(type);
  if (meta.tiers && tier && t) return `${t(meta.tiers[tier])}`;
  return t ? t(meta.name) : meta.name;
}
