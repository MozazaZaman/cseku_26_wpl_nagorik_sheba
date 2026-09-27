import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLang } from '../lib/i18n.jsx';
import { TIER_STYLE, BADGE_META, MILESTONE_TYPES, badgeMeta, isMilestone, badgeLabel } from '../lib/badges.js';
import { fmtDate } from '../lib/api.js';

/**
 * Civic achievement badge display.
 *
 * Badges are positive-only — there are no "worst performer" lists, and a
 * staff member with no badges shows a neutral, encouraging empty state.
 * Rolling badges show the window they cover; lifetime milestones show the
 * date earned. Click/hover reveals the criteria each badge represents.
 *
 * The criteria popover is portaled into <body> and positioned with `fixed`.
 * Badge strips live inside `.glass` cards (backdrop-filter) and motion cards
 * (transform); each of those forms its own stacking context, so an in-place
 * absolute popover would be painted behind the following roster card no
 * matter how high its z-index is.
 *
 * Props:
 *   badges       — [{ badge_type, tier, awarded_at, period_start, period_end }]
 *   recognitions — [{ note, awarded_at, awarded_by_name }]  (Mayor's Commendation)
 *   compact      — render as a single-line strip (used in the console header)
 */
export default function AchievementBadges({ badges = [], recognitions = [], compact = false }) {
  const { t } = useLang();
  const [openKey, setOpenKey] = useState(null);
  const [pos, setPos] = useState(null);
  const anchorRef = useRef(null);
  const tipRef = useRef(null);

  const show = (key, el) => {
    anchorRef.current = el;
    setPos(null);
    setOpenKey(key);
  };

  const close = () => setOpenKey(null);

  // Once mounted, clamp the popover so it never runs off the viewport, and
  // flip it above the badge when there is no room below.
  useLayoutEffect(() => {
    if (!openKey || !tipRef.current || !anchorRef.current) return;
    const tip = tipRef.current.getBoundingClientRect();
    const anchor = anchorRef.current.getBoundingClientRect();
    const pad = 8;
    const left = Math.max(pad, Math.min(anchor.left, window.innerWidth - tip.width - pad));
    let top = anchor.bottom + 6;
    if (top + tip.height + pad > window.innerHeight) top = Math.max(pad, anchor.top - tip.height - 6);
    setPos({ left, top });
  }, [openKey]);

  // A detached popover no longer tracks its badge — close it when the page
  // scrolls or resizes, and when the click lands somewhere else.
  useEffect(() => {
    if (!openKey) return;
    const onMove = () => close();
    const onClick = (e) => {
      if (tipRef.current?.contains(e.target)) return;
      if (anchorRef.current?.contains(e.target)) return;
      close();
    };
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
      document.removeEventListener('click', onClick);
    };
  }, [openKey]);

  if ((!badges || badges.length === 0) && (!recognitions || recognitions.length === 0)) {
    return (
      <div className="rounded-xl border border-dashed border-white/15 px-4 py-3 text-sm text-slate-400">
        <span className="mr-1.5">🏅</span>{t('badge.empty')}
      </div>
    );
  }

  // order: rolling tiered first (by tier weight), then specialists, then milestones
  const tierWeight = { gold: 0, silver: 1, bronze: 2 };
  const sorted = [...badges].sort((a, b) => {
    const am = isMilestone(a.badge_type), bm = isMilestone(b.badge_type);
    if (am !== bm) return am ? 1 : -1;
    if (a.tier && b.tier && tierWeight[a.tier] !== tierWeight[b.tier]) return tierWeight[a.tier] - tierWeight[b.tier];
    return a.badge_type.localeCompare(b.badge_type);
  });

  const initialPos = () => {
    const r = anchorRef.current?.getBoundingClientRect();
    return r ? { left: r.left, top: r.bottom + 6 } : { left: 0, top: 0 };
  };

  return (
    <div className={compact ? 'flex flex-wrap gap-2' : 'space-y-3'}>
      {sorted.map((b) => {
        const meta = badgeMeta(b.badge_type);
        const tierStyle = b.tier ? TIER_STYLE[b.tier] : null;
        const label = badgeLabel(b.badge_type, b.tier, t);
        const key = `${b.badge_type}-${b.awarded_at}`;
        const isOpen = openKey === key;
        const where = pos || initialPos();
        const periodTxt = b.period_end
          ? `${fmtDate(b.period_start)} – ${fmtDate(b.period_end)}`
          : `${t('badge.earnedOn')} ${fmtDate(b.awarded_at)}`;
        return (
          <div key={key} className="relative">
            <button
              type="button"
              onClick={(e) => (isOpen ? close() : show(key, e.currentTarget))}
              onMouseEnter={(e) => show(key, e.currentTarget)}
              onMouseLeave={close}
              className={`group flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold
                transition hover:scale-[1.02] ${tierStyle
                  ? `border-white/10 bg-white/5 ${tierStyle.text} ring-1 ${tierStyle.ring} shadow ${tierStyle.glow}`
                  : 'border-white/10 bg-white/5 text-slate-100 ring-1 ring-white/10'}`}
              title={`${label} — ${t(meta.desc)}`}
            >
              <span className="text-sm">{meta.icon}</span>
              <span>{label}</span>
              {b.tier ? <span className="opacity-60">· {t(TIER_STYLE[b.tier].label)}</span> : null}
            </button>
            {isOpen &&
              createPortal(
                <div
                  ref={tipRef}
                  style={{ position: 'fixed', left: where.left, top: where.top, zIndex: 9999 }}
                  className="w-60 rounded-xl border border-white/10 bg-slate-900/95 p-3 text-xs shadow-2xl backdrop-blur dark:bg-slate-950/95"
                >
                  <div className="mb-1 flex items-center gap-1.5 font-bold text-slate-100">
                    <span className="text-sm">{meta.icon}</span>{label}
                  </div>
                  <p className="leading-relaxed text-slate-300">{t(meta.desc)}</p>
                  <p className="mt-1.5 text-slate-400">{periodTxt}</p>
                  {b.tier ? (
                    <p className="mt-0.5 font-semibold" style={{ color: 'currentColor' }}>
                      {t(TIER_STYLE[b.tier].label)} {t('badge.tier')}
                    </p>
                  ) : null}
                </div>,
                document.body
              )}
          </div>
        );
      })}

      {recognitions.map((r, i) => (
        <div
          key={`rec-${i}`}
          className="flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-400/5 px-3 py-2 text-xs"
        >
          <span className="text-base">🏛️</span>
          <div>
            <p className="font-semibold text-amber-200">{t('badge.commendation')}</p>
            <p className="mt-0.5 leading-relaxed text-slate-300">“{r.note}”</p>
            <p className="mt-1 text-slate-400">
              {r.awarded_by_name} · {fmtDate(r.awarded_at)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
