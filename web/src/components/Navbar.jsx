import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth.jsx';
import { useLang } from '../lib/i18n.jsx';

const links = [
  { to: '/explore', label: 'nav.explore' },
  { to: '/emergency', label: 'nav.emergency' },
  { to: '/dashboard', label: 'nav.dashboard', auth: 'citizen' },
  { to: '/staff', label: 'nav.staff', auth: 'staff' }
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const { t, toggle, lang } = useLang();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

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

        <div className="hidden items-center gap-3 lg:flex">
          <button
            onClick={toggle}
            title={lang === 'en' ? 'সম্পূর্ণ অ্যাপ বাংলায় দেখুন' : 'View the whole app in English'}
            className="rounded-xl border border-accent2/40 bg-accent2/10 px-3.5 py-2 text-xs font-bold text-accent2 transition hover:bg-accent2/25"
          >
            🌐 {t('lang.toggle')}
          </button>
          {user ? (
            <>
              <div className="text-right leading-tight">
                <p className="text-sm font-semibold text-white">{user.name}</p>
                <p className="text-[11px] uppercase tracking-wider text-slate-500">
                  {user.role === 'staff' ? t('nav.staffRole') : t('nav.citizen')}
                </p>
              </div>
              <button
                onClick={() => {
                  logout();
                  nav('/');
                }}
                className="btn-ghost !px-4 !py-2 text-sm"
              >
                {t('nav.logout')}
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-ghost !px-4 !py-2 text-sm">{t('nav.login')}</Link>
              <Link to="/register" className="btn-primary !px-4 !py-2 text-sm">{t('nav.join')}</Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <button
            onClick={toggle}
            className="rounded-xl border border-accent2/40 bg-accent2/10 px-3 py-2 text-xs font-bold text-accent2"
          >
            🌐 {lang === 'en' ? 'বাংলা' : 'EN'}
          </button>
          <button onClick={() => setOpen(!open)} className="rounded-lg p-2 text-slate-300" aria-label="menu">
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-white/5 px-4 pb-4 lg:hidden">
          {links
            .filter((l) => !l.auth || user?.role === l.auth)
            .map((l) => (
              <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-white/5">
                {t(l.label)}
              </Link>
            ))}
          {user ? (
            <button onClick={() => { logout(); nav('/'); setOpen(false); }} className="btn-ghost mt-2 w-full">{t('nav.logout')}</button>
          ) : (
            <div className="mt-2 flex gap-2">
              <Link to="/login" onClick={() => setOpen(false)} className="btn-ghost flex-1 text-center">{t('nav.login')}</Link>
              <Link to="/register" onClick={() => setOpen(false)} className="btn-primary flex-1 text-center">{t('nav.join')}</Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
