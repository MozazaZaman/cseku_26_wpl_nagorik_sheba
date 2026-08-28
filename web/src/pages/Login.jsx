import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../store/auth.jsx';
import { useLang } from '../lib/i18n.jsx';

export default function Login() {
  const { login } = useAuth();
  const { t } = useLang();
  const nav = useNavigate();
  const loc = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const user = await login(form.email, form.password);
      nav(user.role === 'staff' ? '/staff' : loc.state?.from || '/dashboard');
    } catch (e2) {
      setErr(e2.response?.data?.error || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[85vh] max-w-md items-center px-4">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="glass-strong w-full p-8">
        <h1 className="font-display text-2xl font-extrabold text-white">{t('login.title')}</h1>
        <p className="mt-1 text-sm text-slate-400">{t('login.sub')}</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="label">{t('login.email')}</label>
            <input className="input" type="email" required value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
          </div>
          <div>
            <label className="label">{t('login.password')}</label>
            <input className="input" type="password" required value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
          </div>
          {err && <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300">{err}</p>}
          <button disabled={busy} className="btn-primary w-full !py-3.5 disabled:opacity-60">
            {busy ? '…' : t('login.btn')}
          </button>
        </form>

        <div className="mt-5 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-xs leading-relaxed text-slate-500">
          <p className="font-semibold text-slate-400">{t('login.demo')}</p>
          <p>Citizen: rahim@example.com / password123</p>
          <p>Staff (City Corp): shirin.city@nagorik.bd / staff123</p>
        </div>

        <p className="mt-5 text-center text-sm text-slate-400">
          {t('login.new')}{' '}
          <Link to="/register" className="font-semibold text-accent hover:underline">{t('login.create')}</Link>
        </p>
      </motion.div>
    </main>
  );
}
