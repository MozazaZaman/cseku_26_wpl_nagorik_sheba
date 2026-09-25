import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useLang, categoryLabel } from '../lib/i18n.jsx';
import { scoreEmoji } from '../lib/satisfaction.js';

/**
 * Public per-authority performance block (transparency).
 * Used on the complaint detail page and the leaderboard's authority drill-in.
 */
export default function AuthorityStats({ authorityId, compact = false }) {
  const { t } = useLang();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get(`/analytics/authority/${authorityId}`)
      .then(({ data }) => setData(data))
      .catch(() => {});
  }, [authorityId]);

  if (!data) return null;
  const m = data.metrics;
  const maxCat = Math.max(...m.volume_by_category.map((c) => c.total), 1);

  return (
    <div className={`glass p-5 ${compact ? '' : 'p-6'}`}>
      <h2 className="font-display text-base font-bold text-white">{t('an.performance')}</h2>
      <p className="text-xs text-slate-500">{data.authority.name} · {t('an.publicData')}</p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
          <p className="font-display text-xl font-extrabold text-mint">{m.resolution_rate}%</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500 leading-tight text-balance break-words">{t('an.resolutionRate')}</p>
        </div>
        <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
          <p className="font-display text-xl font-extrabold text-white">
            {m.avg_resolution_days != null ? `${m.avg_resolution_days}d` : '—'}
          </p>
          <p className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500 leading-tight text-balance break-words">{t('an.avgResolution')}</p>
        </div>
        {/* Aggregate citizen satisfaction only — never comments or any
            citizen-identifying info on the public dashboard */}
        <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
          <p className="font-display text-xl font-extrabold text-white">
            {m.avg_satisfaction != null ? `${scoreEmoji(m.avg_satisfaction)} ${m.avg_satisfaction}` : '—'}
          </p>
          <p className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500 leading-tight text-balance break-words">{t('an.satisfaction')}</p>
        </div>
        <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
          <p className="font-display text-xl font-extrabold text-white">{m.total_complaints}</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500 leading-tight text-balance break-words">{t('an.totalComplaints')}</p>
        </div>
        <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
          <p className="font-display text-xl font-extrabold text-rose-300">{m.rejection_rate}%</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500 leading-tight text-balance break-words">{t('an.rejectionRate')}</p>
        </div>
      </div>

      {/* Category volume bars */}
      {m.volume_by_category.length > 0 && (
        <div className="mt-4 space-y-2">
          {m.volume_by_category.map((c) => (
            <div key={c.category} className="flex items-center gap-3">
              <span className="w-24 shrink-0 truncate text-xs text-slate-400">{categoryLabel(c.category, t)}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/5">
                <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent3"
                  style={{ width: `${(c.total / maxCat) * 100}%` }} />
              </div>
              <span className="w-16 shrink-0 text-right text-xs font-semibold text-slate-300">
                {c.resolved}/{c.total}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
