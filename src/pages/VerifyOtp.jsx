import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { useLang } from '../lib/i18n.jsx';

export default function VerifyOtp() {
  const { t } = useLang();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState(loc.state?.email || '');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const { data } = await api.post('/auth/verify-otp', { email, otp: code });
      // The reset token is the only ticket to step 3 — never just client state.
      nav('/reset-password', { state: { reset_token: data.reset_token, email } });
    } catch (e2) {
      setErr(e2.response?.data?.error || t('fp.err.generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[85vh] max-w-md items-center px-4">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="glass-strong w-full p-8">
        <h1 className="font-display text-2xl font-extrabold text-white">{t('fp.otpTitle')}</h1>
        <p className="mt-1 text-sm text-slate-400">{t('fp.otpSub')}</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="label">{t('fp.email')}</label>
            <input className="input" type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <label className="label">{t('fp.code')}</label>
            <input
              className="input text-center text-lg tracking-[0.5em]"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="------"
            />
          </div>
          {err && <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300">{err}</p>}
          <button disabled={busy} className="btn-primary w-full !py-3.5 disabled:opacity-60">
            {busy ? '…' : t('fp.verifyBtn')}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-400">
          {t('fp.noCode')}{' '}
          <Link to="/forgot-password" className="font-semibold text-accent hover:underline">{t('fp.resend')}</Link>
        </p>
      </motion.div>
    </main>
  );
}
