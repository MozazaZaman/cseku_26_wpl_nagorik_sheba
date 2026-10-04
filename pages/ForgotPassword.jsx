import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { useLang } from '../lib/i18n.jsx';

export default function ForgotPassword() {
  const { t } = useLang();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await api.post('/auth/forgot-password', { email });
      // Backend never reveals whether the account exists.
      setSent(true);
    } catch (e2) {
      setErr(e2.response?.data?.error || t('fp.err.generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[85vh] max-w-md items-center px-4">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="glass-strong w-full p-8">
        <h1 className="font-display text-2xl font-extrabold text-white">{t('fp.title')}</h1>
        <p className="mt-1 text-sm text-slate-400">{t('fp.sub')}</p>

        {sent ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {t('fp.sent')}
            </div>
            <button
              onClick={() => nav('/verify-otp', { state: { email } })}
              className="btn-primary w-full !py-3.5"
            >
              {t('fp.enterCode')}
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="label">{t('fp.email')}</label>
              <input className="input" type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            {err && <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300">{err}</p>}
            <button disabled={busy} className="btn-primary w-full !py-3.5 disabled:opacity-60">
              {busy ? '…' : t('fp.sendCode')}
            </button>
          </form>
        )}

        <p className="mt-5 text-center text-sm text-slate-400">
          {t('fp.remember')}{' '}
          <Link to="/login" className="font-semibold text-accent hover:underline">{t('fp.login')}</Link>
        </p>
      </motion.div>
    </main>
  );
}
