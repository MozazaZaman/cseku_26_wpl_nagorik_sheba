import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useLang } from '../lib/i18n.jsx';
import { useAuth } from '../store/auth.jsx';

export default function AssistantWidget() {
  const { user } = useAuth();
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState([]);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  // Show only for logged-in citizens (same scope logic as NotificationBell).
  const visible = user?.role === 'citizen';

  useEffect(() => {
    if (!visible) {
      setMessages([]);
      setInput('');
      setError('');
      setOpen(false);
    }
  }, [visible]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Keep the latest message scrolled into view.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy, open]);

  const send = async (event) => {
    event?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;

    const history = messages.map((m) => ({ role: m.role, text: m.text }));
    const next = [...messages, { role: 'user', text }];
    setMessages(next);
    setInput('');
    setBusy(true);
    setError('');

    try {
      const { data } = await api.post('/assistant/chat', {
        message: text,
        conversation_history: history
      });
      setMessages((current) => [...current, { role: 'model', text: data.reply }]);
    } catch (err) {
      const msg = err.response?.data?.error || t('assistant.error');
      setError(msg);
      setMessages((current) => [...current, { role: 'model', text: msg }]);
    } finally {
      setBusy(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-5 right-4 z-50 sm:bottom-6 sm:right-6">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="mb-3 flex h-[min(72vh,30rem)] w-[min(92vw,23rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-night/95 shadow-2xl shadow-black/40 backdrop-blur-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent2 text-sm">
                  🤖
                </span>
                <div className="leading-tight">
                  <p className="text-sm font-semibold text-white">{t('assistant.title')}</p>
                  <p className="text-[11px] text-slate-500">{t('assistant.sub')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t('assistant.close')}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-white"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
              {messages.length === 0 && (
                <div className="rounded-xl bg-white/5 px-3.5 py-3 text-sm text-slate-400">
                  {t('assistant.greeting')}
                </div>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <p
                    className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'rounded-br-md bg-accent text-onaccent'
                        : 'rounded-bl-md bg-white/5 text-slate-200'
                    }`}
                  >
                    {m.text}
                  </p>
                </div>
              ))}
              {busy && (
                <div className="flex justify-start">
                  <div className="flex gap-1.5 rounded-2xl rounded-bl-md bg-white/5 px-4 py-3">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="h-2 w-2 rounded-full bg-slate-400"
                        animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {error && messages.length === 0 && (
              <p className="px-4 pb-2 text-xs text-rose-300">{error}</p>
            )}

            {/* Input */}
            <form onSubmit={send} className="border-t border-white/5 p-3">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder={t('assistant.placeholder')}
                  aria-label={t('assistant.placeholder')}
                  className="input !py-2.5"
                  disabled={busy}
                />
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  aria-label={t('assistant.send')}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-onaccent transition hover:bg-accent/90 disabled:cursor-wait disabled:opacity-50"
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M22 2L11 13" />
                    <path d="M22 2l-7 20-4-9-9-4 20-7z" />
                  </svg>
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating button */}
      <motion.button
        type="button"
        onClick={() => setOpen((current) => !current)}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.95 }}
        aria-label={t('assistant.title')}
        title={t('assistant.title')}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent2 text-white shadow-glow"
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 1 1 16.1-3.8z" />
          </svg>
        )}
      </motion.button>
    </div>
  );
}
