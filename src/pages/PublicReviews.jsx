import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api, fmtDate } from '../lib/api';
import { useAuth } from '../store/auth.jsx';
import { useLang, categoryLabel } from '../lib/i18n.jsx';
import { SATISFACTION_TIERS, tierByScore } from '../lib/satisfaction.js';

const CAT_ICONS = { road: '🛣️', electricity: '⚡', water: '💧', gas: '🔥', sanitation: '🧹', other: '📌' };

/**
 * Mayor/Chairman "Public Reviews" — the single feedback view for their office.
 *
 * Leads with the aggregate (average, rating count, per-tier breakdown) and then
 * lists every resolved complaint of their own authority with the citizen's
 * public feedback (rating + optional comment). Resolutions the citizen has not
 * rated yet are listed and flagged, so the head of the office can see which
 * work still lacks feedback.
 *
 * Authority scoping is server-enforced (the endpoint trusts only the JWT), so
 * this page can never show another office's reviews.
 */
export default function PublicReviews() {
  const { user } = useAuth();
  const { t } = useLang();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (user?.role !== 'staff' || user.staff_role !== 'mayor') return;
    api.get('/complaints/staff/reviews')
      .then(({ data }) => setData(data))
      .catch((e) => setErr(e.response?.data?.error || 'Failed to load public reviews'));
  }, [user]);

  if (!user || user.role !== 'staff' || user.staff_role !== 'mayor') {
    return (
      <main className="mx-auto max-w-md px-4 pt-24 text-center">
        <h1 className="font-display text-2xl font-extrabold text-white">{t('pr.title')} {t('pr.titleHl')}</h1>
        <p className="mt-2 text-slate-400">{t('staff.onlySub')}</p>
        <Link to="/login" className="btn-primary mt-6">{t('staff.loginAs')}</Link>
      </main>
    );
  }

  const reviews = data?.reviews || [];
  const breakdown = data?.breakdown || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const maxTier = Math.max(...SATISFACTION_TIERS.map((x) => breakdown[x.score] || 0), 1);

  return (
    <main className="mx-auto max-w-5xl px-4 pb-12 pt-10 sm:px-6">
      <Link to="/staff" className="text-sm text-slate-400 hover:text-white">{t('pr.backToConsole')}</Link>

      <div className="glass-strong relative mt-4 overflow-hidden p-7">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent/20 blur-3xl" />
        <span className="rounded-full border border-amber/40 bg-amber/15 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-amber">
          🏛️ {t('wf.roleBadge.mayor')}
        </span>
        <h1 className="mt-2 font-display text-2xl font-extrabold text-white sm:text-3xl">
          {t('pr.title')} <span className="text-gradient">{t('pr.titleHl')}</span>
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          {user.authority_name} · {t('pr.sub')}
        </p>

        {err && <p className="mt-6 text-rose-300">{err}</p>}
        {!data && !err && <p className="mt-10 text-center text-slate-500">…</p>}

        {data && (
          <>
            {/* Aggregate: average + counts */}
            <div className="mt-6 flex flex-wrap items-end gap-8">
              <div>
                <p className="font-display text-4xl font-extrabold text-white">
                  {data.avg_satisfaction != null ? data.avg_satisfaction.toFixed(1) : '—'}
                  <span className="text-lg text-slate-500"> / 5</span>
                </p>
                <p className="text-[11px] uppercase tracking-widest text-slate-500">{t('pr.avgScore')}</p>
              </div>
              <div>
                <p className="font-display text-2xl font-extrabold text-accent">{data.rated_count}</p>
                <p className="text-[11px] uppercase tracking-widest text-slate-500">{t('pr.rated')}</p>
              </div>
              <div>
                <p className="font-display text-2xl font-extrabold text-white">{data.total_resolved}</p>
                <p className="text-[11px] uppercase tracking-widest text-slate-500">{t('pr.resolved')}</p>
              </div>
            </div>

            {/* Per-tier breakdown */}
            {data.rated_count > 0 && (
              <div className="mt-6">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-accent">{t('pr.breakdown')}</p>
                <div className="space-y-2.5">
                  {SATISFACTION_TIERS.map((tier) => {
                    const n = breakdown[tier.score] || 0;
                    return (
                      <div key={tier.score} className="flex items-center gap-3">
                        <span className="w-24 shrink-0 text-xs font-semibold text-slate-300">
                          {tier.emoji} {t(tier.label)}
                        </span>
                        <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/5">
                          <div className={`h-full rounded-full ${tier.bar} transition-all`}
                            style={{ width: `${(n / maxTier) * 100}%` }} />
                        </div>
                        <span className="w-8 shrink-0 text-right text-xs font-bold text-slate-300">{n}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {data && reviews.length === 0 && (
        <div className="glass mt-6 p-8 text-center text-sm text-slate-400">{t('pr.none')}</div>
      )}

      <ol className="mt-6 space-y-4">
        {reviews.map((r, i) => {
          const tier = tierByScore(r.satisfaction_score);
          const hasFeedback = r.satisfaction_score != null;
          return (
            <motion.li key={r.complaint_id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.035, 0.35) }}
              className="glass p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
                  ✓ {t('st.resolved')}
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[11px] font-medium text-slate-300">
                  {CAT_ICONS[r.category] || '📌'} {categoryLabel(r.category, t)}
                </span>
                {hasFeedback ? (
                  <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${tier?.ring} ${tier?.glow} ${tier?.text}`}>
                    {tier?.emoji} {r.satisfaction_score}/5 · {t(tier.label)}
                  </span>
                ) : (
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">
                    {t('pr.noFeedback')}
                  </span>
                )}
                <span className="text-[11px] text-slate-600">#{r.complaint_id}</span>
              </div>

              <Link to={`/complaints/${r.complaint_id}`}
                className="mt-2 block font-display font-bold text-white hover:text-gradient">
                {r.title}
              </Link>

              {hasFeedback ? (
                <div className="mt-3 rounded-xl border border-white/5 bg-white/[0.02] p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">{t('pr.commentLabel')}</p>
                  {r.satisfaction_comment ? (
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-200">“{r.satisfaction_comment}”</p>
                  ) : (
                    <p className="mt-1.5 text-xs italic text-slate-500">—</p>
                  )}
                  <p className="mt-2 text-[11px] text-slate-600">{fmtDate(r.satisfaction_submitted_at)}</p>
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500">{t('pr.noFeedbackSub')}</p>
              )}

              <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
                <span className="text-[11px] text-slate-600">
                  {t('pr.resolvedOn')} · {fmtDate(r.resolved_at)}
                </span>
                <Link to={`/complaints/${r.complaint_id}`}
                  className="text-[11px] font-semibold text-accent hover:underline">
                  {t('pr.viewComplaint')} →
                </Link>
              </div>
            </motion.li>
          );
        })}
      </ol>
    </main>
  );
}
