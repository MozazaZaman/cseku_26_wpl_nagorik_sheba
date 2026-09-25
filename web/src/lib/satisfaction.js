/**
 * Citizen satisfaction scale — 1 (Very Poor) to 5 (Excellent).
 *
 * Shared between the rating picker on the resolve-confirm page and the mayor's
 * per-tier breakdown so the emoji/colour labels always stay in sync. Colours
 * follow the reference scale: red → orange → yellow → light-green → green.
 * `t` is the i18n key under `sat.tier.<score>`.
 */
export const SATISFACTION_TIERS = [
  { score: 1, emoji: '😡', label: 'sat.tier.1', ring: 'border-rose-400', glow: 'bg-rose-500/15', text: 'text-rose-300', bar: 'bg-rose-400' },
  { score: 2, emoji: '😕', label: 'sat.tier.2', ring: 'border-orange-400', glow: 'bg-orange-500/15', text: 'text-orange-300', bar: 'bg-orange-400' },
  { score: 3, emoji: '😐', label: 'sat.tier.3', ring: 'border-amber-400', glow: 'bg-amber-500/15', text: 'text-amber-300', bar: 'bg-amber-400' },
  { score: 4, emoji: '🙂', label: 'sat.tier.4', ring: 'border-lime-400', glow: 'bg-lime-500/15', text: 'text-lime-300', bar: 'bg-lime-400' },
  { score: 5, emoji: '🤩', label: 'sat.tier.5', ring: 'border-emerald-400', glow: 'bg-emerald-500/15', text: 'text-emerald-300', bar: 'bg-emerald-400' }
];

export const tierByScore = (score) => SATISFACTION_TIERS.find((t) => t.score === score) || null;

/** Emoji-only rendering of a score, e.g. for the public aggregate number. */
export const scoreEmoji = (score) => tierByScore(score)?.emoji || '⭐';

/** Coloured pill class for an average score (used publicly, aggregate only). */
export function avgScoreClass(avg) {
  if (avg == null) return 'bg-white/5 text-slate-400';
  if (avg >= 4.5) return 'bg-emerald-500/15 text-emerald-300';
  if (avg >= 3.5) return 'bg-lime-500/15 text-lime-300';
  if (avg >= 2.5) return 'bg-amber-500/15 text-amber-300';
  if (avg >= 1.5) return 'bg-orange-500/15 text-orange-300';
  return 'bg-rose-500/15 text-rose-300';
}
