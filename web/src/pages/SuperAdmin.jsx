import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../store/auth.jsx';
import { useLang } from '../lib/i18n.jsx';
import { money } from './Billing.jsx';

function Block({ title, children }) {
  return (
    <section className="glass mt-6 p-5 sm:p-6">
      <h2 className="font-display text-lg font-bold text-white">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function FailedTxns({ act, busy, t }) {
  const [rows, setRows] = useState([]);
  const [done, setDone] = useState([]);
  const [refunds, setRefunds] = useState([]);
  useEffect(() => {
    api.get('/billing/txn', { params: { status: 'FAILED', limit: 50 } })
      .then(({ data }) => setRows(data.payments))
      .catch(() => {});
    api.get('/billing/txn', { params: { status: 'SUCCESS', limit: 20 } })
      .then(({ data }) => setDone(data.payments))
      .catch(() => {});
  }, []);
  const askRefund = (p) => {
    const amount = window.prompt(t('bill.refundAmountPh'), String(p.amount / 100));
    if (!amount) return;
    if (!window.confirm(t('bill.confirmRefund'))) return;
    act(() => api.post('/billing/refunds', { payment_id: p.payment_id, amount: Math.round(Number(amount) * 100), reason: 'superadmin refund' }), t('bill.done'));
  };
  return (
    <>
      {rows.length === 0 ? <p className="text-sm text-slate-500">{t('bill.empty')}</p> : (
        <div className="space-y-2">
          {rows.map((p) => (
            <div key={p.payment_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
              <span className="text-slate-200">{p.authority_name} · {p.invoice_no} · {money(p.amount, p.currency)} · {p.txn_id}</span>
              <button disabled={busy} onClick={() => act(() => api.post(`/billing/payments/${p.payment_id}/reconcile`, {}), t('bill.done'))}
                className="rounded-lg bg-sky-500/15 px-3 py-1.5 text-xs font-bold text-sky-300 hover:bg-sky-500/25">{t('bill.reconcile')}</button>
            </div>
          ))}
        </div>
      )}
      <p className="mb-2 mt-5 text-[11px] font-bold uppercase tracking-widest text-slate-500">{t('bill.recentSuccess')}</p>
      {done.length === 0 ? <p className="text-sm text-slate-500">{t('bill.empty')}</p> : (
        <div className="space-y-2">
          {done.map((p) => (
            <div key={p.payment_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
              <span className="text-slate-200">{p.authority_name} · {p.invoice_no} · {money(p.amount, p.currency)} · {p.txn_id}</span>
              <button disabled={busy} onClick={() => askRefund(p)}
                className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-white/10">{t('bill.refund')}</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function GatewayStatus({ t }) {
  const [cfg, setCfg] = useState(null);
  useEffect(() => {
    api.get('/billing/gateway/status').then(({ data }) => setCfg(data)).catch(() => {});
  }, []);
  if (!cfg) return <p className="text-sm text-slate-500">…</p>;
  return (
    <div className="grid gap-2 text-sm sm:grid-cols-2">
      <p className="text-slate-300">{t('bill.gwProvider')}: <span className="font-bold text-white">{cfg.provider}</span></p>
      <p className="text-slate-300">{t('bill.gwMode')}: <span className="font-bold text-white">{cfg.sandbox ? t('bill.gwSandbox') : t('bill.gwLive')}</span></p>
      <p className="text-slate-300">{t('bill.gwCurrency')}: <span className="font-bold text-white">{cfg.currency}</span></p>
      <p className="text-slate-300">{t('bill.gwCreds')}: <span className={`font-bold ${cfg.configured ? 'text-mint' : 'text-amber-300'}`}>{cfg.configured ? t('bill.gwReady') : t('bill.gwMissing')}</span></p>
    </div>
  );
}

/** Platform Super Admin — onboarding, plans, payments, manual review, audit, analytics. */
export default function SuperAdmin() {
  const { user } = useAuth();
  const { t } = useLang();
  const [tab, setTab] = useState('orgs');
  const [orgs, setOrgs] = useState([]);
  const [orgFilter, setOrgFilter] = useState('SUBMITTED');
  const [plans, setPlans] = useState([]);
  const [summary, setSummary] = useState(null);
  const [queue, setQueue] = useState([]);
  const [audit, setAudit] = useState([]);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [planForm, setPlanForm] = useState({ name: '', billing_period: 'annual', pricing_model: 'per_seat', per_seat_fee: 50000, vat_percent: 0, grace_days: 14 });
  const [adminForm, setAdminForm] = useState({});
  const [lgiQuery, setLgiQuery] = useState('');
  const [lgis, setLgis] = useState([]);
  const [openLgi, setOpenLgi] = useState(null);
  const [lgiStaff, setLgiStaff] = useState([]);
  const [newLgi, setNewLgi] = useState({ name: '', type: 'POUROSHOVA', division: '', district: '', min_lat: '', max_lat: '', min_lng: '', max_lng: '' });
  const [newStaff, setNewStaff] = useState({});

  const loadOrgs = async () => {
    const { data } = await api.get('/billing/organizations', { params: orgFilter === 'all' ? {} : { status: orgFilter } });
    setOrgs(data.organizations);
  };
  const loadAll = async () => {
    try {
      const [{ data: a }, { data: q }] = await Promise.all([
        api.get('/billing/analytics/summary'), api.get('/billing/manual-queue')
      ]);
      setSummary(a);
      setQueue(q.queue);
      const { data: p } = await api.get('/billing/plans/manage');
      setPlans(p.plans);
      const { data: au } = await api.get('/billing/audit', { params: { limit: 50 } });
      setAudit(au.audit);
    } catch (e) {
      setMsg({ type: 'err', text: e.response?.data?.error || '…' });
    }
  };

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { if (tab === 'orgs') loadOrgs().catch(() => {}); }, [tab, orgFilter]);

  if (!user || user.role !== 'super_admin') {
    return (
      <main className="mx-auto max-w-md px-4 pt-24 text-center">
        <h1 className="font-display text-2xl font-extrabold text-white">{t('bill.superTitle')}</h1>
        <p className="mt-2 text-slate-400">{t('bill.superOnly')}</p>
        <Link to="/login" className="btn-primary mt-6">{t('nav.login')}</Link>
      </main>
    );
  }

  const act = async (fn, okMsg) => {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg({ type: 'ok', text: okMsg }); await loadAll(); await loadOrgs().catch(() => {}); }
    catch (e) { setMsg({ type: 'err', text: e.response?.data?.error || '…' }); }
    finally { setBusy(false); }
  };

  const tabs = [['orgs', t('bill.tab.orgs')], ['lgis', t('bill.tab.lgis')], ['plans', t('bill.tab.plans')], ['finance', t('bill.tab.finance')], ['audit', t('bill.tab.audit')]];

  const searchLgis = async (q) => {
    try {
      const { data } = await api.get('/billing/authorities/unassigned', { params: { q: q || '' } });
      setLgis(data.authorities);
    } catch (e) {
      setMsg({ type: 'err', text: e.response?.data?.error || '…' });
    }
  };

  const openLgiStaff = async (aid) => {
    setOpenLgi(aid);
    try {
      const { data: s } = await api.get('/billing/staff', { params: { authority_id: aid } });
      setLgiStaff(s.staff || []);
    } catch (e) {
      setMsg({ type: 'err', text: e.response?.data?.error || '…' });
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12 pt-10 sm:px-6">
      <p className="text-[11px] font-bold uppercase tracking-widest text-accent">🛡️ {t('bill.superTitle')}</p>
      <h1 className="mt-1 font-display text-3xl font-extrabold text-white">{t('bill.superH')}</h1>
      {msg && (
        <p className={`mt-4 rounded-xl border px-4 py-2.5 text-sm ${msg.type === 'ok' ? 'border-mint/30 bg-mint/10 text-mint' : 'border-rose-400/30 bg-rose-500/10 text-rose-300'}`}>{msg.text}</p>
      )}
      <div className="mt-6 flex flex-wrap gap-2">
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`chip ${tab === k ? 'chip-active' : 'chip-idle'}`}>{label}</button>
        ))}
      </div>

      {tab === 'orgs' && (
        <Block title={t('bill.orgQueue')}
          children={
            <>
              <select className="input mb-4 !w-auto !py-2 text-xs" value={orgFilter} onChange={(e) => setOrgFilter(e.target.value)}>
                {['SUBMITTED', 'UNDER_REVIEW', 'NEEDS_INFORMATION', 'VERIFIED', 'PENDING_PAYMENT', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'all'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              {orgs.length === 0 ? <p className="text-sm text-slate-500">{t('bill.empty')}</p> : (
                <div className="space-y-3">
                  {orgs.map((o) => (
                    <div key={o.org_id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-white">{o.name} <span className="text-xs text-slate-500">· {o.type}</span></p>
                          <p className="text-xs text-slate-500">{o.contact_email} · {o.rep_name} ({o.rep_designation}) · {o.requested_seats} {t('bill.seats')}</p>
                          <p className="mt-0.5 text-[11px]"><span className="rounded-full bg-white/5 px-2 py-0.5 font-bold text-slate-300">{o.status}</span></p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {['UNDER_REVIEW', 'VERIFIED'].includes(o.status) === false && ['SUBMITTED', 'NEEDS_INFORMATION'].includes(o.status) && (
                            <button disabled={busy} onClick={() => act(() => api.patch(`/billing/organizations/${o.org_id}/status`, { status: 'UNDER_REVIEW' }), t('bill.done'))}
                              className="rounded-lg bg-sky-500/15 px-3 py-1.5 text-xs font-bold text-sky-300 hover:bg-sky-500/25">{t('bill.review')}</button>
                          )}
                          {o.status === 'UNDER_REVIEW' && (
                            <>
                              <button disabled={busy} onClick={() => {
                                if (!window.confirm(t('bill.confirmVerifyOrg'))) return;
                                act(() => api.patch(`/billing/organizations/${o.org_id}/status`, { status: 'VERIFIED' }), t('bill.done'));
                              }}
                                className="rounded-lg bg-mint/15 px-3 py-1.5 text-xs font-bold text-mint hover:bg-mint/25">{t('bill.verify')}</button>
                              <button disabled={busy} onClick={() => {
                                const note = window.prompt(t('bill.notePh')) || '';
                                act(() => api.patch(`/billing/organizations/${o.org_id}/status`, { status: 'NEEDS_INFORMATION', note }), t('bill.done'));
                              }} className="rounded-lg bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/25">{t('bill.needInfo')}</button>
                            </>
                          )}
                          {!['REJECTED', 'ACTIVE', 'SUSPENDED', 'PENDING_PAYMENT'].includes(o.status) && (
                            <button disabled={busy} onClick={() => {
                              if (!window.confirm(t('bill.confirmReject'))) return;
                              const note = window.prompt(t('bill.notePh')) || '';
                              act(() => api.patch(`/billing/organizations/${o.org_id}/status`, { status: 'REJECTED', note }), t('bill.done'));
                            }} className="rounded-lg bg-rose-500/15 px-3 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-500/25">{t('bill.reject')}</button>
                          )}
                        </div>
                      </div>
                      {o.authority_id && (
                        <details className="mt-3 rounded-lg bg-white/[0.02] p-3 text-xs">
                          <summary className="cursor-pointer font-semibold text-accent">{t('bill.appointAdmin')}</summary>
                          <div className="mt-2 grid gap-2 sm:grid-cols-3">
                            <input className="input !py-2 text-xs" placeholder={t('reg.name')} value={adminForm[o.org_id]?.name || ''}
                              onChange={(e) => setAdminForm({ ...adminForm, [o.org_id]: { ...adminForm[o.org_id], name: e.target.value } })} />
                            <input className="input !py-2 text-xs" placeholder={t('fp.email')} value={adminForm[o.org_id]?.email || ''}
                              onChange={(e) => setAdminForm({ ...adminForm, [o.org_id]: { ...adminForm[o.org_id], email: e.target.value } })} />
                            <div className="flex gap-2">
                              <input className="input !py-2 text-xs" type="password" placeholder={t('bill.tempPass')} value={adminForm[o.org_id]?.password || ''}
                                onChange={(e) => setAdminForm({ ...adminForm, [o.org_id]: { ...adminForm[o.org_id], password: e.target.value } })} />
                              <button disabled={busy} onClick={() => {
                                const f = adminForm[o.org_id] || {};
                                act(() => api.post(`/billing/organizations/${o.org_id}/admin`,
                                  { full_name: f.name, email: f.email, password: f.password }), t('bill.done'));
                              }} className="btn-primary shrink-0 !px-3 !py-2 text-xs">{t('bill.create')}</button>
                            </div>
                          </div>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          } />
      )}

      {tab === 'lgis' && (
        <>
          <Block title={t('bill.newLgi')}
            children={
              <div className="grid gap-2 sm:grid-cols-3">
                <input className="input !py-2 text-xs" placeholder={t('bill.orgName')} value={newLgi.name} onChange={(e) => setNewLgi({ ...newLgi, name: e.target.value })} />
                <select className="input !py-2 text-xs" value={newLgi.type} onChange={(e) => setNewLgi({ ...newLgi, type: e.target.value })}>
                  <option value="CITY_CORPORATION">{t('an.type.CITY_CORPORATION')}</option>
                  <option value="POUROSHOVA">{t('an.type.POUROSHOVA')}</option>
                  <option value="UNION_PARISHAD">{t('an.type.UNION_PARISHAD')}</option>
                </select>
                <input className="input !py-2 text-xs" placeholder={t('bill.division')} value={newLgi.division} onChange={(e) => setNewLgi({ ...newLgi, division: e.target.value })} />
                <input className="input !py-2 text-xs" placeholder={t('bill.district')} value={newLgi.district} onChange={(e) => setNewLgi({ ...newLgi, district: e.target.value })} />
                <input className="input !py-2 text-xs" type="number" step="any" placeholder="min_lat" value={newLgi.min_lat} onChange={(e) => setNewLgi({ ...newLgi, min_lat: e.target.value })} />
                <input className="input !py-2 text-xs" type="number" step="any" placeholder="max_lat" value={newLgi.max_lat} onChange={(e) => setNewLgi({ ...newLgi, max_lat: e.target.value })} />
                <input className="input !py-2 text-xs" type="number" step="any" placeholder="min_lng" value={newLgi.min_lng} onChange={(e) => setNewLgi({ ...newLgi, min_lng: e.target.value })} />
                <input className="input !py-2 text-xs" type="number" step="any" placeholder="max_lng" value={newLgi.max_lng} onChange={(e) => setNewLgi({ ...newLgi, max_lng: e.target.value })} />
                <div>
                  <button disabled={busy || !newLgi.name} onClick={() => {
                    if (!window.confirm(t('bill.confirmDefault'))) return;
                    act(() => api.post('/billing/authorities', { ...newLgi }).then(() => searchLgis(lgiQuery)), t('bill.done'));
                  }} className="btn-primary w-full !px-3 !py-2 text-xs">{t('bill.createLgi')}</button>
                </div>
              </div>
            } />
          <Block title={t('bill.lgiList')}
            children={
              <>
                <div className="mb-3 flex gap-2">
                  <input className="input !py-2 text-xs" placeholder={t('bill.searchLgi')} value={lgiQuery}
                    onChange={(e) => { setLgiQuery(e.target.value); }} onKeyDown={(e) => { if (e.key === 'Enter') searchLgis(lgiQuery); }} />
                  <button onClick={() => searchLgis(lgiQuery)} className="btn-ghost shrink-0 !px-4 !py-2 text-xs">{t('bill.search')}</button>
                </div>
                {lgis.length === 0 ? <p className="text-sm text-slate-500">{t('bill.searchHint')}</p> : (
                  <div className="space-y-2">
                    {lgis.map((a) => (
                      <div key={a.authority_id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-white">{a.name} <span className="text-xs font-normal text-slate-500">· {a.type} · {a.district}</span></p>
                            <p className="text-xs text-slate-500">
                              {a.admin_count > 0 ? `✅ admin × ${a.admin_count}` : `⚠️ ${t('bill.noAdmin')}`} · {t('bill.staffCount')}: {a.staff_count} · {a.sub_status || t('bill.noSubShort')}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => openLgiStaff(openLgi === a.authority_id ? null : a.authority_id)}
                              className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-white/10">{t('bill.manageStaff')}</button>
                          </div>
                        </div>
                        {openLgi === a.authority_id && (
                          <div className="mt-3 border-t border-white/5 pt-3">
                            <div className="grid gap-2 sm:grid-cols-4">
                              <input className="input !py-1.5 text-xs" placeholder={t('reg.name')} value={newStaff[a.authority_id]?.name || ''}
                                onChange={(e) => setNewStaff({ ...newStaff, [a.authority_id]: { ...newStaff[a.authority_id], name: e.target.value } })} />
                              <input className="input !py-1.5 text-xs" placeholder={t('fp.email')} value={newStaff[a.authority_id]?.email || ''}
                                onChange={(e) => setNewStaff({ ...newStaff, [a.authority_id]: { ...newStaff[a.authority_id], email: e.target.value } })} />
                              <input className="input !py-1.5 text-xs" type="password" placeholder={t('bill.tempPass')} value={newStaff[a.authority_id]?.password || ''}
                                onChange={(e) => setNewStaff({ ...newStaff, [a.authority_id]: { ...newStaff[a.authority_id], password: e.target.value } })} />
                              <div className="flex gap-2">
                                <select className="input !py-1.5 text-xs" value={newStaff[a.authority_id]?.role || 'junior'}
                                  onChange={(e) => setNewStaff({ ...newStaff, [a.authority_id]: { ...newStaff[a.authority_id], role: e.target.value } })}>
                                  {['junior', 'senior', 'mayor', 'wit', 'field', 'admin'].map((r) => <option key={r} value={r}>{r}</option>)}
                                </select>
                                <button disabled={busy} onClick={() => {
                                  const f = newStaff[a.authority_id] || {};
                                  if (!window.confirm(t('bill.confirmCreateStaff'))) return;
                                  act(() => api.post('/billing/staff', { ...f, authority_id: a.authority_id }).then(() => openLgiStaff(a.authority_id)), t('bill.done'));
                                }} className="btn-primary shrink-0 !px-3 !py-1.5 text-xs">{t('bill.create')}</button>
                              </div>
                            </div>
                            <div className="mt-2 grid gap-2 rounded-lg bg-white/[0.02] p-2 sm:grid-cols-[1fr_1fr_auto]">
                              <input className="input !py-1.5 text-xs" placeholder={t('bill.adminNamePh')} value={adminForm[a.authority_id]?.name || ''}
                                onChange={(e) => setAdminForm({ ...adminForm, [a.authority_id]: { ...adminForm[a.authority_id], name: e.target.value } })} />
                              <input className="input !py-1.5 text-xs" placeholder={t('fp.email')} value={adminForm[a.authority_id]?.email || ''}
                                onChange={(e) => setAdminForm({ ...adminForm, [a.authority_id]: { ...adminForm[a.authority_id], email: e.target.value } })} />
                              <div className="flex gap-2">
                                <input className="input !py-1.5 text-xs" type="password" placeholder={t('bill.tempPass')} value={adminForm[a.authority_id]?.password || ''}
                                  onChange={(e) => setAdminForm({ ...adminForm, [a.authority_id]: { ...adminForm[a.authority_id], password: e.target.value } })} />
                                <button disabled={busy} onClick={() => {
                                  const f = adminForm[a.authority_id] || {};
                                  if (!window.confirm(t('bill.confirmDefault'))) return;
                                  act(() => api.post(`/billing/authorities/${a.authority_id}/admin`,
                                    { full_name: f.name, email: f.email, password: f.password }).then(() => { openLgiStaff(a.authority_id); searchLgis(lgiQuery); }), t('bill.done'));
                                }} className="shrink-0 rounded-lg bg-accent/15 px-3 py-1.5 text-xs font-bold text-accent hover:bg-accent/30">{t('bill.appointAdminShort')}</button>
                              </div>
                            </div>
                            <div className="mt-2 space-y-1.5">
                              {lgiStaff.map((s) => (
                                <div key={s.staff_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/[0.02] px-3 py-2 text-xs">
                                  <span className="text-slate-200">{s.full_name} <span className="text-slate-500">· {s.email} · {s.staff_role} · {s.is_active ? t('sadmin.active') : t('sadmin.inactive')}</span></span>
                                  <span className="flex gap-2">
                                    {s.is_active ? (
                                      <button disabled={busy} onClick={() => {
                                        if (!window.confirm(t('bill.confirmDeactivate'))) return;
                                        act(() => api.post(`/billing/staff/${s.staff_id}/deactivate`, { authority_id: a.authority_id }).then(() => openLgiStaff(a.authority_id)), t('bill.done'));
                                      }} className="rounded-md bg-rose-500/15 px-2.5 py-1 font-bold text-rose-300 hover:bg-rose-500/25">{t('sadmin.deactivate')}</button>
                                    ) : (
                                      <button disabled={busy} onClick={() => {
                                        if (!window.confirm(t('bill.confirmReactivate'))) return;
                                        act(() => api.post(`/billing/staff/${s.staff_id}/reactivate`, { authority_id: a.authority_id }).then(() => openLgiStaff(a.authority_id)), t('bill.done'));
                                      }} className="rounded-md bg-mint/15 px-2.5 py-1 font-bold text-mint hover:bg-mint/25">{t('sadmin.reactivate')}</button>
                                    )}
                                    <button disabled={busy} onClick={() => {
                                      if (!window.confirm(t('bill.confirmRemoveStaff'))) return;
                                      act(() => api.delete(`/billing/staff/${s.staff_id}`).then(() => openLgiStaff(a.authority_id)), t('bill.done'));
                                    }} className="rounded-md bg-white/5 px-2.5 py-1 font-bold text-slate-400 hover:bg-rose-500/20 hover:text-rose-300">✕</button>
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            } />
        </>
      )}

      {tab === 'plans' && (
        <Block title={t('bill.plans')}
          children={
            <>
              <div className="grid gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-4 sm:grid-cols-5">
                <input className="input !py-2 text-xs" placeholder={t('bill.planName')} value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} />
                <select className="input !py-2 text-xs" value={planForm.billing_period} onChange={(e) => setPlanForm({ ...planForm, billing_period: e.target.value })}>
                  <option value="annual">annual</option>
                  <option value="monthly">monthly</option>
                </select>
                <select className="input !py-2 text-xs" value={planForm.pricing_model} onChange={(e) => setPlanForm({ ...planForm, pricing_model: e.target.value })}>
                  <option value="per_seat">per_seat</option>
                  <option value="band">band</option>
                  <option value="base_plus_seat">base_plus_seat</option>
                </select>
                <input className="input !py-2 text-xs" type="number" placeholder="per-seat (paisa)" value={planForm.per_seat_fee} onChange={(e) => setPlanForm({ ...planForm, per_seat_fee: e.target.value })} />
                <button disabled={busy || !planForm.name} onClick={() => {
                  if (!window.confirm(t('bill.confirmDefault'))) return;
                  act(() => api.post('/billing/plans', planForm), t('bill.done'));
                }}
                  className="btn-primary !px-3 !py-2 text-xs">{t('bill.create')}</button>
              </div>
              <div className="mt-4 space-y-2">
                {plans.map((p) => (
                  <div key={p.plan_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
                    <span className="font-semibold text-white">{p.name} <span className="text-xs text-slate-500">· {p.billing_period} · {p.pricing_model} · {money(p.per_seat_fee, p.currency)}/seat · VAT {p.vat_percent}% · {p.status}</span></span>
                    <button disabled={busy} onClick={() => {
                      if (!window.confirm(t('bill.confirmDefault'))) return;
                      act(() => api.patch(`/billing/plans/${p.plan_id}`, { status: p.status === 'active' ? 'archived' : 'active' }), t('bill.done'));
                    }}
                      className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-white/10">
                      {p.status === 'active' ? t('bill.archive') : t('bill.unarchive')}
                    </button>
                  </div>
                ))}
              </div>
            </>
          } />
      )}

      {tab === 'finance' && summary && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              [t('bill.orgs'), summary.subscriptions.active, '#5b8cff'],
              [t('bill.seatsUsed'), `${summary.subscriptions.allocated_seats}/${summary.subscriptions.paid_seats}`, '#a78bfa'],
              [t('bill.collected'), money(summary.money.gross_collected), '#2dd4bf'],
              [t('bill.outstanding'), money(summary.money.outstanding_invoices), '#fbbf24'],
            ].map(([label, val, color]) => (
              <div key={label} className="glass p-5">
                <p className="truncate font-display text-2xl font-extrabold" style={{ color }}>{val}</p>
                <p className="mt-1 text-xs uppercase tracking-widest text-slate-500">{label}</p>
              </div>
            ))}
          </div>
          <Block title={t('bill.manualQueue')}
            children={
              queue.length === 0 ? <p className="text-sm text-slate-500">{t('bill.empty')}</p> : (
                <div className="space-y-2">
                  {queue.filter((m) => m.status === 'UNDER_REVIEW').map((m) => (
                    <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
                      <span className="text-slate-200">{m.authority_name} · {m.invoice_no} · {money(m.total)} · <span className="text-slate-500">{m.reference}</span></span>
                      <span className="flex gap-2">
                        <button disabled={busy} onClick={() => {
                          if (!window.confirm(t('bill.confirmVerifyPayment'))) return;
                          act(() => api.post(`/billing/manual/${m.id}/verify`, {}), t('bill.done'));
                        }}
                          className="rounded-lg bg-mint/15 px-3 py-1.5 text-xs font-bold text-mint hover:bg-mint/25">{t('bill.verify')}</button>
                        <button disabled={busy} onClick={() => {
                          const note = window.prompt(t('bill.notePh')) || '';
                          act(() => api.post(`/billing/manual/${m.id}/reject`, { note }), t('bill.done'));
                        }} className="rounded-lg bg-rose-500/15 px-3 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-500/25">{t('bill.reject')}</button>
                      </span>
                    </div>
                  ))}
                </div>
              )
            } />
          <Block title={t('bill.txnByStatus')}
            children={
              <div className="flex flex-wrap gap-2 text-xs">
                {summary.money.by_status.map((s) => (
                  <span key={s.status} className="rounded-full bg-white/5 px-3 py-1.5 font-bold text-slate-300">
                    {s.status}: {s.n} · {money(s.amount)}
                  </span>
                ))}
              </div>
            } />
          <Block title={t('bill.failedTxns')}
            children={<FailedTxns act={act} busy={busy} t={t} />} />
          <Block title={t('bill.exports')}
            children={
              <div className="flex flex-wrap gap-2">
                {['payments', 'invoices', 'audit'].map((k) => (
                  <button key={k} disabled={busy} onClick={async () => {
                    setBusy(true);
                    try {
                      const { data } = await api.get(`/billing/export/${k}.csv`, { responseType: 'blob' });
                      const url = URL.createObjectURL(new Blob([data], { type: 'text/csv' }));
                      const a = document.createElement('a');
                      a.href = url; a.download = `nagorik-billing-${k}.csv`; a.click();
                      URL.revokeObjectURL(url);
                    } catch { setMsg({ type: 'err', text: t('bill.exportFail') }); }
                    setBusy(false);
                  }} className="btn-ghost !px-4 !py-2 text-xs">
                    ⬇️ {t('bill.export')} {k}
                  </button>
                ))}
              </div>
            } />
          <Block title={t('bill.gatewayCfg')}
            children={<GatewayStatus t={t} />} />
        </>
      )}

      {tab === 'audit' && (
        <Block title={t('bill.auditLog')}
          children={
            audit.length === 0 ? <p className="text-sm text-slate-500">{t('bill.empty')}</p> : (
              <div className="max-h-[480px] space-y-1.5 overflow-y-auto text-xs">
                {audit.map((a) => (
                  <p key={a.audit_id} className="rounded-lg bg-white/[0.02] px-3 py-2 text-slate-400">
                    <span className="font-bold text-slate-200">{a.action}</span> · {a.actor_type}#{a.actor_id}
                    {a.authority_id ? ` · org ${a.authority_id}` : ''} · {a.outcome} · {a.created_at}
                  </p>
                ))}
              </div>
            )
          } />
      )}
    </main>
  );
}
