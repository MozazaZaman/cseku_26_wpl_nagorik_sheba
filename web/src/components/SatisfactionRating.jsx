import { useState } from 'react';
import { useLang } from '../lib/i18n.jsx';
import { SATISFACTION_TIERS, tierByScore } from '../lib/satisfaction.js';

/**
 * Citizen satisfaction picker for the resolve-confirm page.
 *
 * Shown alongside the existing confirm/dispute actions once a complaint is
 * resolved. The emoji is required to submit; the comment is always optional.
 * One rating per complaint — when a score already exists we only render the
 * recorded thank-you state.
 */
export default function SatisfactionRating({ existingScore, existingComment, onSubmit }) {
  const { t } = useLang();
  const [score, setScore] = useState(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Already submitted (reloaded after submit, or loaded from the API)
  if (existingScore != null) {
    const tier = tierByScore(existingScore);
    return (
      <div className="mt-4 rounded-xl border border-mint/30 bg-mint/10 px-4 py-3 text-sm font-semibold text-mint">
        <span className="mr-1.5 text-base">{tier?.emoji}</span>
        {t('sat.thanks')} {existingComment ? (
          <span className="mt-1.5 block font-normal text-slate-300">“{existingComment}”</span>
        ) : null}
      </div>
    );
  }

  const submit = async () => {
    if (score == null) { setErr(t('sat.selectFirst')); return; }
    setBusy(true);
    setErr('');
    try {
      await onSubmit(score, comment.trim());
    } catch (e) {
      setErr(e.response?.data?.error || '…');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-violet-400/30 bg-violet-500/10 p-4">
      <p className="text-sm font-semibold text-violet-200">{t('sat.ask')}</p>
      <p className="mt-1 text-xs text-slate-400">{t('sat.sub')}</p>

      {/* Emoji options — selecting one is required to submit */}
      <div className="mt-3 flex flex-wrap gap-2">
        {SATISFACTION_TIERS.map((tier) => {
          const selected = score === tier.score;
          return (
            <button
              key={tier.score}
              type="button"
              onClick={() => { setScore(tier.score); setErr(''); }}
              title={t(tier.label)}
              aria-pressed={selected}
              className={`group flex w-[72px] flex-col items-center gap-1 rounded-xl border p-2.5 transition-all duration-200 ${
                selected
                  ? `${tier.ring} ${tier.glow} scale-105 ${tier.text}`
                  : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/25 hover:scale-105'
              }`}
            >
              <span className={`text-2xl transition-transform ${selected ? 'scale-110' : 'grayscale-[35%] group-hover:grayscale-0'}`}>
                {tier.emoji}
              </span>
              <span className="text-[10px] font-semibold leading-tight">{t(tier.label)}</span>
            </button>
          );
        })}
      </div>

      {/* Optional comment — never required */}
      <div className="mt-4">
        <label className="label" htmlFor="sat-comment">{t('sat.comment')}</label>
        <textarea
          id="sat-comment"
          className="input min-h-[72px]"
          value={comment}
          placeholder={t('sat.commentPh')}
          onChange={(e) => setComment(e.target.value)}
          maxLength={500}
        />
      </div>

      {err && <p className="mt-2 text-xs font-semibold text-rose-300">{err}</p>}

      <button
        onClick={submit}
        disabled={busy || score == null}
        className={`btn-primary mt-3 !py-2 text-xs ${score == null ? 'cursor-not-allowed opacity-50' : ''}`}
      >
        {busy ? t('sat.submitting') : t('sat.submit')}
      </button>
    </div>
  );
}
