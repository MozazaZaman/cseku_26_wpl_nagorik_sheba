import { useLang } from '../lib/i18n.jsx';

/**
 * SLA countdown badge for staff queue cards & complaint detail.
 * Renders nothing when the complaint is not inside a timed stage.
 *
 * Variants:
 *   - red    OVERDUE by <time>      (deadline passed)
 *   - amber  <time> left            (final 25% of the window)
 *   - slate  <time> left            (normal)
 */
export default function SlaBadge({ complaint }) {
  const { t } = useLang();
  if (!complaint?.sla_deadline) return null;

  const deadline = new Date(complaint.sla_deadline + 'Z').getTime();
  const entered = complaint.stage_entered_at ? new Date(complaint.stage_entered_at + 'Z').getTime() : deadline;
  const now = Date.now();
  const remaining = deadline - now;
  const windowMs = Math.max(deadline - entered, 1);

  const fmt = (ms) => {
    const abs = Math.abs(ms);
    const d = Math.floor(abs / 86400000);
    const h = Math.floor((abs % 86400000) / 3600000);
    if (d >= 1) return `${d}d ${h}h`;
    const m = Math.floor((abs % 3600000) / 60000);
    if (h >= 1) return `${h}h ${m}m`;
    return `${m}m`;
  };

  if (remaining < 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/40 bg-rose-500/15 px-3 py-1 text-[11px] font-bold text-rose-300">
        🔴 {t('sla.overdue')} {fmt(remaining)}
      </span>
    );
  }
  const urgent = remaining <= windowMs * 0.25;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-bold ${
      urgent
        ? 'border-amber-400/40 bg-amber-500/10 text-amber-300'
        : 'border-white/10 bg-white/[0.04] text-slate-300'
    }`}>
      ⏱ {t('sla.left')} {fmt(remaining)}
    </span>
  );
}
