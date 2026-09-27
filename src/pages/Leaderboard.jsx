import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useLang } from '../lib/i18n.jsx';
import { scoreEmoji } from '../lib/satisfaction.js';
import { motion } from 'framer-motion';

/**
 * Public authority leaderboard — rolling 90-day window, ranked by composite
 * score (resolution rate - avg days x 2). Authorities under the complaint
 * threshold are listed separately as "insufficient data".
 */
export default function Leaderboard() {
  const { t } = useLang();
  const [data, setData] = useState(null);
  const [division, setDivision] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    setData(null);
    api.get('/analytics/leaderboard', { params: division ? { division } : {} })
      .then(({ data }) => setData(data))
      .catch(() => setErr('Failed to load leaderboard'));
  }, [division]);

  const medal = (i) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`);
  const typeLabel = (ty) => t(`an.type.${ty}`) || ty;

  return (
    <main className="mx-auto max-w-5xl px-4 pb-12 pt-10 sm:px-6">
      <h1 className="font-display text-2xl font-extrabold text-white sm:text-3xl">
        {t('an.lbTitle')} <span className="text-gradient">{t('an.lbTitleHl')}</span>
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-400">
        {t('an.lbSub')}
      </p>

      {/* Division filter */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="label">{t('an.division')}</label>
        <select className="input w-48" value={division} onChange={(e) => setDivision(e.target.value)}>
          <option value="">{t('an.allDivisions')}</option>
          {(data?.divisions || []).map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        {data && (
          <span className="text-xs text-slate-500">
            {t('an.window')}: {data.window_days}d · {t('an.minComplaints')}: {data.min_complaints}
          </span>
        )}
      </div>

      {err && <p className="mt-6 text-rose-300">{err}</p>}
      {!data && !err && <p className="mt-10 text-center text-slate-500">…</p>}

      {data && (
        <>
          {/* Ranked table */}
          <div className="glass mt-6 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">{t('an.authority')}</th>
                  <th className="hidden px-4 py-3 sm:table-cell">{t('an.divisionCol')}</th>
                  <th className="px-4 py-3 text-right">{t('an.resolutionRate')}</th>
                  <th className="hidden px-4 py-3 text-right sm:table-cell">{t('an.avgResolution')}</th>
                  <th className="px-4 py-3 text-right">{t('an.satisfaction')}</th>
                  <th className="px-4 py-3 text-right">{t('an.totalComplaints')}</th>
                  <th className="px-4 py-3 text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {data.ranked.map((a, i) => (
                  <motion.tr key={a.authority_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.03, 0.4) }}
                    className="border-b border-white/5 hover:bg-white/[0.03]">
                    <td className="px-4 py-3 font-bold text-slate-300">{medal(i)}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-white">{a.name}</p>
                      <p className="text-[11px] text-slate-500">{typeLabel(a.type)}</p>
                    </td>
                    <td className="hidden px-4 py-3 text-slate-400 sm:table-cell">{a.division} · {a.district}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        a.resolution_rate >= 75 ? 'bg-mint/15 text-mint'
                        : a.resolution_rate >= 50 ? 'bg-amber-500/15 text-amber-300'
                        : 'bg-rose-500/15 text-rose-300'
                      }`}>{a.resolution_rate}%</span>
                    </td>
                    <td className="hidden px-4 py-3 text-right text-slate-300 sm:table-cell">
                      {a.avg_resolution_days != null ? `${a.avg_resolution_days}d` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {a.avg_satisfaction != null ? (
                        <span title={t('an.satisfactionTip')} className="font-semibold text-slate-200">
                          {scoreEmoji(a.avg_satisfaction)} {a.avg_satisfaction}
                        </span>
                      ) : (
                        <span title={t('an.satisfactionTip')} className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">{a.total_complaints}</td>
                    <td className="px-4 py-3 text-right font-display font-extrabold text-accent">
                      {a.score != null ? a.score : '—'}
                    </td>
                  </motion.tr>
                ))}
                {data.ranked.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">{t('an.noRanked')}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Insufficient data */}
          {data.insufficient.length > 0 && (
            <div className="glass mt-4 p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{t('an.insufficient')}</p>
              <p className="mt-1 text-xs text-slate-500">{t('an.insufficientSub')}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {data.insufficient.map((a) => (
                  <span key={a.authority_id} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-400">
                    {a.name} · {a.total_complaints}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
