import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api, fmtDate } from '../lib/api';
import { useAuth } from '../store/auth.jsx';
import { useLang, categoryLabel } from '../lib/i18n.jsx';
import { StatusBadge } from '../components/Badges.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useLang();
  const [mine, setMine] = useState([]);
  const [notifs, setNotifs] = useState([]);

  useEffect(() => {
    if (user?.role !== 'citizen') return;
    api.get('/complaints/mine').then(({ data }) => setMine(data.complaints)).catch(() => {});
    api.get('/my/notifications').then(({ data }) => setNotifs(data.notifications)).catch(() => {});
  }, [user]);

  if (user?.role === 'staff') {
    return (
      <main className="mx-auto max-w-2xl px-4 pt-24 text-center">
        <h1 className="font-display text-2xl font-extrabold text-white">{t('dash.staffTitle')}</h1>
        <p className="mt-2 text-slate-400">{t('dash.staffSub')}</p>
        <Link to="/staff" className="btn-primary mt-6">{t('dash.openStaff')}</Link>
      </main>
    );
  }
  if (!user) {
    return (
      <main className="mx-auto max-w-2xl px-4 pt-24 text-center">
        <h1 className="font-display text-2xl font-extrabold text-white">{t('dash.loginRequired')}</h1>
        <Link to="/login" className="btn-primary mt-6">{t('nav.login')}</Link>
      </main>
    );
  }

  const stats = [
    [t('dash.total'), mine.length, '📋'],
    [t('dash.wip'), mine.filter((c) => c.status === 'in_process').length, '⏳'],
    [t('dash.resolved'), mine.filter((c) => c.status === 'resolved').length, '✅'],
    [t('dash.votes'), mine.reduce((n, c) => n + c.vote_count, 0), '▲']
  ];

  return (
    <main className="mx-auto max-w-7xl px-4 pb-10 pt-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-white">
            {t('dash.hello')}<span className="text-gradient">{user.name.split(' ')[0]}</span>
          </h1>
          <p className="mt-1 text-slate-400">{t('dash.sub')}</p>
        </div>
        <Link to="/submit" className="btn-primary">{t('dash.new')}</Link>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(([label, val, icon], i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }} className="glass p-5">
            <p className="text-2xl">{icon}</p>
            <p className="mt-2 font-display text-3xl font-extrabold text-white">{val}</p>
            <p className="text-xs uppercase tracking-widest text-slate-500">{label}</p>
          </motion.div>
        ))}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <h2 className="font-display text-xl font-bold text-white">{t('dash.mine')}</h2>
          <div className="mt-4 space-y-4">
            {mine.length === 0 && (
              <div className="glass p-8 text-center text-slate-400">
                {t('dash.none')}
                <div className="mt-4"><Link to="/submit" className="btn-primary !py-2.5">{t('dash.first')}</Link></div>
              </div>
            )}
            {mine.map((c) => (
              <Link key={c.complaint_id} to={`/complaints/${c.complaint_id}`}
                className="glass block p-5 transition hover:-translate-y-0.5 hover:border-accent/40">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-white/5 px-2 py-0.5 text-[11px] font-bold text-slate-400">
                      #{c.complaint_id}
                    </span>
                    <span className="font-semibold capitalize text-slate-300">{categoryLabel(c.category, t)}</span>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
                <p className="mt-2 font-display font-bold text-white">{c.title}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {c.authority_name || t('dash.routing')} · ▲ {c.vote_count} {t('exp.votes')} · {fmtDate(c.created_at)}
                  {c.status === 'in_process' && c.eta_hours ? ` · ${t('det.eta')} ${c.eta_hours}h` : ''}
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-white">{t('dash.notifs')}</h2>
          <div className="mt-4 space-y-3">
            {notifs.length === 0 && <div className="glass p-6 text-center text-sm text-slate-500">{t('dash.noNotifs')}</div>}
            {notifs.map((n) => (
              <Link key={n.notification_id} to={n.complaint_id ? `/complaints/${n.complaint_id}` : '#'}
                className="glass block p-4 transition hover:border-accent/40">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-white">{n.title}</p>
                  {!n.is_read && <span className="h-2 w-2 rounded-full bg-accent" />}
                </div>
                <p className="mt-1 text-sm text-slate-400">{n.message}</p>
                <p className="mt-1 text-[11px] text-slate-600">{fmtDate(n.created_at)}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
