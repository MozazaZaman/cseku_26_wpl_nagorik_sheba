import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { useAuth } from '../store/auth.jsx';
import { useLang } from '../lib/i18n.jsx';
import AchievementBadges from '../components/AchievementBadges.jsx';

/**
 * Mayor/Chairman "Team Badges" — a dedicated page showing every
 * badge-eligible staff member of their own authority and the achievement
 * badges they currently hold.
 *
 * This is the roster companion to the personal badge strip on the staff
 * console: it lets the head of the office recognize strong work at a glance.
 * Badges are positive-only (no rankings, no "worst performer" lists) and a
 * staff member with no badges shows a neutral, encouraging empty state.
 *
 * Authority scoping is server-enforced — the endpoint trusts only the JWT,
 * so this page can never render another office's roster.
 */
export default function TeamBadges() {
  const { user } = useAuth();
  const { t } = useLang();
  const [team, setTeam] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (user?.role !== 'staff' || user.staff_role !== 'mayor') return;
    api.get('/staff/team/badges')
      .then(({ data }) => setTeam(data.team || []))
      .catch((e) => setErr(e.response?.data?.error || 'Failed to load team badges'));
  }, [user]);

  if (!user || user.role !== 'staff' || user.staff_role !== 'mayor') {
    return (
      <main className="mx-auto max-w-md px-4 pt-24 text-center">
        <h1 className="font-display text-2xl font-extrabold text-white">{t('badge.section.team')}</h1>
        <p className="mt-2 text-slate-400">{t('staff.onlySub')}</p>
        <Link to="/login" className="btn-primary mt-6">{t('staff.loginAs')}</Link>
      </main>
    );
  }

  const withBadges = team.filter((m) => m.badge_count > 0).length;

  return (
    <main className="mx-auto max-w-5xl px-4 pb-12 pt-10 sm:px-6">
      <Link to="/staff" className="text-sm text-slate-400 hover:text-white">{t('pr.backToConsole')}</Link>

      <div className="glass-strong relative mt-4 overflow-hidden p-7">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent/20 blur-3xl" />
        <span className="rounded-full border border-amber/40 bg-amber/15 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-amber">
          🏛️ {t('wf.roleBadge.mayor')}
        </span>
        <h1 className="mt-2 font-display text-2xl font-extrabold text-white sm:text-3xl">
          {t('badge.section.team')}
        </h1>
        <p className="mt-1 text-sm text-slate-400">{t('badge.section.sub')}</p>
        {team.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-6">
            <div>
              <p className="font-display text-2xl font-extrabold text-white">{team.length}</p>
              <p className="text-[11px] uppercase tracking-widest text-slate-500">{t('badge.teamTotal')}</p>
            </div>
            <div>
              <p className="font-display text-2xl font-extrabold text-white">{withBadges}</p>
              <p className="text-[11px] uppercase tracking-widest text-slate-500">{t('badge.teamRecognized')}</p>
            </div>
          </div>
        )}
      </div>

      {err && <p className="mt-6 text-center text-sm text-rose-400">{err}</p>}

      <div className="mt-6 space-y-3">
        {team.length === 0 && !err && (
          <p className="glass p-8 text-center text-slate-400">{t('badge.teamEmpty')}</p>
        )}
        {team.map((m, i) => (
          <motion.div key={m.staff_id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.04, 0.3) }}
            className="glass rounded-2xl p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-white">{m.full_name}</span>
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {t(`role.${m.staff_role}`)}
              </span>
              {m.badge_count > 0 ? (
                <span className="ml-auto text-[11px] font-semibold text-amber-300">
                  {m.badge_count} {t('badge.countLabel')}
                </span>
              ) : (
                <span className="ml-auto text-[11px] text-slate-500">—</span>
              )}
            </div>
            {m.badges.length > 0 || m.recognitions.length > 0 ? (
              <div className="mt-3">
                <AchievementBadges badges={m.badges} recognitions={m.recognitions} compact />
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500">{t('badge.empty')}</p>
            )}
          </motion.div>
        ))}
      </div>
    </main>
  );
}
