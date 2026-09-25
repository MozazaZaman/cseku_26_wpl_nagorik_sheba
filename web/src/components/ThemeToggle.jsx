import { useLang } from '../lib/i18n.jsx';
import { useTheme } from '../lib/theme.jsx';

export default function ThemeToggle({ compact = false }) {
  const { t } = useLang();
  const { isDark, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      title={isDark ? t('theme.toggle') : 'Switch to dark mode'}
      aria-label={isDark ? t('theme.toggle') : 'Switch to dark mode'}
      className={`rounded-xl border border-amber/40 bg-amber/10 font-bold text-amber transition hover:bg-amber/25 ${
        compact ? 'px-2.5 py-2 text-sm' : 'px-3.5 py-2 text-xs'
      }`}
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  );
}
