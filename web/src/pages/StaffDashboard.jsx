import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api, fmtDate, CATEGORIES } from '../lib/api';
import { useAuth } from '../store/auth.jsx';
import { useLang } from '../lib/i18n.jsx';
import { StatusBadge } from '../components/Badges.jsx';
import WorkflowActions from '../components/WorkflowActions.jsx';

const CAT_ICONS = { road: '🛣️', electricity: '⚡', water: '💧', gas: '🔥', sanitation: '🧹', other: '📌' };

const ROLE_META = {
  junior: { icon: '🧑‍💼', cls: 'border-sky-400/40 bg-sky-500/15 text-sky-300', view: 'queue' },
  senior: { icon: '📋', cls: 'border-violet-400/40 bg-violet-500/15 text-violet-300', view: 'oversight' },
  mayor: { icon: '🏛️', cls: 'border-amber/40 bg-amber/15 text-amber', view: 'oversight' },
  wit: { icon: '🔍', cls: 'border-mint/40 bg-mint/15 text-mint', view: 'queue' },
  field: { icon: '👷', cls: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300', view: 'queue' }
};

/** Which actions the role can take at the complaint's current status. */
function actionsFor(role, c, myStaffId) {
  switch (role) {
    case 'junior':
      return ['verified', 'junior_review'].includes(c.status) ? ['junior_approve', 'junior_reject'] : [];
    case 'senior':
      if (c.status === 'senior_review') return ['senior_approve', 'senior_reject'];
      if (c.status === 'approved') return ['send_to_wit'];
      return [];
    case 'mayor':
      return c.status === 'mayor_review' ? ['mayor_approve', 'mayor_reject'] : [];
    case 'wit':
      return c.status === 'wit_review' ? ['wit_assign'] : [];
    case 'field':
      if (c.executor_staff_id !== myStaffId) return [];
      if (c.status === 'assigned') return ['field_start', 'field_resolve'];
      if (c.status === 'in_process') return ['field_resolve'];
      return [];
    default:
      return [];
  }
}

export default function StaffDashboard() {
  const { user, logout } = useAuth();
  const { t } = useLang();
  const [items, setItems] = useState([]);
  const [cat, setCat] = useState('all');
  const [status, setStatus] = useState('all');
  const [view, setView] = useState('queue'); // queue | oversight (senior/mayor)
  const [executors, setExecutors] = useState([]);
  const [detail, setDetail] = useState(null); // { complaint, my_actions } for inline actions

  const load = () => {
    api
      .get('/complaints/staff/queue', { params: { category: cat, status } })
      .then(({ data }) => setItems(data.complaints))
      .catch(() => {});
  };
  useEffect(load, [cat, status]);

  const staffRole = user?.staff_role || 'junior';
  const meta = ROLE_META[staffRole] || ROLE_META.junior;

  // WIT needs executor list for assignment
  useEffect(() => {
    if (staffRole === 'wit') {
      api.get('/complaints/staff/executors')
        .then(({ data }) => setExecutors(data.executors))
        .catch(() => {});
    }
  }, [staffRole]);

  // fetch my_actions per complaint (drives inline buttons)
  useEffect(() => {
    let cancelled = false;
    const ids = items.filter((c) => !['resolved', 'rejected', 'merged'].includes(c.status)).map((c) => c.complaint_id);
    Promise.all(ids.map((id) => api.get(`/complaints/${id}`).then(({ data }) => ({
      id,
      my_actions: data.my_actions || []
    })).catch(() => ({ id, my_actions: [] }))))
      .then((res) => {
        if (!cancelled) setDetail(Object.fromEntries(res.map((r) => [r.id, r.my_actions])));
      });
    return () => { cancelled = true; };
  }, [items]);

  if (!user || user.role !== 'staff') {
    return (
      <main className="mx-auto max-w-md px-4 pt-24 text-center">
        <h1 className="font-display text-2xl font-extrabold text-white">{t('staff.only')}</h1>
        <p className="mt-2 text-slate-400">{t('staff.onlySub')}</p>
        <Link to="/login" className="btn-primary mt-6">{t('staff.loginAs')}</Link>
      </main>
    );
  }

  const myActions = (c) => detail?.[c.complaint_id] || actionsFor(staffRole, c, user.id);
  const actionable = (c) => myActions(c).length > 0;
  const isOversight = meta.view === 'oversight';

  const counts = {
    action: items.filter(actionable).length,
    review: items.filter((c) => ['verified', 'junior_review', 'senior_review', 'mayor_review', 'approved', 'wit_review'].includes(c.status)).length,
    wip: items.filter((c) => ['assigned', 'in_process'].includes(c.status)).length,
    rejected: items.filter((c) => c.status === 'rejected').length
  };

  const catTabs = [
    { key: 'all', label: t('staff.all'), icon: '🗂️' },
    ...CATEGORIES.map((c) => ({ key: c.key, label: t(`cat.${c.key}`), icon: CAT_ICONS[c.key] }))
  ];
  const statusTabs = [
    { key: 'all', label: t('staff.all') },
    { key: 'verified', label: t('st.verified') },
    { key: 'junior_review', label: t('st.junior_review') },
    { key: 'senior_review', label: t('st.senior_review') },
    { key: 'mayor_review', label: t('st.mayor_review') },
    { key: 'wit_review', label: t('st.wit_review') },
    { key: 'assigned', label: t('st.assigned') },
    { key: 'in_process', label: t('exp.f.wip') },
    { key: 'resolved', label: t('staff.done') },
    { key: 'rejected', label: t('st.rejected') }
  ];

  return (
    <main className="mx-auto max-w-7xl px-4 pb-10 pt-10 sm:px-6">
      {/* Role console header */}
      <div className="glass-strong relative overflow-hidden p-7">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent/20 blur-3xl" />
        <div className="flex flex-wrap items-center gap-3">
          <span className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-widest ${meta.cls}`}>
            {meta.icon} {t(`wf.roleBadge.${staffRole}`)}
          </span>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">{user.authority_type?.replace('_', ' ')}</p>
        </div>
        <h1 className="mt-1 font-display text-2xl font-extrabold text-white sm:text-3xl">{user.authority_name}</h1>
        <p className="mt-1 text-sm text-slate-400">
          {t('dash.hello')}{user.name} · {t(`wf.roleBadge.${staffRole}`)} ·{' '}
          <button onClick={() => logout()} className="text-slate-500 underline hover:text-slate-300">{t('nav.logout')}</button>
        </p>
        <div className="mt-5 flex flex-wrap gap-6">
          {[
            [t('wf.myQueue'), counts.action],
            [t('staff.await'), counts.review],
            [t('staff.wip'), counts.wip],
            [t('st.rejected'), counts.rejected]
          ].map(([l, v]) => (
            <div key={l}>
              <p className="font-display text-2xl font-extrabold text-white">{v}</p>
              <p className="text-[11px] uppercase tracking-widest text-slate-500">{l}</p>
            </div>
          ))}
        </div>
        {isOversight && (
          <div className="mt-4 flex gap-2">
            <button onClick={() => setView('queue')}
              className={`chip text-xs ${view === 'queue' ? 'chip-active' : 'chip-idle'}`}>
              {t('wf.myQueue')}
            </button>
            <button onClick={() => setView('oversight')}
              className={`chip text-xs ${view === 'oversight' ? 'chip-active' : 'chip-idle'}`}>
              {t('wf.allProblems')}
            </button>
          </div>
        )}
      </div>

      {/* Filters — department row, then a distinct workflow-stage panel below */}
      <div className="mt-8">
        {/* Row 1: department / category pills (unchanged position & styling) */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[11px] font-bold uppercase tracking-widest text-slate-500">
            {t('staff.filter.department')}
          </span>
          {catTabs.map((tab) => (
            <button key={tab.key} onClick={() => setCat(tab.key)} className={`chip ${cat === tab.key ? 'chip-active' : 'chip-idle'}`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Row 2: workflow stage pills — separate card so it reads as a different dimension */}
        <div className="glass mt-3 rounded-2xl p-4 sm:p-5">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-accent">
            {t('staff.filter.stage')}
          </p>
          <div className="flex flex-wrap gap-2">
            {statusTabs.map((tab) => (
              <button key={tab.key} onClick={() => setStatus(tab.key)} className={`chip ${status === tab.key ? 'chip-active' : 'chip-idle'}`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Complaint cards with INLINE forward/reject buttons */}
      <div className="mt-6 space-y-4">
        {items.length === 0 && <p className="glass p-8 text-center text-slate-400">{t('staff.clear')}</p>}
        {items
          .filter((c) => (view === 'queue' || actionable(c) ? true : true)) // oversight shows all; queue naturally filtered by API
          .map((c, i) => {
            const actions = myActions(c);
            const stageRole = c.stage_owner_role;
            return (
              <motion.div key={c.complaint_id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3) }}
                className={`glass p-5 ${c.status === 'rejected' ? 'border-rose-400/20' : ''}`}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent/30 to-accent3/20 font-display text-lg font-extrabold text-white">
                    #{i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={c.status} />
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-slate-300">
                        {CAT_ICONS[c.category]} {t(`cat.${c.category}`)}
                      </span>
                      <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[11px] font-bold text-accent">
                        {t('det.priority')} {c.priority_score} · ▲ {c.vote_count}
                      </span>
                      {['assigned', 'in_process'].includes(c.status) && c.eta_hours && (
                        <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-[11px] font-bold text-amber-300">
                          {t('det.eta')} {c.eta_hours}h
                        </span>
                      )}
                      {c.status === 'rejected' && (
                        <span className="rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1 text-[11px] font-bold text-rose-300">
                          {t('wf.rejectedAt')}: {t(`wf.stage.${c.rejected_at_stage}`)}
                        </span>
                      )}
                    </div>
                    <Link to={`/complaints/${c.complaint_id}`} className="mt-2 block font-display font-bold text-white hover:text-gradient">
                      #{c.complaint_id} · {c.title}
                    </Link>
                    <p className="mt-1 line-clamp-1 text-sm text-slate-400">{c.description}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                      <span>{c.full_address || c.address_text || `${c.latitude.toFixed(4)}, ${c.longitude.toFixed(4)}`}</span>
                      <span>{t('exp.by')} {c.submitter_name} · {fmtDate(c.created_at)}</span>
                      <span>
                        <span className="text-slate-500">{t('wf.by')}:</span>{' '}
                        {stageRole ? t(`wf.roleBadge.${stageRole}`) : '—'}
                        {c.executor_name ? ` · ${t('wf.executor')}: ${c.executor_name}` : ''}
                      </span>
                    </div>
                    {/* INLINE ACTION BUTTONS — forward/reject directly on the card */}
                    <WorkflowActions complaint={c} myActions={actions} executors={executors} onDone={load} compact />
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link to={`/complaints/${c.complaint_id}`} className="btn-ghost !px-4 !py-2 text-xs">
                      {t('det.review')}
                    </Link>
                  </div>
                </div>
              </motion.div>
            );
          })}
      </div>
    </main>
  );
}
