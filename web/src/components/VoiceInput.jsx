import { useEffect, useRef, useState } from 'react';
import { useLang } from '../lib/i18n.jsx';

export default function VoiceInput({ onText }) {
  const { t } = useLang();
  const [listening, setListening] = useState(false);
  const [lang, setLang] = useState('bn-BD');
  const [supported, setSupported] = useState(true);
  const recRef = useRef(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const text = Array.from(e.results)
        .slice(e.resultIndex)
        .map((r) => r[0].transcript)
        .join(' ');
      onText(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    return () => rec.abort();
  }, [onText, lang]);

  const toggle = () => {
    if (!supported) return;
    if (listening) {
      recRef.current.stop();
      setListening(false);
    } else {
      recRef.current.lang = lang;
      recRef.current.start();
      setListening(true);
    }
  };

  if (!supported) return null;

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={toggle}
        className={`relative inline-flex h-12 w-12 items-center justify-center rounded-full text-xl transition ${
          listening ? 'bg-rose-500/25 text-rose-300' : 'bg-accent/15 text-accent hover:bg-accent/30'
        }`}
        title={listening ? t('sub.listening') : t('sub.voice')}
      >
        {listening && <span className="absolute inset-0 animate-pulseRing rounded-full border-2 border-rose-400" />}
        {listening ? '■' : '🎤'}
      </button>
      <div className="leading-tight">
        <p className="text-sm font-semibold text-slate-200">
          {listening ? t('sub.listening') : t('sub.voice')}
        </p>
        <button
          type="button"
          onClick={() => setLang(lang === 'bn-BD' ? 'en-US' : 'bn-BD')}
          className="text-xs font-semibold text-accent hover:underline"
        >
          {lang === 'bn-BD' ? 'ভাষা: বাংলা (চাপ দিন)' : 'Language: বাংলা (tap to switch)'}
        </button>
      </div>
    </div>
  );
}
