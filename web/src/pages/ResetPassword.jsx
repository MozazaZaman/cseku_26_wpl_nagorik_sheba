import { useState } from 'react';
import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { useLang } from '../lib/i18n.jsx';
import PasswordInput from '../components/PasswordInput.jsx';

export default function ResetPassword() {
  const { t } = useLang();
  const nav = useNavigate();
  const loc = useLocation();
  const resetToken = loc.state?.reset_token;
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // No token from step 2 → nothing to reset; go request a code first.
  if (!resetToken) return <Navigate to="/forgot-password" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (password.length < 6) return setErr(t('fp.err.pass'));
    if (password !== confirm) return setErr(t('fp.err.match'));
    setBusy(true);
    try {
      await api.post('/auth/reset-password', { reset_token: resetToken, new_password: password });
      nav('/login', { state: { resetDone: true } });
    } catch (e2) {
      setErr(e2.response?.data?.error || t('fp.err.generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[85vh] max-w-md items-center px-4">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="glass-strong w-full p-8">
        <h1 className="font-display text-2xl font-extrabold text-white">{t('fp.resetTitle')}</h1>
        <p className="mt-1 text-sm text-slate-400">{t('fp.resetSub')}</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="label">{t('fp.newPassword')}</label>
            <PasswordInput required value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <div>
            <label className="label">{t('fp.confirmPassword')}</label>
            <PasswordInput required value={confirm}
              onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
          </div>
          {err && <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300">{err}</p>}
          <button disabled={busy} className="btn-primary w-full !py-3.5 disabled:opacity-60">
            {busy ? '…' : t('fp.resetBtn')}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-400">
          {t('fp.remember')}{' '}
          <Link to="/login" className="font-semibold text-accent hover:underline">{t('fp.login')}</Link>
        </p>
      </motion.div>
    </main>
  );
}
