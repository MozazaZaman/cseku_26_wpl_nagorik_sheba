import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, CATEGORIES } from '../lib/api';
import { useAuth } from '../store/auth.jsx';
import { useLang } from '../lib/i18n.jsx';
import ComplaintCard from '../components/ComplaintCard.jsx';

export default function Explore() {
  const { user } = useAuth();
  const { t } = useLang();
  const nav = useNavigate();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('recent');
  const [msg, setMsg] = useState(null);
  const [votedIds, setVotedIds] = useState(new Set());

  useEffect(() => {
    const timer = setTimeout(() => {
      api
        .get('/complaints', { params: { q, category: cat, status, sort } })
        .then(({ data }) => setItems(data.complaints))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [q, cat, status, sort]);

  const vote = async (c) => {
    if (!user) return nav('/login', { state: { from: '/explore' } });
    if (c.status === 'in_process') {
      return setMsg({ type: 'warn', text: t('exp.lockedMsg') });
    }
    try {
      const { data } = await api.post(`/complaints/${c.complaint_id}/vote`);
      setVotedIds((s) => new Set([...s, c.complaint_id]));
      setItems((list) => list.map((x) => (x.complaint_id === c.complaint_id ? { ...x, vote_count: data.vote_count } : x)));
      setMsg({ type: 'ok', text: data.message });
    } catch (e) {
      const d = e.response?.data;
      if (d?.redirect_complaint_id) return nav(`/complaints/${d.redirect_complaint_id}`);
      setMsg({ type: 'warn', text: d?.alert || d?.error || '…' });
    }
  };

  const statusFilters = [
    { key: 'all', label: t('exp.allActive') },
    { key: 'submitted', label: t('exp.f.submitted') },
    { key: 'verified', label: t('exp.f.sent') },
    { key: 'in_process', label: t('exp.f.wip') },
    { key: 'resolved', label: t('exp.f.resolved') }
  ];

  return (
    <main className="mx-auto max-w-7xl overflow-x-hidden px-4 pb-10 pt-6 sm:px-6 sm:pt-10">
      <h1 className="break-words font-display text-2xl font-extrabold leading-tight text-white sm:text-3xl lg:text-4xl">
        {t('exp.title')}<span className="text-gradient">{t('exp.title.hl')}</span>
      </h1>
      <p className="mt-2 max-w-3xl break-words text-sm text-slate-400 sm:text-base">{t('exp.sub')}</p>

      <div className="glass mt-6 space-y-4 p-4 sm:mt-8 sm:p-5">
        <div className="flex flex-col gap-3 md:flex-row">
          <input className="input min-w-0 flex-1" placeholder={t('exp.search')}
            value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input w-full shrink-0 md:w-48" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="recent">{t('exp.sort.newest')}</option>
            <option value="priority">{t('exp.sort.priority')}</option>
            <option value="votes">{t('exp.sort.votes')}</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          <button onClick={() => setCat('all')} className={`chip shrink-0 whitespace-nowrap text-xs sm:text-sm ${cat === 'all' ? 'chip-active' : 'chip-idle'}`}>{t('exp.all')}</button>
          {CATEGORIES.map((c) => (
            <button key={c.key} onClick={() => setCat(c.key)} className={`chip shrink-0 whitespace-nowrap text-xs sm:text-sm ${cat === c.key ? 'chip-active' : 'chip-idle'}`}>
              {c.icon} {t(`cat.${c.key}`)}
            </button>
          ))}
          <span className="mx-2 hidden w-px self-stretch bg-white/10 sm:block" />
          {statusFilters.map((s) => (
            <button key={s.key} onClick={() => setStatus(s.key)} className={`chip shrink-0 whitespace-nowrap text-xs sm:text-sm ${status === s.key ? 'chip-active' : 'chip-idle'}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {msg && (
        <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
          msg.type === 'ok'
            ? 'border-mint/30 bg-mint/10 text-mint'
            : 'border-amber-400/30 bg-amber-500/10 text-amber-300'
        }`}>
          {msg.text}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:mt-8 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((c, i) => (
          <ComplaintCard
            key={c.complaint_id}
            c={c}
            index={i}
            onVote={vote}
            voted={votedIds.has(c.complaint_id) || c.voted_by_me || c.is_mine}
            locked={c.status === 'in_process'}
          />
        ))}
      </div>
      {items.length === 0 && (
        <p className="mt-16 text-center text-slate-500">{t('exp.none')}</p>
      )}
    </main>
  );
}
