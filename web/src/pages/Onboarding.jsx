import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { useAuth } from '../store/auth.jsx';
import { useLang } from '../lib/i18n.jsx';

/** LGI onboarding request + my requests with verification status. */
export default function Onboarding() {
  const { user } = useAuth();
  const { t } = useLang();
  const [mine, setMine] = useState([]);
  const [plans, setPlans] = useState([]);
  const [geo, setGeo] = useState({ divisions: [] });
  const [form, setForm] = useState({
    name: '', type: 'POUROSHOVA', division: '', district: '', authority_id: '', address: '',
    contact_email: '', contact_phone: '', rep_name: '', rep_designation: '',
    requested_seats: 10, plan_id: ''
  });
  const [authorities, setAuthorities] = useState([]);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/billing/plans').then(({ data }) => setPlans(data.plans)).catch(() => {});
    api.get('/geo').then(({ data }) => setGeo(data)).catch(() => {});
    if (user) api.get('/billing/organizations/mine').then(({ data }) => setMine(data.organizations)).catch(() => {});
  }, [user]);

  if (!user) {
    return (
      <main className="mx-auto max-w-md px-4 pt-24 text-center">
        <h1 className="font-display text-2xl font-extrabold text-white">{t('bill.onboardTitle')}</h1>
        <p className="mt-2 text-slate-400">{t('bill.loginFirst')}</p>
        <Link to="/login" className="btn-primary mt-6">{t('nav.login')}</Link>
      </main>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const { data } = await api.post('/billing/onboarding', { ...form, requested_seats: Number(form.requested_seats), plan_id: form.plan_id ? Number(form.plan_id) : null, authority_id: form.authority_id ? Number(form.authority_id) : null });
      setMsg({ type: 'ok', text: `${t('bill.onboardDone')} (#${data.organization.org_id})` });
      const { data: m } = await api.get('/billing/organizations/mine');
      setMine(m.organizations);
    } catch (err) {
      setMsg({ type: 'err', text: err.response?.data?.error || '…' });
    } finally { setBusy(false); }
  };

  const F = (k, label, extra = {}) => (
    <div>
      <label className="label">{label}</label>
      <input className="input" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} {...extra} />
    </div>
  );

  return (
    <main className="mx-auto max-w-3xl px-4 pb-12 pt-10 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-3xl font-extrabold text-white">{t('bill.onboardTitle')}<span className="text-gradient">{t('bill.onboardHl')}</span></h1>
        <p className="mt-2 text-slate-400">{t('bill.onboardSub')}</p>
      </motion.div>

      {msg && (
        <p className={`mt-4 rounded-xl border px-4 py-2.5 text-sm ${msg.type === 'ok' ? 'border-mint/30 bg-mint/10 text-mint' : 'border-rose-400/30 bg-rose-500/10 text-rose-300'}`}>{msg.text}</p>
      )}

      <form onSubmit={submit} className="glass mt-6 grid gap-4 p-5 sm:p-6 sm:grid-cols-2">
        <div className="sm:col-span-2">{F('name', t('bill.orgName'))}</div>
        <div>
          <label className="label">{t('bill.orgType')}</label>
          <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="CITY_CORPORATION">{t('an.type.CITY_CORPORATION')}</option>
            <option value="POUROSHOVA">{t('an.type.POUROSHOVA')}</option>
            <option value="UNION_PARISHAD">{t('an.type.UNION_PARISHAD')}</option>
          </select>
        </div>
        <div>
          <label className="label">{t('bill.division')}</label>
          <select className="input" value={form.division} onChange={(e) => setForm({ ...form, division: e.target.value, district: '' })}>
            <option value="">{t('analysis.allDivisions')}</option>
            {(geo.divisions || []).map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{t('bill.district')}</label>
          <select className="input" value={form.district} onChange={(e) => {
            const district = e.target.value;
            setForm({ ...form, district, authority_id: '' });
            setAuthorities([]);
            if (district) api.get('/authorities', { params: { district } }).then(({ data }) => setAuthorities(data.authorities || [])).catch(() => {});
          }}>
            <option value="">{t('analysis.allDistricts')}</option>
            {((geo.divisions || []).find((d) => d.name === form.division)?.districts || []).map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{t('bill.mapAuthority')}</label>
          <select className="input" value={form.authority_id} onChange={(e) => setForm({ ...form, authority_id: e.target.value })}>
            <option value="">{t('bill.mapAuthorityPh')}</option>
            {authorities.map((a) => <option key={a.authority_id} value={a.authority_id}>{a.name} ({a.type})</option>)}
          </select>
        </div>
        {F('address', t('bill.address'))}
        {F('contact_email', t('bill.contactEmail'), { type: 'email' })}
        {F('contact_phone', t('bill.contactPhone'))}
        {F('rep_name', t('bill.repName'))}
        {F('rep_designation', t('bill.repDesig'))}
        {F('requested_seats', t('bill.reqSeats'), { type: 'number', min: 1 })}
        <div>
          <label className="label">{t('bill.plan')}</label>
          <select className="input" value={form.plan_id} onChange={(e) => setForm({ ...form, plan_id: e.target.value })}>
            <option value="">{t('bill.defaultPlan')}</option>
            {plans.map((p) => <option key={p.plan_id} value={p.plan_id}>{p.name} ({p.billing_period})</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <button disabled={busy} className="btn-primary w-full">{busy ? '…' : t('bill.submitOnboard')}</button>
        </div>
      </form>

      {mine.length > 0 && (
        <div className="glass mt-6 p-5">
          <h2 className="font-display text-lg font-bold text-white">{t('bill.myRequests')}</h2>
          <div className="mt-3 space-y-2">
            {mine.map((o) => (
              <div key={o.org_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
                <span className="font-semibold text-white">{o.name}</span>
                <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-bold text-slate-300">{o.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
