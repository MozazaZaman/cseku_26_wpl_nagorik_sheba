import { Link } from 'react-router-dom';
import { useLang } from '../lib/i18n.jsx';

export default function Footer() {
  const { t } = useLang();
  return (
    <footer className="mt-24 border-t border-white/5 py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 text-sm text-slate-500 md:flex-row">
        <div className="flex items-center gap-2.5">
          <img src="/logo.svg" className="h-7 w-7" alt="" />
          <span>
            <span className="font-semibold text-slate-300">Nagorik Sheba</span>
            {t('footer.about')}
          </span>
        </div>
        <div className="flex items-center gap-6">
          <Link to="/explore" className="hover:text-slate-300">{t('footer.explore')}</Link>
          <Link to="/emergency" className="hover:text-slate-300">{t('footer.emergency')}</Link>
          <Link to="/submit" className="hover:text-slate-300">{t('footer.report')}</Link>
        </div>
        <p>{t('footer.course')} · {new Date().getFullYear()}</p>
      </div>
    </footer>
  );
}
