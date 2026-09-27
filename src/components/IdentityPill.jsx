import { useAuth } from '../store/auth.jsx';
import { useLang, roleLabel } from '../lib/i18n.jsx';

// Compact single-line identity: "{FirstName} · {Role}". The full name and
// full role title live in the side drawer; this is just the glanceable pill.
// Clicking it opens the drawer (same as the hamburger).
export default function IdentityPill({ onClick }) {
  const { user } = useAuth();
  const { t } = useLang();
  if (!user) return null;

  const firstName = (user.name || '').trim().split(/\s+/)[0] || user.name || '';
  const initials = (user.name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${user.name} · ${roleLabel(user, t)}`}
      aria-haspopup="dialog"
      className="flex max-w-[14rem] items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1.5 pl-1.5 pr-3 transition hover:bg-white/10"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent3 text-xs font-bold text-white">
        {initials || '?'}
      </span>
      <span className="truncate whitespace-nowrap text-xs font-semibold text-white">
        {firstName} <span className="text-slate-400">·</span> {roleLabel(user, t)}
      </span>
    </button>
  );
}
