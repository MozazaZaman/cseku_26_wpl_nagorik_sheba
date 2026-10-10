import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { useLang } from '../lib/i18n.jsx';

/** Public staff join request — creates a pending registration, grants nothing. */
export default function StaffJoin() {
  const { t } = useLang();
  const [geo, setGeo] = useState({ divisions: [] });
  const [authorities, setAuthorities] = useState([]);
  const [form, setForm] = useState({
    authority_id: '', full_name: '', email: '', phone: '',
    staff_role_requested: 'junior', department: 'general', employee_ref: ''
  });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/geo').then(({ data }) => setGeo(data)).catch(() => {});
  }, []);

  const searchAuth = async (district) => {
    if (!district) return setAuthorities([]);
    try {
      const { data } = await api.get('/authorities', { params: { district } });
      setAuthorities(data.authorities || []);
    } catch {}
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      await api.post('/billing/staff-requests', { ...form, authority_id: Number(form.authority_id) });
      setMsg({ type: 'ok', text: t('bill.joinDone') });
      setForm({ authority_id: '', full_name: '', email: '', phone: '', staff_role_requested: 'junior', department: 'general', employee_ref: '' });
    } catch (err) {
      setMsg({ type: 'err', text: err.response?.data?.error || '…' });
    } finally { setBusy(false); }
  };

  return (
    <main className="mx-auto max-w-2xl px-4 pb-12 pt-10 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-3xl font-extrabold text-white">{t('bill.joinTitle')}<span className="text-gradient">{t('bill.joinHl')}</span></h1>
        <p className="mt-2 text-slate-400">{t('bill.joinSub')}</p>
      </motion.div>
      {msg && (
        <p className={`mt-4 rounded-xl border px-4 py-2.5 text-sm ${msg.type === 'ok' ? 'border-mint/30 bg-mint/10 text-mint' : 'border-rose-400/30 bg-rose-500/10 text-rose-300'}`}>{msg.text}</p>
      )}
      <form onSubmit={submit} className="glass mt-6 grid gap-4 p-5 sm:p-6 sm:grid-cols-2">
        <div>
          <label className="label">{t('bill.district')}</label>
          <select className="input" onChange={(e) => searchAuth(e.target.value)} defaultValue="">
            <option value="">{t('analysis.allDistricts')}</option>
            {(geo.divisions || []).flatMap((d) => d.districts || []).sort().map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{t('bill.organization')}</label>
          <select className="input" required value={form.authority_id} onChange={(e) => setForm({ ...form, authority_id: e.target.value })}>
            <option value="">{t('bill.pickOrg')}</option>
            {authorities.map((a) => <option key={a.authority_id} value={a.authority_id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{t('reg.name')}</label>
          <input className="input" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </div>
        <div>
          <label className="label">{t('fp.email')}</label>
          <input className="input" required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className="label">{t('reg.phone')}</label>
          <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <label className="label">{t('bill.reqRole')}</label>
          <select className="input" value={form.staff_role_requested} onChange={(e) => setForm({ ...form, staff_role_requested: e.target.value })}>
            {['junior', 'senior', 'mayor', 'wit', 'field'].map((r) => <option key={r} value={r}>{t(`wf.roleBadge.${r}`) || r}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">{t('bill.empRef')}</label>
          <input className="input" value={form.employee_ref} onChange={(e) => setForm({ ...form, employee_ref: e.target.value })} placeholder={t('bill.empRefPh')} />
        </div>
        <div className="sm:col-span-2">
          <button disabled={busy} className="btn-primary w-full">{busy ? '…' : t('bill.submitJoin')}</button>
        </div>
      </form>
      <p className="mt-4 text-center text-sm text-slate-500">
        <Link to="/login" className="text-accent hover:underline">{t('nav.login')}</Link>
      </p>
    </main>
  );
}
