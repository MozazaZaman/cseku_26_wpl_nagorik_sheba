import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api, fmtDate } from '../lib/api';
import { useAuth } from '../store/auth.jsx';
import { useLang } from '../lib/i18n.jsx';
import { StatusBadge, CategoryChip } from '../components/Badges.jsx';
import MapPanel from '../components/MapPanel.jsx';

export default function ComplaintDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { t } = useLang();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.get(`/complaints/${id}`).then(({ data }) => setData(data)).catch((e) => setErr(e.response?.data?.error || 'Not found'));
  useEffect(() => {
    load();
  }, [id]);

  if (err) return <main className="mx-auto max-w-2xl px-4 pt-20 text-center text-slate-400">{err}</main>;
  if (!data) return <main className="mx-auto max-w-5xl px-4 pt-20 text-center text-slate-500">…</main>;

  const c = data.complaint;
  const locked = c.status === 'in_process';

  const agentName = (key) => {
    const names = t('det.agentNames');
    return (typeof names === 'object' && names[key]) || key;
  };

  const vote = async () => {
    if (!user) return nav('/login', { state: { from: `/complaints/${id}` } });
    setBusy(true);
    try {
      const { data: d } = await api.post(`/complaints/${id}/vote`);
      setMsg({ type: 'ok', text: d.message });
      load();
    } catch (e) {
      const d = e.response?.data;
      if (d?.redirect_complaint_id) return nav(`/complaints/${d.redirect_complaint_id}`);
      setMsg({ type: 'warn', text: d?.alert || d?.error || '…' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12 pt-10 sm:px-6">
      <Link to="/explore" className="text-sm text-slate-400 hover:text-white">{t('det.back')}</Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass p-6">
            <div className="flex flex-wrap items-center gap-3">
              <CategoryChip category={c.category} />
              <StatusBadge status={c.status} />
              <span className="text-xs text-slate-500">{t('det.ticket')}{c.complaint_id}</span>
            </div>
            <h1 className="mt-4 font-display text-2xl font-extrabold text-white">{c.title}</h1>
            <p className="mt-1 text-xs text-slate-500">
              {t('det.reportedBy')} {c.submitter_name} · {fmtDate(c.created_at)}
              {c.eta_hours ? ` · ${t('det.eta')} ${c.eta_hours}h` : ''}
            </p>
            <p className="mt-4 leading-relaxed text-slate-300">{c.description}</p>
            {c.image_url && (
              <img src={c.image_url} alt="evidence" className="mt-4 max-h-80 rounded-xl border border-white/10 object-cover" />
            )}
            {(locked || c.status === 'resolved') && (
              <div className={`mt-4 rounded-xl border px-4 py-3 text-sm font-semibold ${
                locked
                  ? 'border-amber-400/30 bg-amber-500/10 text-amber-300'
                  : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
              }`}>
                {locked ? t('det.locked') : t('det.resolved')}
              </div>
            )}

            <div className="mt-5 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div>
                <p className="font-display text-2xl font-extrabold text-white">▲ {c.vote_count}</p>
                <p className="text-[11px] uppercase tracking-wider text-slate-500">{t('det.votes')}</p>
              </div>
              {!c.is_mine && ['submitted', 'verified'].includes(c.status) && (
                <button onClick={vote} disabled={busy || c.voted_by_me}
                  className={`btn-primary !py-2.5 ${c.voted_by_me ? '!bg-none !bg-mint/20' : ''}`}>
                  {c.voted_by_me ? t('det.votedBtn') : busy ? '…' : t('det.upvoteIssue')}
                </button>
              )}
            </div>
            {msg && (
              <p className={`mt-3 rounded-lg px-4 py-2.5 text-sm ${
                msg.type === 'ok' ? 'bg-mint/10 text-mint' : 'bg-amber-500/10 text-amber-300'
              }`}>{msg.text}</p>
            )}
          </motion.div>

          {data.agents.length > 0 && (
            <div className="glass p-6">
              <h2 className="font-display text-lg font-bold text-white">{t('det.agents')}</h2>
              <p className="text-xs text-slate-500">{t('det.agents.sub')}</p>
              <ol className="mt-4 space-y-3">
                {data.agents.map((a, i) => (
                  <li key={i} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-accent">{agentName(a.agent_name)}</p>
                      <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] font-semibold text-slate-300">
                        {a.decision}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-400">{a.output_summary}</p>
                    <p className="mt-1 text-[11px] text-slate-600">{fmtDate(a.created_at)}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {data.history.length > 0 && (
            <div className="glass p-6">
              <h2 className="font-display text-lg font-bold text-white">{t('det.timeline')}</h2>
              <ol className="mt-4 space-y-0">
                {data.history.map((h, i) => (
                  <li key={i} className="relative pb-6 pl-8 last:pb-0">
                    <span className="absolute left-0 top-1 h-3 w-3 rounded-full bg-gradient-to-br from-accent to-accent3" />
                    {i < data.history.length - 1 && <span className="absolute left-[5px] top-4 h-full w-px bg-white/10" />}
                    <p className="text-sm font-semibold capitalize text-white">
                      {h.old_status} → <span className="text-gradient">{h.new_status.replace('_', ' ')}</span>
                    </p>
                    {h.note && <p className="mt-0.5 text-sm text-slate-400">{h.note}</p>}
                    <p className="mt-0.5 text-[11px] text-slate-600">{h.changed_by} · {fmtDate(h.changed_at)}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {data.duplicate_reports.length > 0 && (
            <div className="glass p-6">
              <h2 className="font-display text-lg font-bold text-white">
                {t('det.mergedCount')}{data.duplicate_reports.length})
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-400">
                {data.duplicate_reports.map((r) => (
                  <li key={r.complaint_id}>• "{r.title}" — {fmtDate(r.created_at)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="glass p-5">
            <label className="label">{t('det.location')}</label>
            <MapPanel center={{ lat: c.latitude, lng: c.longitude }}
              markers={[{ lat: c.latitude, lng: c.longitude, emoji: '📌', color: '#ff6cb5' }]}
              height="280px" zoom={16} />
            {c.address_text && <p className="mt-3 text-sm text-slate-400">📍 {c.address_text}</p>}
            {c.full_address && (
              <p className="mt-2 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-xs leading-relaxed text-slate-400">
                🏠 {c.full_address}
              </p>
            )}
          </div>

          <div className="glass space-y-3 p-5 text-sm">
            <h2 className="font-display text-base font-bold text-white">{t('det.routing')}</h2>
            <div className="flex justify-between"><span className="text-slate-500">{t('det.authority')}</span><span className="font-semibold text-white">{c.authority_name || '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">{t('det.type')}</span><span className="capitalize text-slate-300">{(c.authority_type || '').replace('_', ' ').toLowerCase()}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">{t('det.staff')}</span><span className="text-slate-300">{c.staff_name || t('det.awaitingAssignment')}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">{t('det.priority')}</span><span className="font-bold text-accent">{c.priority_score}</span></div>
            {c.resolved_at && <div className="flex justify-between"><span className="text-slate-500">{t('det.resolvedAt')}</span><span className="text-mint">{fmtDate(c.resolved_at)}</span></div>}
          </div>
        </div>
      </div>
    </main>
  );
}
