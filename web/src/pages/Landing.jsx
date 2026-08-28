import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { useLang } from '../lib/i18n.jsx';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.7, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] } })
};

export default function Landing() {
  const { t } = useLang();
  const [stats, setStats] = useState(null);
  const [demo, setDemo] = useState(2373);

  useEffect(() => {
    api.get('/stats').then(({ data }) => setStats(data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!stats) return;
    const timer = setInterval(() => setDemo((d) => d + Math.floor(Math.random() * 3)), 1800);
    return () => clearInterval(timer);
  }, [stats]);

  const agents = [
    { n: '01', name: t('land.a1.name'), desc: t('land.a1.desc'), icon: '🛡️' },
    { n: '02', name: t('land.a2.name'), desc: t('land.a2.desc'), icon: '🏷️' },
    { n: '03', name: t('land.a3.name'), desc: t('land.a3.desc'), icon: '♻️' },
    { n: '04', name: t('land.a4.name'), desc: t('land.a4.desc'), icon: '📈' },
    { n: '05', name: t('land.a5.name'), desc: t('land.a5.desc'), icon: '🧭' }
  ];

  const features = [
    { title: t('land.f1.title'), desc: t('land.f1.desc'), icon: '📝', to: '/submit' },
    { title: t('land.f2.title'), desc: t('land.f2.desc'), icon: '🗳️', to: '/explore' },
    { title: t('land.f3.title'), desc: t('land.f3.desc'), icon: '📊', to: '/explore' },
    { title: t('land.f4.title'), desc: t('land.f4.desc'), icon: '🚨', to: '/emergency' }
  ];

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6">
      <section className="relative flex min-h-[88vh] flex-col items-center justify-center pt-16 text-center">
        <motion.div variants={fadeUp} initial="hidden" animate="show" custom={0}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-5 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-accent">
          <span className="h-2 w-2 animate-pulse rounded-full bg-mint" /> {t('land.badge')}
        </motion.div>

        <motion.h1 variants={fadeUp} initial="hidden" animate="show" custom={1}
          className="max-w-4xl font-display text-5xl font-extrabold leading-[1.15] tracking-tight text-white sm:text-6xl md:text-7xl">
          {t('land.title.pre')}<span className="text-gradient">{t('land.title.hl')}</span>{t('land.title.post')}
        </motion.h1>

        <motion.p variants={fadeUp} initial="hidden" animate="show" custom={2}
          className="mt-6 max-w-2xl text-lg text-slate-400">
          {t('land.sub')}
        </motion.p>

        <motion.div variants={fadeUp} initial="hidden" animate="show" custom={3} className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link to="/submit" className="btn-primary text-base">{t('land.report')}</Link>
          <Link to="/explore" className="btn-ghost text-base">{t('land.explore')}</Link>
          <Link to="/emergency" className="btn-ghost text-base !border-rose-400/40 !bg-rose-500/10 text-rose-300 hover:!bg-rose-500/20">
            🚨 {t('land.emergency')}
          </Link>
        </motion.div>

        <motion.div variants={fadeUp} initial="hidden" animate="show" custom={4}
          className="glass mt-16 grid w-full max-w-3xl grid-cols-2 gap-y-8 p-8 sm:grid-cols-4">
          {[
            [t('land.stat.filed'), stats?.complaints_total ?? '—'],
            [t('land.stat.resolved'), stats?.resolved ?? '—'],
            [t('land.stat.wip'), stats?.in_process ?? '—'],
            [t('land.stat.votes'), demo.toLocaleString()]
          ].map(([label, val]) => (
            <div key={label}>
              <p className="font-display text-3xl font-extrabold text-white">{val}</p>
              <p className="mt-1 text-xs uppercase tracking-widest text-slate-500">{label}</p>
            </div>
          ))}
        </motion.div>
      </section>

      <section className="py-24">
        <motion.h2 initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center font-display text-3xl font-extrabold text-white sm:text-4xl">
          {t('land.agents.title')}
        </motion.h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-slate-400">{t('land.agents.sub')}</p>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {agents.map((a, i) => (
            <motion.div key={a.n} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} custom={i}
              className="glass group relative overflow-hidden p-6 transition hover:border-accent/50 hover:shadow-glow">
              <span className="absolute -right-3 -top-5 font-display text-7xl font-extrabold text-white/[0.04]">{a.n}</span>
              <div className="text-3xl">{a.icon}</div>
              <h3 className="mt-4 font-display text-base font-bold text-white">{a.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{a.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="pb-24">
        <div className="grid gap-5 md:grid-cols-2">
          {features.map((f, i) => (
            <motion.div key={f.title} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} custom={i}>
              <Link to={f.to} className="glass group flex h-full items-start gap-5 p-7 transition-all hover:-translate-y-1 hover:border-accent/40 hover:shadow-glow">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/25 to-accent3/25 text-2xl">
                  {f.icon}
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-white group-hover:text-gradient">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{f.desc}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      <motion.section initial={{ opacity: 0, scale: 0.96 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
        className="relative mb-4 overflow-hidden rounded-3xl border border-white/10 p-12 text-center"
        style={{ backgroundImage: 'linear-gradient(120deg, rgba(76,125,255,.18), rgba(146,87,255,.16) 50%, rgba(255,95,174,.15))' }}>
        <h2 className="font-display text-3xl font-extrabold text-white sm:text-4xl">{t('land.cta.title')}</h2>
        <p className="mx-auto mt-3 max-w-lg text-slate-300">{t('land.cta.sub')}</p>
        <div className="mt-8 flex justify-center gap-4">
          <Link to="/register" className="btn-primary">{t('land.cta.join')}</Link>
          <Link to="/explore" className="btn-ghost">{t('land.cta.browse')}</Link>
        </div>
      </motion.section>
    </main>
  );
}
