import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../store/auth.jsx';
import { useLang } from '../lib/i18n.jsx';
import NotificationBell from './NotificationBell.jsx';
import IdentityPill from './IdentityPill.jsx';
import SideDrawer from './SideDrawer.jsx';

// Kept inline in the top bar at every breakpoint. Leaderboard, FAQ and the
// staff console moved to the side drawer; the staff console appears there
// only for staff accounts.
const links = [
  { to: '/explore', label: 'nav.explore' },
  { to: '/emergency', label: 'nav.emergency' },
  { to: '/dashboard', label: 'nav.dashboard', auth: 'citizen' }
];

export default function Navbar() {
  const { user } = useAuth();
  const { t } = useLang();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const openDrawer = () => setDrawerOpen(true);

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-night/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <img src="/logo.svg" alt="logo" className="h-9 w-9" />
          <div className="leading-tight">
            <span className="font-display text-lg font-extrabold tracking-tight text-white">
              Nagorik<span className="text-gradient">Sheba</span>
            </span>
            <span className="block text-[10px] uppercase tracking-[0.28em] text-slate-500">
              {t('brand.tag')}
            </span>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {links
            .filter((l) => !l.auth || user?.role === l.auth)
            .map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  `rounded-lg px-4 py-2 text-sm font-medium transition ${
                    isActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                  }`
                }
              >
                {t(l.label)}
              </NavLink>
            ))}
        </nav>

        <div className="flex items-center gap-2">
          <NotificationBell />
          <IdentityPill onClick={openDrawer} />
          <button
            type="button"
            onClick={openDrawer}
            aria-label={t('drawer.open')}
            aria-haspopup="dialog"
            className="rounded-lg p-2 text-slate-300 transition hover:bg-white/5 hover:text-white"
          >
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
      </div>

      <SideDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </header>
  );
}
