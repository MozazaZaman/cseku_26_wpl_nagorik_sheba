import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../store/auth.jsx';
import { useLang } from '../lib/i18n.jsx';

export default function Register() {
  const { registerWithFace } = useAuth();
  const { t } = useLang();
  const nav = useNavigate();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [rejected, setRejected] = useState(null);

  const [selfie, setSelfie] = useState(null);
  const [idPhoto, setIdPhoto] = useState(null);
  const [camMode, setCamMode] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const selfieInputRef = useRef(null);
  const idInputRef = useRef(null);

  const stopCam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCamMode(null);
  };

  const startCam = async (facing) => {
    stopCam();
    setErr('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false
      });
      streamRef.current = stream;
      setCamMode(facing);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 60);
    } catch {
      setErr(t('reg.cameraDenied'));
    }
  };

  useEffect(() => () => stopCam(), []);

  const grabFrame = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  };

  const captureSelfie = async () => {
    const blob = await grabFrame();
    if (!blob) return setErr(t('reg.captureFail'));
    setSelfie({ blob, url: URL.createObjectURL(blob) });
    stopCam();
    setErr('');
  };

  const captureId = async () => {
    const blob = await grabFrame();
    if (!blob) return setErr(t('reg.captureFail'));
    setIdPhoto({ blob, url: URL.createObjectURL(blob) });
    stopCam();
    setErr('');
  };

  const validateStep1 = () => {
    if (!form.full_name || !form.email) return t('reg.err.nameEmail');
    if (form.password.length < 6) return t('reg.err.pass');
    return null;
  };

  const next = () => {
    setErr('');
    if (step === 0) {
      const v = validateStep1();
      if (v) return setErr(v);
      setStep(1);
    } else if (step === 1) {
      if (!selfie) return setErr(t('reg.needSelfie'));
      setStep(2);
    } else if (step === 2) {
      if (!idPhoto) return setErr(t('reg.needId'));
      setStep(3);
    }
  };

  const submit = async () => {
    setErr('');
    setBusy(true);
    setRejected(null);
    try {
      const fd = new FormData();
      fd.append('full_name', form.full_name);
      fd.append('email', form.email);
      fd.append('phone', form.phone);
      fd.append('password', form.password);
      fd.append('selfie', selfie.blob, 'selfie.jpg');
      fd.append('id_photo', idPhoto.blob, 'id-card.jpg');
      await registerWithFace(fd);
      nav('/dashboard');
    } catch (e) {
      const d = e.response?.data;
      if (d?.rejected) {
        setRejected(d.error || t('reg.rejected.title'));
        setSelfie(null);
        setIdPhoto(null);
        setStep(1);
      } else {
        setErr(d?.error || t('reg.err.fail'));
      }
    } finally {
      setBusy(false);
    }
  };

  const fileToState = (file, setter) => {
    if (!file) return;
    setter({ blob: file, url: URL.createObjectURL(file) });
    setErr('');
  };

  const steps = [t('reg.step1'), t('reg.step2'), t('reg.step3'), t('reg.step4')];

  return (
    <main className="mx-auto flex min-h-[90vh] max-w-lg flex-col justify-center px-4 py-10">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="glass-strong p-8">
        <h1 className="font-display text-2xl font-extrabold text-white">{t('reg.title')}</h1>
        <p className="mt-1 text-sm text-slate-400">{t('reg.sub')}</p>

        <div className="mt-6 flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={s} className="flex flex-1 flex-col gap-1.5">
              <div className={`h-1.5 rounded-full transition-all ${i <= step ? 'bg-gradient-to-r from-accent to-accent3' : 'bg-white/10'}`} />
              <span className={`text-[10px] font-bold uppercase tracking-wider ${i <= step ? 'text-accent' : 'text-slate-600'}`}>
                {i + 1}. {s}
              </span>
            </div>
          ))}
        </div>

        {rejected && (
          <div className="mt-5 rounded-xl border border-rose-400/40 bg-rose-500/10 p-4">
            <p className="font-display font-bold text-rose-300">{t('reg.rejected.title')}</p>
            <p className="mt-1 text-sm text-slate-300">{rejected}</p>
            <p className="mt-1 text-xs text-slate-500">{t('reg.rejected.tips')}</p>
          </div>
        )}

        {step === 0 && (
          <div className="mt-6 space-y-4">
            <div>
              <label className="label">{t('reg.name')}</label>
              <input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder={t('reg.name.ph')} />
            </div>
            <div>
              <label className="label">{t('reg.email')}</label>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder={t('reg.email.ph')} />
            </div>
            <div>
              <label className="label">{t('reg.phone')}</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder={t('reg.phone.ph')} />
            </div>
            <div>
              <label className="label">{t('reg.password')}</label>
              <input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={t('reg.pass.ph')} />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="mt-6">
            <p className="label">{t('reg.selfie.label')}</p>
            <div className="relative mt-2 overflow-hidden rounded-2xl border border-white/10 bg-black/40" style={{ minHeight: 260 }}>
              {camMode ? (
                <video ref={videoRef} playsInline muted className="h-full w-full object-cover" style={{ minHeight: 260 }} />
              ) : selfie ? (
                <img src={selfie.url} alt="selfie preview" className="mx-auto h-full max-h-[300px] object-contain" />
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-500">
                  <span className="text-4xl">🤳</span>
                  <p className="text-sm">{t('reg.selfie.empty')}</p>
                </div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {!camMode && !selfie && (
                <button onClick={() => startCam('user')} className="btn-primary !py-2.5 text-sm">{t('reg.openCam')}</button>
              )}
              {camMode && (
                <button onClick={captureSelfie} className="btn-primary !py-2.5 text-sm">📸 {t('reg.capture')}</button>
              )}
              {selfie && (
                <button onClick={() => { setSelfie(null); startCam('user'); }} className="btn-ghost !py-2.5 text-sm">{t('reg.retake')}</button>
              )}
              {!selfie && !camMode && (
                <button onClick={() => selfieInputRef.current?.click()} className="btn-ghost !py-2.5 text-sm">{t('reg.uploadInstead')}</button>
              )}
              <input ref={selfieInputRef} type="file" accept="image/*" hidden onChange={(e) => fileToState(e.target.files[0], setSelfie)} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="mt-6">
            <p className="label">{t('reg.id.label')}</p>
            <div className="relative mt-2 overflow-hidden rounded-2xl border border-white/10 bg-black/40" style={{ minHeight: 260 }}>
              {camMode ? (
                <video ref={videoRef} playsInline muted className="h-full w-full object-cover" style={{ minHeight: 260 }} />
              ) : idPhoto ? (
                <img src={idPhoto.url} alt="id preview" className="mx-auto h-full max-h-[300px] object-contain" />
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-500">
                  <span className="text-4xl">🪪</span>
                  <p className="text-sm">{t('reg.id.empty')}</p>
                  <p className="text-xs text-slate-600">{t('reg.id.hint')}</p>
                </div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => idInputRef.current?.click()} className="btn-primary !py-2.5 text-sm">
                {idPhoto ? t('reg.id.reupload') : t('reg.id.upload')}
              </button>
              <input
                ref={idInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={(e) => fileToState(e.target.files[0], setIdPhoto)}
              />
              {!camMode && !idPhoto && (
                <button onClick={() => startCam('environment')} className="btn-ghost !py-2.5 text-sm">{t('reg.useRear')}</button>
              )}
              {camMode && (
                <button onClick={captureId} className="btn-primary !py-2.5 text-sm">📸 {t('reg.captureId')}</button>
              )}
              {idPhoto && (
                <button onClick={() => setIdPhoto(null)} className="btn-ghost !py-2.5 text-sm">{t('reg.remove')}</button>
              )}
            </div>
            <p className="mt-3 text-xs text-slate-500">{t('reg.id.note')}</p>
          </div>
        )}

        {step === 3 && (
          <div className="mt-6 space-y-4">
            <div className="glass p-4">
              <p className="label">{t('reg.ready')}</p>
              <div className="mt-2 flex items-center gap-4">
                {selfie && <img src={selfie.url} alt="selfie" className="h-24 w-24 rounded-xl border border-white/10 object-cover" />}
                <span className="text-2xl text-slate-500">⇄</span>
                {idPhoto && <img src={idPhoto.url} alt="id" className="h-24 w-24 rounded-xl border border-white/10 object-cover" />}
              </div>
              <p className="mt-3 text-sm text-slate-400">{t('reg.ready.desc')}</p>
            </div>
            <div className="glass p-4 text-sm">
              <p><span className="text-slate-500">{t('reg.name')}:</span> {form.full_name}</p>
              <p><span className="text-slate-500">{t('reg.email')}:</span> {form.email}</p>
            </div>
          </div>
        )}

        {err && <p className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300">{err}</p>}

        <div className="mt-6 flex gap-3">
          {step > 0 && !busy && (
            <button onClick={() => { setErr(''); stopCam(); setStep(step - 1); }} className="btn-ghost">{t('reg.back')}</button>
          )}
          {step < 3 && <button onClick={next} className="btn-primary flex-1 !py-3.5">{t('reg.continue')}</button>}
          {step === 3 && (
            <button onClick={submit} disabled={busy} className="btn-primary flex-1 !py-3.5 disabled:opacity-60">
              {busy ? t('reg.verifying') : t('reg.verifyBtn')}
            </button>
          )}
        </div>

        <p className="mt-5 text-center text-sm text-slate-400">
          {t('reg.member')} <Link to="/login" className="font-semibold text-accent hover:underline">{t('reg.login')}</Link>
          <span className="mt-1 block text-xs text-slate-600">{t('reg.unchanged')}</span>
        </p>
      </motion.div>
    </main>
  );
}
