import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useLang } from '../lib/i18n.jsx';

/**
 * Gateway return landing page. The URL query is INFORMATIONAL ONLY —
 * success is determined by polling the backend, which verifies with the
 * gateway. Never trust the redirect.
 */
export default function BillingReturn() {
  const { t } = useLang();
  const { id } = useParams();
  const [search] = useSearchParams();
  const [payment, setPayment] = useState(null);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    let stop = false;
    let timer;
    const poll = async () => {
      try {
        const { data } = await api.get(`/billing/payments/${id}`);
        if (stop) return;
        setPayment(data.payment);
        if (['SUCCESS', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED'].includes(data.payment.status)) return;
        if (tries < 20) {
          setTries((x) => x + 1);
          timer = setTimeout(poll, 3000);
        }
      } catch {
        if (!stop && tries < 20) {
          setTries((x) => x + 1);
          timer = setTimeout(poll, 3000);
        }
      }
    };
    poll();
    return () => { stop = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const hint = search.get('status');
  const done = payment && ['SUCCESS', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED'].includes(payment.status);
  const ok = payment?.status === 'SUCCESS';

  return (
    <main className="mx-auto max-w-md px-4 pt-24 text-center">
      {!done && (
        <>
          <p className="font-display text-xl font-extrabold text-white">{t('bill.payVerifying')}</p>
          <p className="mt-2 text-sm text-slate-400">{t('bill.payVerifyingSub')}</p>
          <div className="mx-auto mt-6 h-2 w-48 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-accent" />
          </div>
        </>
      )}
      {done && ok && (
        <>
          <p className="font-display text-4xl">✅</p>
          <p className="mt-3 font-display text-xl font-extrabold text-mint">{t('bill.payOk')}</p>
          <p className="mt-2 text-sm text-slate-400">{t('bill.payOkSub')}</p>
        </>
      )}
      {done && !ok && (
        <>
          <p className="font-display text-4xl">❌</p>
          <p className="mt-3 font-display text-xl font-extrabold text-rose-300">{t('bill.payFail')}</p>
          <p className="mt-2 text-sm text-slate-400">{t('bill.payFailSub')} ({hint || payment.status})</p>
        </>
      )}
      <div className="mt-8 flex justify-center gap-3">
        <Link to="/billing" className="btn-primary">{t('bill.title')}</Link>
        <Link to="/" className="btn-ghost">{t('menu.home') || 'Home'}</Link>
      </div>
    </main>
  );
}
