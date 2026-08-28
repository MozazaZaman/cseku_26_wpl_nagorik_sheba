import { useLang, statusLabel, categoryLabel } from '../lib/i18n.jsx';

export function StatusBadge({ status }) {
  const { t } = useLang();
  const map = {
    submitted: 'bg-sky-500/15 text-sky-300 border-sky-400/30',
    verified: 'bg-violet-500/15 text-violet-300 border-violet-400/30',
    in_process: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
    resolved: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
    rejected: 'bg-rose-500/15 text-rose-300 border-rose-400/30',
    merged: 'bg-slate-500/15 text-slate-300 border-slate-400/30'
  };
  const dots = {
    submitted: 'bg-sky-400', verified: 'bg-violet-400', in_process: 'bg-amber-400',
    resolved: 'bg-emerald-400', rejected: 'bg-rose-400', merged: 'bg-slate-400'
  };
  const m = map[status] || map.submitted;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold ${m}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dots[status] || dots.submitted} ${status === 'in_process' ? 'animate-pulse' : ''}`} />
      {statusLabel(status, t)}
    </span>
  );
}

const CAT_ICONS = {
  road: '🛣️', electricity: '⚡', water: '💧', gas: '🔥', sanitation: '🧹', other: '📌'
};

export function CategoryChip({ category }) {
  const { t } = useLang();
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-slate-300">
      <span>{CAT_ICONS[category] || '📌'}</span> {categoryLabel(category, t)}
    </span>
  );
}

export { CAT_ICONS };
