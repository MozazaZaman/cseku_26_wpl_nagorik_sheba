import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLang } from '../lib/i18n.jsx';
import faqData from '../data/faqData.js';

export default function FAQ() {
  const { t, lang } = useLang();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState({});

  const needle = query.trim().toLowerCase();

  // Case-insensitive substring match on the question in the ACTIVE language.
  const matches = useMemo(
    () => (needle ? faqData.filter((f) => f.question[lang].toLowerCase().includes(needle)) : faqData),
    [needle, lang]
  );

  // Group by category, preserving the order categories first appear in faqData.
  // Group on the stable English key so both languages produce the same sections.
  const sections = useMemo(() => {
    const order = [];
    const byCategory = new Map();
    for (const item of matches) {
      const key = item.category.en;
      if (!byCategory.has(key)) {
        byCategory.set(key, []);
        order.push(key);
      }
      byCategory.get(key).push(item);
    }
    return order.map((key) => ({ category: byCategory.get(key)[0].category, items: byCategory.get(key) }));
  }, [matches]);

  const toggle = (id) => setOpen((current) => ({ ...current, [id]: !current[id] }));

  return (
    <main className="mx-auto max-w-3xl px-4 pb-10 pt-10 sm:px-6">
      <h1 className="font-display text-3xl font-extrabold text-white sm:text-4xl">
        {t('faq.title')} <span className="text-gradient">{t('faq.titleHl')}</span>
      </h1>
      <p className="mt-2 text-slate-400">{t('faq.sub')}</p>

      <div className="relative mt-6">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true">🔎</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('faq.search.ph')}
          aria-label={t('faq.search.ph')}
          className="input !pl-11"
        />
      </div>

      {needle && (
        <p className="mt-3 text-sm text-slate-500">
          {matches.length === 0
            ? t('faq.noResults')
            : `${matches.length} ${matches.length === 1 ? t('faq.result') : t('faq.results')} “${query.trim()}”`}
        </p>
      )}

      {sections.length === 0 ? (
        <div className="glass mt-8 p-10 text-center text-slate-400">{t('faq.noResults')}</div>
      ) : (
        <div className="mt-8 space-y-10">
          {sections.map((section) => (
            <section key={section.category.en}>
              <div className="mb-3 flex items-center gap-3">
                <h2 className="font-display text-lg font-bold text-white">
                  {section.category[lang]}
                </h2>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-bold text-slate-400">
                  {section.items.length}
                </span>
              </div>

              <div className="glass-strong overflow-hidden">
                {section.items.map((item, index) => {
                  const isOpen = !!open[item.id];
                  return (
                    <div key={item.id} className={index > 0 ? 'border-t border-white/5' : ''}>
                      <button
                        type="button"
                        onClick={() => toggle(item.id)}
                        aria-expanded={isOpen}
                        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/5"
                      >
                        <span
                          className={`shrink-0 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
                          aria-hidden="true"
                        >
                          ▸
                        </span>
                        <span className="flex-1 font-medium text-white">{item.question[lang]}</span>
                      </button>

                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22, ease: 'easeOut' }}
                            className="overflow-hidden"
                          >
                            <p className="whitespace-pre-line pl-11 pr-4 pb-4 text-sm leading-relaxed text-slate-400">
                              {item.answer[lang]}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
