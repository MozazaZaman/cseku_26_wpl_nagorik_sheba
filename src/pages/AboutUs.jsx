import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useLang } from '../lib/i18n.jsx';

// Static informational page. Names, emails and the repo URL are
// language-neutral data, so they live here; all prose is i18n'd.

const STEPS = [
  { titleKey: 'about.how.step1.title', descKey: 'about.how.step1.desc' },
  { titleKey: 'about.how.step2.title', descKey: 'about.how.step2.desc' },
  { titleKey: 'about.how.step3.title', descKey: 'about.how.step3.desc' },
  { titleKey: 'about.how.step4.title', descKey: 'about.how.step4.desc' }
];

const TEAM = [
  { nameKey: 'about.team.m1.name' },
  { nameKey: 'about.team.m2.name' }
];

const CONTACTS = [
  { icon: '✉️', href: 'mailto:mozazaalzaman@gmail.com', label: 'mozazaalzaman@gmail.com' },
  { icon: '✉️', href: 'mailto:riantoufik897@gmail.com', label: 'riantoufik897@gmail.com' },
  { icon: '⌨️', href: 'https://github.com/MozazaZaman/WPL_Project', labelKey: 'about.contact.github', external: true }
];

function Section({ icon, title, children }) {
  return (
    <section className="glass-strong p-6 sm:p-7">
      <h2 className="flex items-center gap-2.5 font-display text-lg font-bold text-white">
        <span aria-hidden="true">{icon}</span>
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-400">
        {children}
      </div>
    </section>
  );
}

export default function AboutUs() {
  const { t } = useLang();

  return (
    <main className="mx-auto max-w-3xl px-4 pb-10 pt-10 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-3xl font-extrabold text-white sm:text-4xl">
          {t('about.title')} <span className="text-gradient">{t('about.titleHl')}</span>
        </h1>
        <p className="mt-2 text-slate-400">{t('about.sub')}</p>
      </motion.div>

      <div className="mt-8 space-y-6">
        <Section icon="🎯" title={t('about.mission')}>
          <p>{t('about.mission.body1')}</p>
          <p>{t('about.mission.body2')}</p>
        </Section>

        <Section icon="🧩" title={t('about.problem')}>
          <p>{t('about.problem.body1')}</p>
          <p>{t('about.problem.body2')}</p>
        </Section>

        <Section icon="⚙️" title={t('about.how')}>
          <ol className="space-y-4">
            {STEPS.map((step, index) => (
              <li key={step.titleKey} className="flex gap-3.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-bold text-accent">
                  {index + 1}
                </span>
                <span>
                  <span className="font-semibold text-white">{t(step.titleKey)}</span>
                  <span> — {t(step.descKey)}</span>
                </span>
              </li>
            ))}
          </ol>
          <p>
            {t('about.how.faqNote')}{' '}
            <Link to="/faq" className="font-semibold text-accent hover:underline">
              {t('about.how.faqLink')}
            </Link>
          </p>
        </Section>

        <Section icon="👥" title={t('about.team')}>
          <p>{t('about.team.body')}</p>
          <ul className="space-y-1.5">
            {TEAM.map((member) => (
              <li key={member.nameKey}>
                <span className="font-semibold text-white">{t(member.nameKey)}</span>
              </li>
            ))}
          </ul>
          <p>
            {t('about.team.instructor')}{' '}
            <span className="font-semibold text-white">{t('about.team.instructor.name')}</span>,{' '}
            {t('about.team.instructor.affil')}
          </p>
          <p>{t('about.team.closing')}</p>
        </Section>

        <Section icon="🗺️" title={t('about.coverage')}>
          <p>{t('about.coverage.body1')}</p>
          <p>{t('about.coverage.body2')}</p>
        </Section>

        <Section icon="🎓" title={t('about.note')}>
          <p>{t('about.note.body1')}</p>
        </Section>

        <Section icon="📧" title={t('about.contact')}>
          <p>{t('about.contact.body')}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            {CONTACTS.map((contact) => (
              <a
                key={contact.label || contact.labelKey}
                href={contact.href}
                {...(contact.external ? { target: '_blank', rel: 'noreferrer' } : {})}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white"
              >
                <span aria-hidden="true">{contact.icon}</span>
                {contact.label || t(contact.labelKey)}
              </a>
            ))}
          </div>
        </Section>
      </div>
    </main>
  );
}
