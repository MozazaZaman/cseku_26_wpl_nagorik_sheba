import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth.jsx';
import { useLang, fullRoleTitle } from '../lib/i18n.jsx';
import ThemeToggle from './ThemeToggle.jsx';

// Primary destinations. These stay inline in the top bar at lg+, so this
// section is mobile-only — it just keeps them reachable below the lg
// breakpoint where the navbar links are hidden.
const MOBILE_LINKS = [
  { to: '/explore', label: 'nav.explore' },
  { to: '/emergency', label: 'nav.emergency' },
  { to: '/dashboard', label: 'nav.dashboard', auth: 'citizen' }
];

// Staff console was removed from the top bar to keep it uncluttered; staff
// reach it here instead. Shown at every breakpoint for staff accounts.
const STAFF_LINKS = [
  { to: '/staff', label: 'nav.staff' }
];

const MORE_LINKS = [
  { to: '/leaderboard', label: 'nav.leaderboard' },
  { to: '/faq', label: 'nav.faq' },
  { to: '/about', label: 'nav.about' }
];

function initialsOf(name) {
  return (name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export default function SideDrawer({ open, onClose }) {
  const { user, logout } = useAuth();
  const { t, toggle, lang } = useLang();
  const nav = useNavigate();

  const canSee = (l) => !l.auth || user?.role === l.auth;

  // Close on Escape and lock body scroll while open.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const go = (path) => {
    onClose();
    nav(path);
  };

  const linkClass = 'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white';

  return createPortal(
    <AnimatePresence>
      {open && (
        // Rendered through a portal: the drawer lives inside <header>, whose
        // backdrop-blur creates a containing block that would otherwise trap
        // the fixed overlay to the header strip instead of the viewport.
        <div className="fixed inset-0 z-[60]">
          <motion.button
            type="button"
            aria-label={t('drawer.close')}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />

          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={t('drawer.title')}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.24, ease: 'easeOut' }}
            className="absolute right-0 top-0 flex h-full w-[min(82vw,20rem)] flex-col border-l border-white/10 bg-night/95 shadow-2xl shadow-black/50 backdrop-blur-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-4">
              <div className="flex items-center gap-2.5">
                <img src="/logo.svg" alt="logo" className="h-8 w-8" />
                <span className="font-display text-base font-extrabold tracking-tight text-white">
                  Nagorik<span className="text-gradient">Sheba</span>
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t('drawer.close')}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/5 hover:text-white"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-4">
              {user ? (
                <div className="mb-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent3 text-base font-bold text-white">
                    {initialsOf(user.name) || '?'}
                  </span>
                  <div className="min-w-0 leading-tight">
                    <p className="truncate font-semibold text-white">{user.name}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{fullRoleTitle(user, t)}</p>
                  </div>
                </div>
              ) : (
                <div className="mb-4 flex gap-2">
                  <button type="button" onClick={() => go('/login')} className="btn-ghost flex-1">{t('nav.login')}</button>
                  <button type="button" onClick={() => go('/register')} className="btn-primary flex-1">{t('nav.join')}</button>
                </div>
              )}

              {/* Primary navigation — hidden at lg+ where the top bar shows it */}
              <div className="lg:hidden">
                <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">{t('drawer.navigate')}</p>
                {MOBILE_LINKS.filter(canSee).map((l) => (
                  <button key={l.to} type="button" onClick={() => go(l.to)} className={linkClass}>
                    {t(l.label)}
                  </button>
                ))}
              </div>

              {user?.role === 'staff' && (
                <div className="mt-4">
                  {STAFF_LINKS.map((l) => (
                    <button key={l.to} type="button" onClick={() => go(l.to)} className={linkClass}>
                      {t(l.label)}
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-4">
                <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">{t('drawer.more')}</p>
                {MORE_LINKS.map((l) => (
                  <button key={l.to} type="button" onClick={() => go(l.to)} className={linkClass}>
                    {t(l.label)}
                  </button>
                ))}
              </div>

              <div className="mt-4">
                <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">{t('drawer.preferences')}</p>
                <div className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5">
                  <span className="text-sm font-medium text-slate-300">{t('drawer.theme')}</span>
                  <ThemeToggle compact />
                </div>
                <button
                  type="button"
                  onClick={toggle}
                  className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
                >
                  <span>{t('drawer.language')}</span>
                  <span className="rounded-lg border border-accent2/40 bg-accent2/10 px-3 py-1.5 text-xs font-bold text-accent2">
                    🌐 {lang === 'en' ? 'বাংলা' : 'English'}
                  </span>
                </button>
              </div>
            </div>

            {user && (
              <div className="border-t border-white/10 px-4 py-4">
                <button
                  type="button"
                  onClick={() => { logout(); onClose(); nav('/'); }}
                  className="btn-ghost w-full !text-rose-300 hover:!bg-rose-500/10"
                >
                  {t('nav.logout')}
                </button>
              </div>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
