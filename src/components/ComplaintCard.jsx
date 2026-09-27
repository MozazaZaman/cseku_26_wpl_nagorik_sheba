import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { StatusBadge, CategoryChip } from './Badges.jsx';
import { useLang } from '../lib/i18n.jsx';

export default function ComplaintCard({ c, index = 0, onVote, voted, locked }) {
  const { t } = useLang();
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.06, 0.4) }}
    >
      <Link to={`/complaints/${c.complaint_id}`} className="group block">
        <div className="glass flex h-full min-w-0 flex-col p-4 sm:p-5 transition-all duration-300 group-hover:-translate-y-1 group-hover:border-accent/40 group-hover:shadow-glow">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <CategoryChip category={c.category} />
            <StatusBadge status={c.status} />
          </div>
          <h3 className="break-words font-display text-sm font-bold leading-snug text-white transition group-hover:text-gradient sm:text-[15px]">
            {c.title}
          </h3>
          <p className="mt-2 line-clamp-2 break-words text-sm text-slate-400">{c.description}</p>
          <p className="mt-3 break-words text-xs text-slate-500">
            <span className="line-clamp-1 block truncate">{c.full_address || c.address_text || `${c.latitude?.toFixed(4)}, ${c.longitude?.toFixed(4)}`}</span>
            {c.authority_name && !c.full_address ? <span className="text-[11px]"> · {c.authority_name}</span> : null}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3">
            <span className="min-w-0 break-words text-xs text-slate-500">{t('exp.by')} {c.submitter_name}</span>
            {onVote ? (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  onVote(c);
                }}
                disabled={voted || locked}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  voted
                    ? 'cursor-default bg-mint/15 text-mint'
                    : locked
                    ? 'cursor-not-allowed bg-amber-500/15 text-amber-300'
                    : 'bg-accent/15 text-accent hover:bg-accent/30'
                }`}
              >
                ▲ {locked ? t('exp.inProcess') : voted ? t('exp.voted') : t('exp.upvote')} · {c.vote_count}
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-300">
                ▲ {c.vote_count} {t('exp.votes')}
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
