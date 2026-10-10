import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useLang } from '../lib/i18n.jsx';
import { money } from './Billing.jsx';

/** Printable invoice + receipt (browser print → PDF). Read-only, backend data. */
export default function InvoiceView() {
  const { t } = useLang();
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get(`/billing/invoices/${id}`)
      .then(({ data }) => setData(data))
      .catch((e) => setErr(e.response?.data?.error || 'Failed to load invoice'));
  }, [id]);

  if (err) return <main className="mx-auto max-w-3xl px-4 pt-24 text-center text-rose-300">{err}</main>;
  if (!data) return <main className="mx-auto max-w-3xl px-4 pt-24 text-center text-slate-500">…</main>;

  const { invoice, authority, payments } = data;
  const paid = invoice.status === 'paid';

  return (
    <main className="mx-auto max-w-3xl px-4 pb-12 pt-10 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link to="/billing" className="text-sm text-slate-400 hover:text-white">← {t('bill.title')}</Link>
        <button onClick={() => window.print()} className="btn-ghost !px-4 !py-2 text-xs">🖨️ {t('bill.print')}</button>
      </div>
      <div className="glass-strong p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-display text-xl font-extrabold text-white">Nagorik Sheba</p>
            <p className="text-xs text-slate-500">{t('bill.invoiceDoc')}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-2xl font-extrabold text-white">{invoice.invoice_no}</p>
            <span className={`mt-1 inline-block rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest ${paid ? 'bg-mint/15 text-mint' : 'bg-amber-500/15 text-amber-300'}`}>
              {paid ? t('bill.paid') : invoice.status}
            </span>
          </div>
        </div>
        <div className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="label">{t('bill.billTo')}</p>
            <p className="font-semibold text-white">{authority?.name}</p>
            <p className="text-slate-400">{authority?.district}{authority?.division ? `, ${authority.division}` : ''}</p>
          </div>
          <div className="sm:text-right">
            <p className="label">{t('bill.dates')}</p>
            <p className="text-slate-300">{t('bill.issued')}: {invoice.created_at?.slice(0, 10)}</p>
            <p className="text-slate-300">{t('bill.due')}: {invoice.due_date?.slice(0, 10) || '—'}</p>
            {invoice.paid_at && <p className="text-mint">{t('bill.paidOn')}: {invoice.paid_at.slice(0, 10)}</p>}
          </div>
        </div>
        <table className="mt-6 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-500">
              <th className="py-2 pr-2">{t('bill.desc')}</th>
              <th className="py-2 pr-2 text-right">{t('bill.qty')}</th>
              <th className="py-2 pr-2 text-right">{t('bill.unit')}</th>
              <th className="py-2 text-right">{t('bill.amount')}</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((l, i) => (
              <tr key={i} className="border-b border-white/5 text-slate-200">
                <td className="py-2 pr-2">{l.label}</td>
                <td className="py-2 pr-2 text-right">{l.qty}</td>
                <td className="py-2 pr-2 text-right">{money(l.unit, invoice.currency)}</td>
                <td className="py-2 text-right font-semibold">{money(l.amount, invoice.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 space-y-1 text-right text-sm">
          <p className="text-slate-400">{t('bill.subtotal')}: {money(invoice.subtotal, invoice.currency)}</p>
          <p className="text-slate-400">{t('bill.vat')}: {money(invoice.vat, invoice.currency)}</p>
          <p className="font-display text-2xl font-extrabold text-white">{t('bill.total')}: {money(invoice.total, invoice.currency)}</p>
        </div>
        {payments.length > 0 && (
          <div className="mt-6 border-t border-white/10 pt-4 text-sm">
            <p className="label">{t('bill.payments')}</p>
            {payments.map((p) => (
              <p key={p.payment_id} className="text-slate-300">
                {p.txn_id} · {money(p.amount, p.currency)} · {p.gateway} · {p.status}
              </p>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
