import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api, fmtDate, CATEGORIES } from '../lib/api';
import { useAuth } from '../store/auth.jsx';
import { useLang } from '../lib/i18n.jsx';
import { StatusBadge } from '../components/Badges.jsx';

const CAT_ICONS = { road: '🛣️', electricity: '⚡', water: '💧', gas: '🔥', sanitation: '🧹', other: '📌' };

export default function StaffDashboard() {
  const { user, logout } = useAuth();
  const { t } = useLang();
  const [items, setItems] = useState([]);
  const [cat, setCat] = useState('all');
  const [status, setStatus] = useState('all');
  const [modal, setModal] = useState(null);
  const [eta, setEta] = useState('48');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState(null);

  const load = () => {
    api
      .get('/complaints/staff/queue', { params: { category: cat, status } })
      .then(({ data }) => setItems(data.complaints))
      .catch(() => {});
  };
  useEffect(load, [cat, status]);

  if (!user || user.role !== 'staff') {
    return (
      <main className="mx-auto max-w-md px-4 pt-24 text-center">
        <h1 className="font-display text-2xl font-extrabold text-white">{t('staff.only')}</h1>
        <p className="mt-2 text-slate-400">{t('staff.onlySub')}</p>
        <Link to="/login" className="btn-primary mt-6">{t('staff.loginAs')}</Link>
      </main>
    );
  }

  const applyStatus = async (complaintId, newStatus) => {
    try {
      await api.patch(`/complaints/${complaintId}/status`, {
        status: newStatus,
        eta_hours: newStatus === 'in_process' ? eta : undefined,
        note
      });
      setModal(null);
      setNote('');
      setMsg({ type: 'ok', text: `${t('staff.updated')}${complaintId}${t('staff.updatedTo')}${newStatus.replace('_', ' ')}${t('staff.citizenNotified')}` });
      load();
    } catch (e) {
      setMsg({ type: 'warn', text: e.response?.data?.error || '…' });
    }
  };

  const counts = {
    new: items.filter((c) => c.status === 'verified').length,
    wip: items.filter((c) => c.status === 'in_process').length,
    done: items.filter((c) => c.status === 'resolved').length
  };

  const catTabs = [
    { key: 'all', label: t('staff.all'), icon: '🗂️' },
    ...CATEGORIES.map((c) => ({ key: c.key, label: t(`cat.${c.key}`), icon: CAT_ICONS[c.key] }))
  ];
  const statusTabs = [
    { key: 'all', label: t('staff.all') },
    { key: 'verified', label: t('staff.new') },
    { key: 'in_process', label: t('exp.f.wip') },
    { key: 'resolved', label: t('staff.done') }
  ];

  return (
    <main className="mx-auto max-w-7xl px-4 pb-10 pt-10 sm:px-6">
      <div className="glass-strong relative overflow-hidden p-7">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent/20 blur-3xl" />
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">{user.authority_type?.replace('_', ' ')}</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold text-white sm:text-3xl">{user.authority_name}</h1>
        <p className="mt-1 text-sm text-slate-400">
          {t('dash.hello')}{user.name} · {t('staff.officer')} ·{' '}
          <button onClick={() => logout()} className="text-slate-500 underline hover:text-slate-300">{t('nav.logout')}</button>
        </p>
        <div className="mt-5 flex flex-wrap gap-6">
          {[[t('staff.await'), counts.new], [t('staff.wip'), counts.wip], [t('staff.done'), counts.done]].map(([l, v]) => (
            <div key={l}>
              <p className="font-display text-2xl font-extrabold text-white">{v}</p>
              <p className="text-[11px] uppercase tracking-widest text-slate-500">{l}</p>
            </div>
          ))}
          <div className="ml-auto self-center">
            <span className="rounded-full border border-mint/30 bg-mint/10 px-4 py-1.5 text-xs font-semibold text-mint">
              {t('staff.ranked')}
            </span>
          </div>
        </div>
      </div>

      {msg && (
        <p className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
          msg.type === 'ok' ? 'border-mint/30 bg-mint/10 text-mint' : 'border-amber-400/30 bg-amber-500/10 text-amber-300'
        }`}>{msg.text}</p>
      )}

      <div className="mt-8 flex flex-wrap gap-2">
        {catTabs.map((tab) => (
          <button key={tab.key} onClick={() => setCat(tab.key)} className={`chip ${cat === tab.key ? 'chip-active' : 'chip-idle'}`}>
            {tab.icon} {tab.label}
          </button>
        ))}
        <span className="mx-2 hidden w-px self-stretch bg-white/10 sm:block" />
        {statusTabs.map((tab) => (
          <button key={tab.key} onClick={() => setStatus(tab.key)} className={`chip ${status === tab.key ? 'chip-active' : 'chip-idle'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-4">
        {items.length === 0 && <p className="glass p-8 text-center text-slate-400">{t('staff.clear')}</p>}
        {items.map((c, i) => (
          <motion.div key={c.complaint_id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.04, 0.3) }} className="glass p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent/30 to-accent3/20 font-display text-lg font-extrabold text-white">
                #{i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={c.status} />
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-slate-300">
                    {t(`cat.${c.category}`)}
                  </span>
                  <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[11px] font-bold text-accent">
                    {t('det.priority')} {c.priority_score}
                  </span>
                  {c.status === 'in_process' && c.eta_hours && (
                    <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-[11px] font-bold text-amber-300">
                      {t('det.eta')} {c.eta_hours}h
                    </span>
                  )}
                </div>
                <Link to={`/complaints/${c.complaint_id}`} className="mt-2 block font-display font-bold text-white hover:text-gradient">
                  #{c.complaint_id} · {c.title}
                </Link>
                <p className="mt-1 line-clamp-1 text-sm text-slate-400">{c.description}</p>
                <p className="mt-1 text-xs text-slate-600">
                  {c.full_address || c.address_text || `${c.latitude.toFixed(4)}, ${c.longitude.toFixed(4)}`} · {t('exp.by')} {c.submitter_name} · ▲ {c.vote_count} {t('exp.votes')} · {fmtDate(c.created_at)}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {c.status === 'verified' && (
                  <button onClick={() => setModal({ id: c.complaint_id })} className="btn-primary !px-4 !py-2 text-xs">
                    {t('staff.start')}
                  </button>
                )}
                {['verified', 'in_process'].includes(c.status) && (
                  <>
                    <button onClick={() => applyStatus(c.complaint_id, 'resolved')} className="btn-ghost !px-4 !py-2 text-xs !border-emerald-400/40 text-emerald-300 hover:!bg-emerald-500/15">
                      {t('staff.doneBtn')}
                    </button>
                    <button onClick={() => applyStatus(c.complaint_id, 'rejected')} className="btn-ghost !px-4 !py-2 text-xs !border-rose-400/40 text-rose-300 hover:!bg-rose-500/15">
                      {t('staff.reject')}
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setModal(null)}>
          <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()} className="glass-strong w-full max-w-sm p-6">
            <h3 className="font-display text-lg font-bold text-white">{t('staff.modal.title')}</h3>
            <p className="mt-1 text-sm text-slate-400">{t('staff.modal.sub')}</p>
            <label className="label mt-5">{t('staff.eta')}</label>
            <input type="number" min="1" className="input" value={eta} onChange={(e) => setEta(e.target.value)} />
            <label className="label mt-4">{t('staff.note')}</label>
            <textarea className="input min-h-[70px]" value={note} onChange={(e) => setNote(e.target.value)}
              placeholder={t('staff.note.ph')} />
            <div className="mt-5 flex gap-3">
              <button onClick={() => applyStatus(modal.id, 'in_process')} className="btn-primary flex-1 !py-2.5 text-sm">{t('staff.confirm')}</button>
              <button onClick={() => setModal(null)} className="btn-ghost !py-2.5 text-sm">{t('staff.cancel')}</button>
            </div>
          </motion.div>
        </div>
      )}
    </main>
  );
}
