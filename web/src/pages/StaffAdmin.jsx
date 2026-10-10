import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../store/auth.jsx';
import { useLang } from '../lib/i18n.jsx';

const ROLES = ['junior', 'senior', 'mayor', 'wit', 'field', 'admin'];

/**
 * LGI Staff Administration — for the Technical Admin (and the Mayor).
 * People management only: create accounts, assign roles/departments,
 * reset passwords, deactivate leavers. No money moves here; creating or
 * reactivating consumes one license seat and fails clearly when none is free.
 */
export default function StaffAdmin() {
  const { user } = useAuth();
  const { t } = useLang();
  const [staff, setStaff] = useState([]);
  const [seats, setSeats] = useState(null);
  const [dept, setDept] = useState('all');
  const [showInactive, setShowInactive] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', password: '', staff_role: 'junior', department: 'general' });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const allowed = user?.role === 'staff' && user.staff_role === 'admin';

  const load = async () => {
    const [{ data: s }, { data: b }] = await Promise.all([
      api.get('/billing/staff'), api.get('/billing/seats')
    ]);
    setStaff(s.staff);
    setSeats({ ...b.seats, policy: b.policy });
  };

  useEffect(() => { if (allowed) load().catch(() => {}); }, [allowed]);

  if (!allowed) {
    return (
      <main className="mx-auto max-w-md px-4 pt-24 text-center">
        <h1 className="font-display text-2xl font-extrabold text-white">{t('sadmin.title')}</h1>
        <p className="mt-2 text-slate-400">{t('sadmin.onlySub')}</p>
        <Link to="/login" className="btn-primary mt-6">{t('nav.login')}</Link>
      </main>
    );
  }

  const act = async (fn, okMsg) => {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg({ type: 'ok', text: okMsg }); await load(); }
    catch (e) { setMsg({ type: 'err', text: e.response?.data?.error || '…' }); }
    finally { setBusy(false); }
  };

  const departments = [...new Set(staff.map((s) => s.department || 'general'))];
  const visible = staff.filter((s) => (showInactive || s.is_active) && (dept === 'all' || (s.department || 'general') === dept));
  const canTouch = (s) => {
    if (user.staff_role === 'admin' && s.staff_role === 'mayor') return false;
    return true;
  };

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12 pt-10 sm:px-6">
      <p className="text-[11px] font-bold uppercase tracking-widest text-accent">👥 {user.authority_name}</p>
      <h1 className="mt-1 font-display text-3xl font-extrabold text-white">{t('sadmin.title')}<span className="text-gradient">{t('sadmin.titleHl')}</span></h1>
      <p className="mt-2 max-w-3xl text-slate-400">{t('sadmin.sub')}</p>

      {msg && (
        <p className={`mt-4 rounded-xl border px-4 py-2.5 text-sm ${msg.type === 'ok' ? 'border-mint/30 bg-mint/10 text-mint' : 'border-rose-400/30 bg-rose-500/10 text-rose-300'}`}>{msg.text}</p>
      )}

      {seats && (
        <div className="glass mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
          <span><span className="text-slate-500">{t('bill.available')}: </span>
            <span className="font-extrabold text-mint">{seats.mode === 'legacy' ? t('bill.unlimited') : seats.available}</span>
            <span className="text-slate-500"> / {seats.mode === 'legacy' ? '∞' : seats.paid}</span>
          </span>
          <span className="text-xs text-slate-500">{t('sadmin.seatHint')}</span>
        </div>
      )}

      <section className="glass mt-6 p-5 sm:p-6">
        <h2 className="font-display text-lg font-bold text-white">{t('sadmin.create')}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="label">{t('reg.name')}</label>
            <input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div>
            <label className="label">{t('fp.email')}</label>
            <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label">{t('sadmin.tempPass')}</label>
            <input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="8+ characters" />
          </div>
          <div>
            <label className="label">{t('bill.reqRole')}</label>
            <select className="input" value={form.staff_role} onChange={(e) => setForm({ ...form, staff_role: e.target.value })}>
              {ROLES.filter((r) => user.staff_role === 'mayor' ? true : !['mayor', 'admin'].includes(r)).map((r) => (
                <option key={r} value={r}>{t(`wf.roleBadge.${r}`) || r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t('sadmin.department')}</label>
            <input className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="general" />
          </div>
          <div className="flex items-end">
            <button disabled={busy} onClick={() => {
              if (!window.confirm(t('bill.confirmCreateStaff'))) return;
              act(() => api.post('/billing/staff', form), t('sadmin.created'));
            }}
              className="btn-primary w-full !py-3 text-sm">{t('sadmin.createBtn')}</button>
          </div>
        </div>
      </section>

      <section className="glass mt-6 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-white">{t('sadmin.directory')} ({visible.length})</h2>
          <div className="flex flex-wrap items-center gap-2">
            <select className="input !w-auto !py-2 text-xs" value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="all">{t('sadmin.allDepts')}</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <button onClick={() => setShowInactive((v) => !v)} className={`chip ${showInactive ? 'chip-active' : 'chip-idle'}`}>
              {t('sadmin.showInactive')}
            </button>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {visible.map((s) => (
            <div key={s.staff_id} className={`rounded-xl border p-3 text-sm ${s.is_active ? 'border-white/10 bg-white/[0.03]' : 'border-white/5 bg-white/[0.01] opacity-60'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{s.full_name} <span className="text-xs font-normal text-slate-500">· {s.email}</span></p>
                  <p className="text-xs text-slate-500">{t(`wf.roleBadge.${s.staff_role}`) || s.staff_role} · {s.department || 'general'} · {s.is_active ? t('sadmin.active') : t('sadmin.inactive')}</p>
                </div>
                {canTouch(s) && (
                  <div className="flex flex-wrap items-center gap-2">
                    <select className="input !w-auto !py-1.5 text-xs" value={s.staff_role}
                      onChange={(e) => {
                        if (!window.confirm(t('bill.confirmRole'))) return;
                        act(() => api.patch(`/billing/staff/${s.staff_id}`, { staff_role: e.target.value }), t('bill.done'));
                      }}>
                      {ROLES.filter((r) => !['mayor', 'admin'].includes(r)).map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    <button disabled={busy} onClick={() => {
                      const pw = window.prompt(t('sadmin.newPass'));
                      if (pw && window.confirm(t('bill.confirmResetPw'))) {
                        act(() => api.post(`/billing/staff/${s.staff_id}/reset-password`, { password: pw }), t('bill.done'));
                      }
                    }} className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-white/10">{t('sadmin.resetPw')}</button>
                    {s.is_active ? (
                      <button disabled={busy || s.staff_id === user.id} onClick={() => {
                        if (!window.confirm(t('bill.confirmDeactivate'))) return;
                        act(() => api.post(`/billing/staff/${s.staff_id}/deactivate`, {}), t('bill.done'));
                      }}
                        className="rounded-lg bg-rose-500/15 px-3 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-500/25">{t('sadmin.deactivate')}</button>
                    ) : (
                      <button disabled={busy} onClick={() => {
                        if (!window.confirm(t('bill.confirmReactivate'))) return;
                        act(() => api.post(`/billing/staff/${s.staff_id}/reactivate`, {}), t('bill.done'));
                      }}
                        className="rounded-lg bg-mint/15 px-3 py-1.5 text-xs font-bold text-mint hover:bg-mint/25">{t('sadmin.reactivate')}</button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {visible.length === 0 && <p className="text-sm text-slate-500">{t('bill.empty')}</p>}
        </div>
      </section>
    </main>
  );
}
