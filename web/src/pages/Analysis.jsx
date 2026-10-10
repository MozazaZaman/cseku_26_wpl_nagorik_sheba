import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { api, CATEGORIES } from '../lib/api';
import { useAuth } from '../store/auth.jsx';
import { useLang, categoryLabel } from '../lib/i18n.jsx';

const CAT_COLORS = {
  road: '#5b8cff', electricity: '#fbbf24', water: '#38bdf8', gas: '#fb7185',
  sanitation: '#2dd4bf', encroachment: '#f97316', environment: '#4ade80',
  public_assets: '#a78bfa', animals: '#f472b6', markets: '#facc15', drugs: '#e879f9',
  other: '#94a3b8'
};

const fadeUp = {
  hidden: { opacity: 0, y: 26 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] } })
};

// Animated number that counts up on change (cinematic stat readouts).
function CountUp({ value, suffix = '' }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const from = shown;
    const start = performance.now();
    const dur = 700;
    let raf;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(from + (value - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const display = Number.isInteger(value) ? Math.round(shown).toLocaleString() : shown.toFixed(1);
  return <span>{display}{suffix}</span>;
}

// Grouped monthly bars: reported (gradient) vs solved (mint glow).
function MonthBars({ months, reported, solved, color }) {
  const W = 720, H = 250, PAD_L = 36, PAD_B = 30, PAD_T = 16;
  const maxV = Math.max(1, ...reported, ...solved);
  const n = months.length;
  const gw = (W - PAD_L - 8) / n;
  const bw = Math.min(22, (gw - 14) / 2);
  const y = (v) => PAD_T + (H - PAD_T - PAD_B) * (1 - v / maxV);
  const h = (v) => (H - PAD_T - PAD_B) * (v / maxV);
  const gid = `g-${color.replace('#', '')}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor={color} stopOpacity="0.25" />
        </linearGradient>
        <linearGradient id={`${gid}-s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0.25" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line x1={PAD_L} x2={W - 4} y1={y(maxV * f)} y2={y(maxV * f)} stroke="rgba(148,163,184,0.15)" strokeDasharray="3 4" />
          <text x={PAD_L - 6} y={y(maxV * f) + 4} textAnchor="end" fontSize="10" fill="rgba(148,163,184,0.7)">
            {Math.round(maxV * f)}
          </text>
        </g>
      ))}
      {months.map((m, i) => {
        const cx = PAD_L + gw * i + gw / 2;
        return (
          <g key={m.key}>
            <rect x={cx - bw - 3} y={y(reported[i])} width={bw} height={Math.max(2, h(reported[i]))} rx="4" fill={`url(#${gid})`}>
              <title>{`${m.label}: ${reported[i]} reported`}</title>
            </rect>
            <rect x={cx + 3} y={y(solved[i])} width={bw} height={Math.max(2, h(solved[i]))} rx="4" fill={`url(#${gid}-s)`}>
              <title>{`${m.label}: ${solved[i]} solved`}</title>
            </rect>
            {(i % Math.ceil(n / 6) === 0 || i === n - 1) && (
              <text x={cx} y={H - 8} textAnchor="middle" fontSize="10" fill="rgba(148,163,184,0.8)">{m.label}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// Horizontal comparison bars: resolution rate per category.
function RateBars({ categories, t }) {
  const max = 100;
  const sorted = [...categories].sort((a, b) => b.resolution_rate - a.resolution_rate);
  return (
    <div className="space-y-3">
      {sorted.map((c, i) => (
        <motion.div key={c.key} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} custom={Math.min(i, 6)}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-semibold text-white">
              {(CATEGORIES.find((x) => x.key === c.key) || {}).icon || '📌'} {categoryLabel(c.key, t)}
            </span>
            <span className="shrink-0 font-display font-extrabold" style={{ color: CAT_COLORS[c.key] || '#94a3b8' }}>
              {c.resolution_rate}%
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/5">
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${(c.resolution_rate / max) * 100}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${CAT_COLORS[c.key] || '#94a3b8'}55, ${CAT_COLORS[c.key] || '#94a3b8'})`, boxShadow: `0 0 12px ${CAT_COLORS[c.key] || '#94a3b8'}66` }}
            />
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {c.total_reported} {t('analysis.reported')} · {c.total_solved} {t('analysis.solved')}
          </p>
        </motion.div>
      ))}
    </div>
  );
}

export default function Analysis() {
  const { user } = useAuth();
  const { t } = useLang();
  const isStaff = user?.role === 'staff';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState('road');
  // Staff: mine (own LGI) | overall | custom. Citizens: overall (+ optional custom).
  const [scope, setScope] = useState(isStaff ? 'mine' : 'overall');
  const [division, setDivision] = useState('');
  const [district, setDistrict] = useState('');
  const [geo, setGeo] = useState({ divisions: [] });

  useEffect(() => {
    api.get('/geo').then(({ data: g }) => setGeo(g)).catch(() => {});
  }, []);

  const params = useMemo(() => {
    const p = { months: 12 };
    if (scope === 'mine' && user?.authority_id) p.authority_id = user.authority_id;
    if (scope === 'custom') {
      if (division) p.division = division;
      if (district) p.district = district;
    }
    return p;
  }, [scope, division, district, user]);

  useEffect(() => {
    setLoading(true);
    api.get('/analytics/category-trends', { params })
      .then(({ data: d }) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [params]);

  const districts = useMemo(() => {
    if (!division) return [];
    const d = (geo.divisions || []).find((x) => x.name === division);
    return d ? d.districts || [] : [];
  }, [geo, division]);

  const active = (data?.categories || []).find((c) => c.key === cat) || data?.categories?.[0];
  const scopeLabel = data?.scope?.overall
    ? t('analysis.scope.overall')
    : data?.scope?.authority_id
      ? (user?.authority_name || t('analysis.scope.mine'))
      : [data?.scope?.division, data?.scope?.district].filter(Boolean).join(' · ') || t('analysis.scope.overall');

  return (
    <main className="mx-auto max-w-7xl px-4 pb-10 pt-10 sm:px-6">
      <motion.div variants={fadeUp} initial="hidden" animate="show" custom={0}>
        <h1 className="font-display text-3xl font-extrabold text-white sm:text-4xl">
          {t('analysis.title')}<span className="text-gradient">{t('analysis.title.hl')}</span>
        </h1>
        <p className="mt-2 max-w-3xl text-slate-400">{t('analysis.sub')}</p>
      </motion.div>

      {/* Scope switch */}
      <motion.div variants={fadeUp} initial="hidden" animate="show" custom={1}
        className="glass mt-6 flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center">
        <div className="flex flex-wrap gap-2">
          {isStaff && (
            <button onClick={() => setScope('mine')}
              className={`chip ${scope === 'mine' ? 'chip-active' : 'chip-idle'}`}>
              🏛️ {user?.authority_name || t('analysis.scope.mine')}
            </button>
          )}
          <button onClick={() => setScope('overall')}
            className={`chip ${scope === 'overall' ? 'chip-active' : 'chip-idle'}`}>
            🇧🇩 {t('analysis.scope.overall')}
          </button>
          <button onClick={() => setScope('custom')}
            className={`chip ${scope === 'custom' ? 'chip-active' : 'chip-idle'}`}>
            📍 {t('analysis.scope.custom')}
          </button>
        </div>
        {scope === 'custom' && (
          <div className="grid flex-1 gap-3 sm:grid-cols-2">
            <select className="input" value={division}
              onChange={(e) => { setDivision(e.target.value); setDistrict(''); }}>
              <option value="">{t('analysis.allDivisions')}</option>
              {(geo.divisions || []).map((d) => (
                <option key={d.name} value={d.name}>{d.name}</option>
              ))}
            </select>
            <select className="input" value={district} disabled={!division}
              onChange={(e) => setDistrict(e.target.value)}>
              <option value="">{t('analysis.allDistricts')}</option>
              {districts.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        )}
      </motion.div>

      {loading && (
        <div className="glass mt-6 animate-pulse p-10 text-center text-slate-400">{t('analysis.loading')}</div>
      )}

      {data && (
        <>
          {/* Headline counters */}
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              [t('analysis.totalReported'), data.categories.reduce((a, c) => a + c.total_reported, 0), '#5b8cff'],
              [t('analysis.totalSolved'), data.categories.reduce((a, c) => a + c.total_solved, 0), '#2dd4bf'],
              [t('analysis.overallRate'),
                (() => { const r = data.categories.reduce((a, c) => a + c.total_reported, 0); const s = data.categories.reduce((a, c) => a + c.total_solved, 0); return r ? Math.round((s / r) * 1000) / 10 : 0; })(),
                '#fbbf24', '%'],
              [t('analysis.scopeLabel'), null, '#a78bfa'],
            ].map(([label, val, color, suffix], i) => (
              <motion.div key={label} variants={fadeUp} initial="hidden" animate="show" custom={i + 2}
                className="glass p-5">
                <p className="font-display text-3xl font-extrabold" style={{ color, textShadow: `0 0 24px ${color}55` }}>
                  {val == null ? <span className="text-lg">{scopeLabel}</span> : <CountUp value={val} suffix={suffix || ''} />}
                </p>
                <p className="mt-1 text-xs uppercase tracking-widest text-slate-500">{label}</p>
              </motion.div>
            ))}
          </div>

          {/* Category picker */}
          <motion.div variants={fadeUp} initial="hidden" animate="show" custom={3} className="mt-8">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-accent">{t('analysis.pickCategory')}</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.filter((c) => c.key !== 'other').map((c) => (
                <button key={c.key} onClick={() => setCat(c.key)}
                  className={`chip ${cat === c.key ? 'chip-active' : 'chip-idle'}`}>
                  {c.icon} {categoryLabel(c.key, t)}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Monthly trend for the picked category */}
          {active && (
            <motion.div variants={fadeUp} initial="hidden" animate="show" custom={4}
              className="glass mt-6 overflow-hidden p-5 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-extrabold text-white">
                    {(CATEGORIES.find((x) => x.key === active.key) || {}).icon || '📌'} {categoryLabel(active.key, t)}
                    <span className="text-gradient"> · {t('analysis.monthly')}</span>
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">{scopeLabel}</p>
                </div>
                <div className="flex items-center gap-4 text-xs font-semibold">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: CAT_COLORS[active.key] || '#94a3b8' }} />
                    <span className="text-slate-300">{t('analysis.reported')}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-mint" />
                    <span className="text-slate-300">{t('analysis.solved')}</span>
                  </span>
                </div>
              </div>
              <div className="mt-5">
                <MonthBars months={data.months} reported={active.reported} solved={active.solved}
                  color={CAT_COLORS[active.key] || '#94a3b8'} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                {[
                  [t('analysis.reported'), active.total_reported, CAT_COLORS[active.key] || '#94a3b8'],
                  [t('analysis.solved'), active.total_solved, '#2dd4bf'],
                  [t('analysis.rate'), active.resolution_rate, '#fbbf24'],
                ].map(([label, v, color]) => (
                  <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="font-display text-2xl font-extrabold" style={{ color }}>
                      <CountUp value={v} suffix={label === t('analysis.rate') ? '%' : ''} />
                    </p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-widest text-slate-500">{label}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Cross-category comparison */}
          <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} custom={5}
            className="glass mt-6 p-5 sm:p-7">
            <h2 className="font-display text-xl font-extrabold text-white">
              {t('analysis.compare.title')}<span className="text-gradient">{t('analysis.compare.hl')}</span>
            </h2>
            <p className="mt-1 text-xs text-slate-500">{t('analysis.compare.sub')} · {scopeLabel}</p>
            <div className="mt-5">
              <RateBars categories={data.categories} t={t} />
            </div>
          </motion.div>

          {/* Hottest place per category */}
          <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} custom={6}
            className="mt-6">
            <h2 className="font-display text-xl font-extrabold text-white">
              {t('analysis.top.title')}<span className="text-gradient">{t('analysis.top.hl')}</span>
            </h2>
            <p className="mt-1 text-xs text-slate-500">{t('analysis.top.sub')}</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(data.top_places || []).filter((p) => p.count > 0).map((p, i) => (
                <motion.div key={p.category} variants={fadeUp} initial="hidden" whileInView="show"
                  viewport={{ once: true }} custom={Math.min(i, 5)}
                  className="glass group p-5 transition hover:border-accent/40 hover:shadow-glow">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
                      style={{ background: `${CAT_COLORS[p.category] || '#94a3b8'}22` }}>
                      {(CATEGORIES.find((x) => x.key === p.category) || {}).icon || '📌'}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-display font-bold text-white">{categoryLabel(p.category, t)}</p>
                      <p className="truncate text-xs text-slate-500">{p.district}{p.division ? ` · ${p.division}` : ''}</p>
                    </div>
                    <span className="ml-auto shrink-0 font-display text-2xl font-extrabold"
                      style={{ color: CAT_COLORS[p.category] || '#94a3b8', textShadow: `0 0 18px ${CAT_COLORS[p.category] || '#94a3b8'}55` }}>
                      {p.count}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] uppercase tracking-widest text-slate-500">{t('analysis.top.reports')}</p>
                </motion.div>
              ))}
              {(data.top_places || []).filter((p) => p.count > 0).length === 0 && (
                <p className="glass p-6 text-center text-slate-500 sm:col-span-2 lg:col-span-3">{t('analysis.top.none')}</p>
              )}
            </div>
          </motion.div>
        </>
      )}
    </main>
  );
}
