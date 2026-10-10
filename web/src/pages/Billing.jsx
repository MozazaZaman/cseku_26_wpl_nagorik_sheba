import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { useAuth } from '../store/auth.jsx';
import { useLang } from '../lib/i18n.jsx';

export const money = (minor, currency = 'BDT') =>
  `${currency} ${((minor || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

function Section({ title, sub, children, action }) {
  return (
    <section className="glass mt-6 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-white">{title}</h2>
          {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Empty({ text }) {
  return <p className="rounded-xl border border-white/5 bg-white/[0.02] p-5 text-center text-sm text-slate-500">{text}</p>;
}

/**
 * LGI Billing — subscription, seats, registrations, invoices and payments
 * for the Mayor/Chairman (financial approver) and the LGI Technical Admin.
 * Citizens never see this page; every amount shown comes from the backend.
 */
export default function Billing() {
  const { user } = useAuth();
  const { t } = useLang();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('overview');
  const [regs, setRegs] = useState([]);
  const [regFilter, setRegFilter] = useState('pending');
  const [reqQty, setReqQty] = useState(5);
  const [reqReason, setReqReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [receiptFor, setReceiptFor] = useState(null);
  const [receiptRef, setReceiptRef] = useState('');
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptMethod, setReceiptMethod] = useState('bank');
  const [senderAccount, setSenderAccount] = useState('');

  // Mayor watches + approves purchases; the Technical Admin operates money & people.
  const isMayor = user?.role === 'staff' && user?.staff_role === 'mayor';
  const isTechAdmin = user?.role === 'staff' && user?.staff_role === 'admin';
  const load = async () => {
    setErr('');
    try {
      const { data: s } = await api.get('/billing/summary');
      setData(s);
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to load billing');
    }
  };

  const loadRegs = async () => {
    try {
      const { data: r } = await api.get('/billing/registrations', { params: { status: regFilter === 'all' ? 'all' : regFilter } });
      setRegs(r.registrations);
    } catch {}
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (tab === 'staff') loadRegs(); }, [tab, regFilter]);

  if (!user || user.role !== 'staff' || !(user.staff_role === 'mayor' || user.staff_role === 'admin')) {
    return (
      <main className="mx-auto max-w-md px-4 pt-24 text-center">
        <h1 className="font-display text-2xl font-extrabold text-white">{t('bill.title')}</h1>
        <p className="mt-2 text-slate-400">{t('bill.onlySub')}</p>
        <Link to="/login" className="btn-primary mt-6">{t('staff.loginAs')}</Link>
      </main>
    );
  }

  const seats = data ? {
    paid: data.seats.paid, allocated: data.seats.allocated,
    reserved: data.seats.reserved, available: data.seats.available, mode: data.seats.mode
  } : null;
  const sub = data?.subscription;

  const act = async (fn, okMsg) => {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg({ type: 'ok', text: okMsg }); await load(); await loadRegs(); }
    catch (e) { setMsg({ type: 'err', text: e.response?.data?.error || '…' }); }
    finally { setBusy(false); }
  };

  const createSeatRequest = () =>
    api.post('/billing/seat-requests', { quantity: Number(reqQty), reason: reqReason });
  const approveSeatReq = (id) => {
    if (!window.confirm(t('bill.confirmApprove'))) return;
    act(() => api.post(`/billing/seat-requests/${id}/approve`), t('bill.approved'));
  };
  const payInvoiceRaw = async (invoiceId) => {
    const { data: c } = await api.post('/billing/checkout', { invoice_id: invoiceId });
    window.location.href = c.gateway_url;
  };

  const uploadReceiptRaw = async (invoiceId) => {
    if (!receiptRef.trim() || !receiptFile) {
      throw { response: { data: { error: t('bill.receiptNeeded') } } };
    }
    const fd = new FormData();
    fd.append('invoice_id', invoiceId);
    fd.append('reference', receiptRef.trim());
    fd.append('method', receiptMethod);
    fd.append('sender_account', senderAccount.trim());
    fd.append('receipt', receiptFile);
    await api.post('/billing/manual-evidence', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    setReceiptFor(null); setReceiptRef(''); setReceiptFile(null);
    setReceiptMethod('bank'); setSenderAccount('');
  };

  const tabs = [
    ['overview', t('bill.tab.overview')],
    ...(isTechAdmin ? [['staff', t('bill.tab.staff')]] : []),
    ['seats', t('bill.tab.seats')],
    ['invoices', t('bill.tab.invoices')],
  ];

  // Every money/people decision asks "are you sure?" first.
  const confirmAct = (question, fn, okMsg) => {
    if (!window.confirm(question || t('bill.confirmDefault'))) return;
    act(fn, okMsg);
  };

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12 pt-10 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-[11px] font-bold uppercase tracking-widest text-accent">
          🏛️ {user.authority_name} · {isMayor ? t('wf.roleBadge.mayor') : t('bill.adminRole')}
        </p>
        <h1 className="mt-1 font-display text-3xl font-extrabold text-white sm:text-4xl">
          {t('bill.title')}<span className="text-gradient">{t('bill.titleHl')}</span>
        </h1>
        <p className="mt-2 max-w-3xl text-slate-400">{t('bill.sub')}</p>
      </motion.div>

      {err && <p className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300">{err}</p>}
      {msg && (
        <p className={`mt-4 rounded-xl border px-4 py-2.5 text-sm ${msg.type === 'ok' ? 'border-mint/30 bg-mint/10 text-mint' : 'border-rose-400/30 bg-rose-500/10 text-rose-300'}`}>
          {msg.text}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`chip ${tab === k ? 'chip-active' : 'chip-idle'}`}>{label}</button>
        ))}
      </div>

      {tab === 'overview' && data && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              [t('bill.paid'), seats.mode === 'legacy' ? '∞' : seats.paid, '#5b8cff'],
              [t('bill.allocated'), seats.allocated, '#a78bfa'],
              [t('bill.available'), seats.mode === 'legacy' ? t('bill.unlimited') : seats.available, (seats.available ?? 1) <= 3 ? '#fbbf24' : '#2dd4bf'],
              [t('bill.status'), sub ? sub.status : t('bill.legacy'), '#fb7185'],
            ].map(([label, val, color]) => (
              <div key={label} className="glass p-5">
                <p className="font-display text-3xl font-extrabold" style={{ color }}>{val}</p>
                <p className="mt-1 text-xs uppercase tracking-widest text-slate-500">{label}</p>
              </div>
            ))}
          </div>
          {sub && (
            <div className="glass mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 p-5 text-sm">
              <span><span className="text-slate-500">{t('bill.plan')}: </span><span className="font-semibold text-white">{sub.plan_id}</span></span>
              <span><span className="text-slate-500">{t('bill.expires')}: </span><span className="text-slate-200">{sub.expires_at ? sub.expires_at.slice(0, 10) : '—'}</span></span>
              {data.policy && !data.policy.allowed && (
                <span className="rounded-full bg-rose-500/15 px-3 py-1 text-xs font-bold text-rose-300">{data.policy.message}</span>
              )}
              {isTechAdmin && (
                <button disabled={busy} onClick={() => confirmAct(t('bill.confirmRenew'), () => api.post(`/billing/subscriptions/${sub.subscription_id}/renew`, {}), t('bill.renewInvoiced'))}
                  className="btn-ghost !px-4 !py-2 text-xs">
                  {t('bill.renew')}
                </button>
              )}
            </div>
          )}
          {!sub && (
            <div className="glass mt-4 p-5 text-sm text-slate-300">
              {t('bill.noSub')} <Link to="/onboarding" className="font-semibold text-accent hover:underline">{t('bill.onboardNow')}</Link>
            </div>
          )}
          {data.pending_registrations > 0 && (
            <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-300">
              {data.pending_registrations} {t('bill.pendingRegs')}
            </div>
          )}
        </>
      )}

      {tab === 'staff' && (
        <Section title={t('bill.regQueue')} sub={t('bill.regQueueSub')}
          action={
            <select className="input !w-auto !py-2 text-xs" value={regFilter} onChange={(e) => setRegFilter(e.target.value)}>
              {['pending', 'verified', 'approved', 'all'].map((s) => <option key={s} value={s}>{t(`bill.reg.${s}`)}</option>)}
            </select>
          }>
          {regs.length === 0 ? <Empty text={t('bill.regEmpty')} /> : (
            <div className="space-y-3">
              {regs.map((r) => (
                <div key={r.reg_id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">{r.full_name} <span className="text-xs text-slate-500">· {r.email}</span></p>
                      <p className="text-xs text-slate-500">{r.staff_role_requested} · {r.department} · <span className="rounded-full bg-white/5 px-2 py-0.5">{r.status}</span></p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {r.status === 'pending' && (
                        <button disabled={busy} onClick={() => confirmAct(t('bill.confirmVerify'), () => api.post(`/billing/registrations/${r.reg_id}/verify`, {}), t('bill.verified'))}
                          className="rounded-lg bg-sky-500/15 px-3 py-1.5 text-xs font-bold text-sky-300 hover:bg-sky-500/25">{t('bill.verify')}</button>
                      )}
                      {r.status === 'verified' && (
                        <button disabled={busy} onClick={() => confirmAct(t('bill.confirmApproveStaff'), () => api.post(`/billing/registrations/${r.reg_id}/approve`), t('bill.approved'))}
                          className="rounded-lg bg-mint/15 px-3 py-1.5 text-xs font-bold text-mint hover:bg-mint/25">{t('bill.approve')}</button>
                      )}
                      {r.status === 'approved' && (
                        <button disabled={busy} onClick={() => {
                          const pw = window.prompt(t('bill.setPassword'));
                          if (pw) confirmAct(t('bill.confirmActivate'), () => api.post(`/billing/registrations/${r.reg_id}/activate`, { password: pw }), t('bill.activated'));
                        }} className="rounded-lg bg-accent/15 px-3 py-1.5 text-xs font-bold text-accent hover:bg-accent/30">{t('bill.activate')}</button>
                      )}
                      {['pending', 'verified', 'approved'].includes(r.status) && (
                        <button disabled={busy} onClick={() => {
                          const reason = window.prompt(t('bill.rejectReason')) || '';
                          confirmAct(t('bill.confirmRejectStaff'), () => api.post(`/billing/registrations/${r.reg_id}/reject`, { reason }), t('bill.rejected'));
                        }} className="rounded-lg bg-rose-500/15 px-3 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-500/25">{t('bill.reject')}</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {tab === 'seats' && data && (
        <Section title={t('bill.seatReqs')} sub={t('bill.seatReqsSub')}
          action={isTechAdmin ? (
            <div className="flex flex-wrap items-center gap-2">
              <input type="number" min="1" max="500" value={reqQty} onChange={(e) => setReqQty(e.target.value)}
                className="input !w-24 !py-2 text-xs" />
              <input value={reqReason} onChange={(e) => setReqReason(e.target.value)} placeholder={t('bill.reasonPh')}
                className="input !w-48 !py-2 text-xs" />
              <button disabled={busy} onClick={() => confirmAct(t('bill.confirmBuy'), createSeatRequest, t('bill.reqCreated'))} className="btn-primary !px-4 !py-2 text-xs">{t('bill.buySeats')}</button>
            </div>
          ) : null}>
          {(data.open_seat_requests || []).length === 0
            ? <Empty text={t('bill.noSeatReqs')} />
            : (
              <div className="space-y-3">
                {data.open_seat_requests.map((r) => (
                  <div key={r.request_id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-white">+{r.quantity} {t('bill.seats')} <span className="text-xs text-slate-500">· {r.type}</span></p>
                        <p className="text-xs text-slate-500">{r.reason || ''} · <span className="rounded-full bg-white/5 px-2 py-0.5">{r.status}</span></p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(r.status === 'REQUESTED' || r.status === 'EMPLOYEE_VERIFICATION_PENDING') && isTechAdmin && (
                          <button disabled={busy} onClick={() => confirmAct(t('bill.confirmSubmit'), () => api.post(`/billing/seat-requests/${r.request_id}/submit`), t('bill.submitted'))}
                            className="rounded-lg bg-sky-500/15 px-3 py-1.5 text-xs font-bold text-sky-300 hover:bg-sky-500/25">{t('bill.submitApproval')}</button>
                        )}
                        {r.status === 'AWAITING_FINANCIAL_APPROVAL' && isMayor && (
                          <button disabled={busy} onClick={() => approveSeatReq(r.request_id)}
                            className="rounded-lg bg-mint/15 px-3 py-1.5 text-xs font-bold text-mint hover:bg-mint/25">{t('bill.approvePay')}</button>
                        )}
                        {['REQUESTED', 'AWAITING_FINANCIAL_APPROVAL'].includes(r.status) && isTechAdmin && (
                          <button disabled={busy} onClick={() => confirmAct(t('bill.confirmCancelReq'), () => api.post(`/billing/seat-requests/${r.request_id}/cancel`), t('bill.cancelled'))}
                            className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-white/10">{t('bill.cancel')}</button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </Section>
      )}

      {tab === 'invoices' && data && (
        <Section title={t('bill.invoices')} sub={t('bill.invoicesSub')}>
          {(data.recent_invoices || []).length === 0 ? <Empty text={t('bill.noInvoices')} /> : (
            <div className="space-y-3">
              {data.recent_invoices.map((inv) => (
                <div key={inv.invoice_id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-white">{inv.invoice_no} <span className="text-xs text-slate-500">· {inv.type}</span></p>
                      <p className="text-xs text-slate-500">{money(inv.total, inv.currency)} · <span className="rounded-full bg-white/5 px-2 py-0.5">{inv.status}</span></p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link to={`/billing/invoices/${inv.invoice_id}`} className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-white/10">{t('bill.view')}</Link>
                      {['issued', 'pending', 'failed'].includes(inv.status) && isTechAdmin && (
                        <>
                          <button disabled={busy} onClick={() => confirmAct(t('bill.confirmPay').replace('{total}', money(inv.total, inv.currency)), () => payInvoiceRaw(inv.invoice_id), t('bill.payStarted'))}
                            className="rounded-lg bg-accent/15 px-3 py-1.5 text-xs font-bold text-accent hover:bg-accent/30">{t('bill.pay')}</button>
                          <button disabled={busy}
                            onClick={() => { setReceiptFor(receiptFor === inv.invoice_id ? null : inv.invoice_id); setReceiptRef(''); setReceiptFile(null); setReceiptMethod('bank'); setSenderAccount(''); }}
                            className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-white/10">{t('bill.bankReceipt')}</button>
                        </>
                      )}
                    </div>
                  </div>
                  {receiptFor === inv.invoice_id && isTechAdmin && (
                    <div className="mt-3 grid gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 sm:grid-cols-2">
                      <select value={receiptMethod} onChange={(e) => setReceiptMethod(e.target.value)} className="input !py-2 text-xs">
                        {[['bank', t('bill.method.bank')], ['bkash', t('bill.method.bkash')], ['nagad', t('bill.method.nagad')], ['rocket', t('bill.method.rocket')]].map(([v, label]) => (
                          <option key={v} value={v}>{label}</option>
                        ))}
                      </select>
                      <input value={senderAccount} onChange={(e) => setSenderAccount(e.target.value)}
                        placeholder={t('bill.senderPh')} className="input !py-2 text-xs" />
                      <input value={receiptRef} onChange={(e) => setReceiptRef(e.target.value)}
                        placeholder={t('bill.receiptRefPh')} className="input !py-2 text-xs" />
                      <input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                        className="input !py-2 text-xs" />
                      <div className="sm:col-span-2">
                        <button disabled={busy} onClick={() => confirmAct(t('bill.confirmReceipt'), () => uploadReceiptRaw(inv.invoice_id), t('bill.receiptDone'))}
                          className="btn-primary w-full !px-4 !py-2 text-xs">{t('bill.submitReceipt')}</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>
      )}
    </main>
  );
}
