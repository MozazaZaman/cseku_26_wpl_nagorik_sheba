import { useEffect, useState } from 'react';
import { useLang } from '../lib/i18n.jsx';
import { api } from '../lib/api.js';

/**
 * Inline workflow action buttons + comment modal. Used directly on staff
 * dashboard cards so every role sees its forward/reject controls without
 * opening the detail page.
 *
 * Props: complaint, myActions (array), executors (for WIT), onDone
 */
export default function WorkflowActions({ complaint, myActions, executors = [], onDone, compact = false }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [eta, setEta] = useState('48');
  const [executor, setExecutor] = useState(executors[0]?.staff_id ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Keep the selected executor valid once the executors list loads async
  useEffect(() => {
    if (!executors.length) return;
    setExecutor((cur) => (executors.some((s) => s.staff_id === Number(cur)) ? cur : executors[0].staff_id));
  }, [executors]);

  if (!myActions?.length) return null;

  const isWitAssign = myActions.includes('wit_assign');

  async function submit(action) {
    if (busy) return;
    if (action !== 'field_start' && !comment.trim()) {
      setErr(t('act.commentReq'));
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const body = { action, comment: comment.trim() };
      if (action === 'wit_assign') {
        body.eta_hours = parseInt(eta) || 48;
        body.executor_staff_id = parseInt(executor);
      }
      await api.post(`/complaints/${complaint.complaint_id}/workflow`, body);
      setOpen(false);
      setComment('');
      onDone?.();
    } catch (e) {
      setErr(e.response?.data?.error || 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  const quick = (action, cls, primary = false) => (
    <button key={action} onClick={() => { setOpen(action); setErr(''); }}
      className={`rounded-xl px-4 py-2 text-xs font-bold transition ${primary ? 'btn-primary !px-4 !py-2 text-xs' : cls}`}>
      {t(`act.${action}`)}
    </button>
  );

  return (
    <>
      <div className={`flex flex-wrap gap-2 ${compact ? '' : 'mt-3'}`}>
        {myActions.map((a) => {
          if (['junior_approve', 'senior_approve', 'mayor_approve', 'send_to_wit'].includes(a)) {
            return quick(a, '', true);
          }
          if (a === 'wit_assign') return quick(a, '', true);
          if (a === 'field_start') return quick(a, 'bg-amber/20 text-amber border border-amber/40 hover:bg-amber/30');
          if (a === 'field_resolve') return quick(a, 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 hover:bg-emerald-500/30');
          return quick(a, 'bg-rose-500/15 text-rose-300 border border-rose-400/40 hover:bg-rose-500/25'); // rejects
        })}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setOpen(false)}>
          <div className="glass-strong w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-bold text-white">{t(`act.${open}`)}</h3>
            <p className="mt-1 text-xs text-slate-400">#{complaint.complaint_id} · {complaint.title}</p>

            {open === 'wit_assign' && executors.length > 0 && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">{t('act.executor')}</label>
                  <select className="input" value={executor} onChange={(e) => setExecutor(e.target.value)}>
                    {executors.map((s) => (
                      <option key={s.staff_id} value={s.staff_id}>{s.full_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">{t('act.eta')}</label>
                  <input className="input" type="number" min="1" value={eta} onChange={(e) => setEta(e.target.value)} />
                </div>
              </div>
            )}

            {open !== 'field_start' && (
              <>
                <label className="label mt-4">{t('act.comment')} *</label>
                <textarea className="input min-h-[80px]" value={comment}
                  placeholder={t('staff.note.ph')} onChange={(e) => setComment(e.target.value)} />
              </>
            )}

            {err && <p className="mt-2 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{err}</p>}

            <div className="mt-5 flex gap-3">
              <button onClick={() => submit(open)} disabled={busy}
                className="btn-primary flex-1 !py-2.5 text-sm">
                {busy ? '…' : t('staff.confirm')}
              </button>
              <button onClick={() => setOpen(false)} className="btn-ghost !py-2.5 text-sm">{t('staff.cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
