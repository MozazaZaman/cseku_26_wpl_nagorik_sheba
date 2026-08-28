import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api, CATEGORIES } from '../lib/api';
import { useAuth } from '../store/auth.jsx';
import { useLang, categoryLabel } from '../lib/i18n.jsx';
import MapPanel from '../components/MapPanel.jsx';
import VoiceInput from '../components/VoiceInput.jsx';

const emptyAddr = {
  division: '', district: '', type: 'CITY_CORPORATION', authority_id: '',
  ward: '', road: '', sector: '', village: '', upazila: '', area_text: ''
};

export default function Submit() {
  const { user } = useAuth();
  const { t, lang } = useLang();
  const nav = useNavigate();
  const fileRef = useRef(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryHint, setCategoryHint] = useState('auto');
  const [image, setImage] = useState(null);
  const [loc, setLoc] = useState({ lat: 23.7385, lng: 90.3965 });
  const [address, setAddress] = useState('');
  const [locMode, setLocMode] = useState('gps');
  const [geo, setGeo] = useState({ divisions: [] });
  const [authorities, setAuthorities] = useState([]);
  const [addr, setAddr] = useState(emptyAddr);
  const [geocoding, setGeocoding] = useState(false);
  const [geoNote, setGeoNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState(null);
  const [geoState, setGeoState] = useState('detecting');
  const [recenterSignal, setRecenterSignal] = useState(0);

  useEffect(() => {
    if (!user) nav('/login', { state: { from: '/submit' } });
  }, [user]);

  useEffect(() => {
    api.get('/geo').then(({ data }) => setGeo(data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoState('fallback');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLoc({ lat: p.coords.latitude, lng: p.coords.longitude });
        setGeoState('auto');
        setRecenterSignal((s) => s + 1);
      },
      () => setGeoState('fallback'),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  useEffect(() => {
    if (locMode !== 'address') return;
    const params = {};
    if (addr.district) params.district = addr.district;
    if (addr.type) params.type = addr.type;
    api.get('/authorities', { params }).then(({ data }) => setAuthorities(data.authorities)).catch(() => {});
  }, [locMode, addr.district, addr.type]);

  if (!user) return null;

  const divisions = geo.divisions || [];
  const districts = divisions.find((d) => d.name === addr.division)?.districts || [];
  const selectedAuthority = authorities.find((a) => String(a.authority_id) === String(addr.authority_id));
  const isUnion = addr.type === 'UNION_PARISHAD';

  const useMyLocation = () => {
    setGeoState('loading');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLoc({ lat: p.coords.latitude, lng: p.coords.longitude });
        setGeoState('ok');
        setRecenterSignal((s) => s + 1);
      },
      () => setGeoState('denied'),
      { enableHighAccuracy: true }
    );
  };

  const setAddrField = (k, v) => {
    setAddr((a) => {
      const next = { ...a, [k]: v };
      if (k === 'division') next.district = '';
      if (k === 'district' || k === 'type') next.authority_id = '';
      return next;
    });
  };

  const composedAddress = () => {
    const parts = [
      addr.road && `Road ${addr.road}`,
      addr.sector,
      addr.ward && `Ward ${addr.ward}`,
      isUnion ? addr.village : addr.area_text,
      isUnion ? addr.upazila : null,
      selectedAuthority?.name,
      addr.district,
      addr.division,
      'Bangladesh'
    ].filter(Boolean);
    return parts.join(', ');
  };

  const buildGeocodeQueries = () => {
    const area = isUnion ? addr.village : addr.area_text;
    const base = [addr.district, addr.division, 'Bangladesh'].filter(Boolean).join(', ');
    const road = (addr.road || '').replace(/^road\s+/i, '').trim();
    const landmark = address.trim();
    const q1 = [landmark, road && `${road} road`, area, base].filter(Boolean).join(', ');
    const q2 = [landmark, area, base].filter(Boolean).join(', ');
    const q3 = [road && `${road} road`, area, base].filter(Boolean).join(', ');
    const q4 = [area, base].filter(Boolean).join(', ');
    return [...new Set([q1, q2, q3, q4])].filter(Boolean);
  };

  const tryGeocode = async (q) => {
    try {
      const { data } = await api.get('/geocode', { params: { q } });
      if (data.found) return { lat: data.lat, lng: data.lng, source: data.source };
      return null;
    } catch {
      return null;
    }
  };

  const geocodeAddress = async () => {
    setErr('');
    if (!addr.division || !addr.district || !addr.authority_id || !addr.road || (isUnion && !addr.village)) {
      setErr(t('sub.completeFields'));
      return;
    }
    setGeocoding(true);
    setGeoNote('');
    const queries = buildGeocodeQueries();
    let found = null;
    for (const q of queries) {
      found = await tryGeocode(q);
      if (found) break;
    }
    if (found) {
      setLoc({ lat: found.lat, lng: found.lng });
      setGeoNote(`${t('sub.foundVia')}${found.source}${t('sub.andPinned')}`);
    } else if (selectedAuthority?.center_lat) {
      setLoc({ lat: selectedAuthority.center_lat, lng: selectedAuthority.center_lng });
      setGeoNote(t('sub.notFound'));
    } else {
      setGeoNote(t('sub.noPoint'));
    }
    setGeocoding(false);
  };

  const validate = () => {
    if (description.trim().length < 10) return t('sub.needDesc');
    if (locMode === 'address') {
      if (!addr.division || !addr.district || !addr.authority_id || !addr.road) return t('sub.needLoc');
      if (isUnion && !addr.village) return t('sub.needVillage');
    }
    return null;
  };

  const submit = async (e) => {
    e.preventDefault();
    const v = validate();
    if (v) return setErr(v);
    setErr('');
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('title', title);
      fd.append('description', description);
      fd.append('latitude', loc.lat);
      fd.append('longitude', loc.lng);
      fd.append('address_text', address);
      fd.append('category_hint', categoryHint);
      if (locMode === 'address') {
        fd.append('authority_id', addr.authority_id);
        fd.append('division', addr.division);
        fd.append('district', addr.district);
        fd.append('area_text', isUnion ? '' : addr.area_text);
        fd.append('ward', addr.ward);
        fd.append('road', addr.road);
        fd.append('sector', addr.sector);
        fd.append('village', isUnion ? addr.village : '');
        fd.append('upazila', isUnion ? addr.upazila : '');
      }
      if (image) fd.append('image', image);

      const { data } = await api.post('/complaints', fd);
      setResult(data);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e2) {
      const d = e2.response?.data;
      setErr(d?.alert || d?.error || '…');
      if (d?.alert) setResult({ blocked: true, alert: d.alert, detail: d.detail, original_id: d.original_id });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setResult(null);
    setTitle('');
    setDescription('');
    setImage(null);
    setAddress('');
    setCategoryHint('auto');
  };

  if (result) {
    return (
      <main className="mx-auto max-w-2xl px-4 pt-16">
        {result.complaint && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="glass-strong p-8 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-mint/15 text-4xl">✅</div>
            <h1 className="mt-5 font-display text-2xl font-extrabold text-white">{t('res.created.title')}</h1>
            <p className="mt-2 text-slate-400">
              {t('res.created.body1')}<span className="font-semibold text-white"> {result.routed_to}</span>.
            </p>
            <div className="mt-6 space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left text-sm text-slate-300">
              <p><span className="text-slate-500">{t('res.ticket')}</span>{result.complaint.complaint_id}</p>
              <p><span className="text-slate-500">{t('res.category')}</span> {categoryLabel(result.complaint.category, t)}</p>
              {result.complaint.full_address && (
                <p><span className="text-slate-500">{t('res.address')}</span> {result.complaint.full_address}</p>
              )}
              <p><span className="text-slate-500">{t('res.priority')}</span> {result.complaint.priority_score}</p>
              <p><span className="text-slate-500">{t('res.status')}</span> {t('res.statusV')}</p>
            </div>
            <div className="mt-7 flex justify-center gap-3">
              <Link to={`/complaints/${result.complaint.complaint_id}`} className="btn-primary">{t('res.track')}</Link>
              <button onClick={reset} className="btn-ghost">{t('res.another')}</button>
            </div>
          </motion.div>
        )}

        {result.merged && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="glass-strong p-8 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-accent/15 text-4xl">🗳️</div>
            <h1 className="mt-5 font-display text-2xl font-extrabold text-white">{t('res.merged.title')}</h1>
            <p className="mt-2 text-slate-400">
              {t('res.merged.body')}<span className="font-bold text-accent">{t('res.merged.vote')}</span>{t('res.merged.body2')}
            </p>
            <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left text-sm">
              <p className="font-semibold text-white">{result.original.title}</p>
              <p className="mt-1 text-slate-400">{t('res.merged.votes')} {result.original.vote_count}</p>
            </div>
            <div className="mt-7 flex justify-center gap-3">
              <Link to={`/complaints/${result.original.complaint_id}`} className="btn-primary">{t('res.viewOriginal')}</Link>
              <button onClick={reset} className="btn-ghost">{t('res.different')}</button>
            </div>
          </motion.div>
        )}

        {result.rejected && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="glass-strong p-8 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-rose-500/15 text-4xl">🛡️</div>
            <h1 className="mt-5 font-display text-2xl font-extrabold text-white">{t('res.rejected.title')}</h1>
            <p className="mt-2 text-slate-400">{result.reason}</p>
            <p className="mt-1 text-sm text-slate-500">{t('res.rejected.sub')}</p>
            <button onClick={reset} className="btn-primary mt-7">{t('res.tryAgain')}</button>
          </motion.div>
        )}

        {result.blocked && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="glass-strong p-8 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/15 text-4xl">⏳</div>
            <h1 className="mt-5 font-display text-2xl font-extrabold text-amber-300">{result.alert}</h1>
            <p className="mt-2 text-slate-400">{result.detail}</p>
            <p className="mt-1 text-sm text-slate-500">{t('res.blocked.note')}</p>
            <div className="mt-7 flex justify-center gap-3">
              {result.original_id && (
                <Link to={`/complaints/${result.original_id}`} className="btn-primary">{t('res.blocked.track')}</Link>
              )}
              <Link to="/explore" className="btn-ghost">{t('res.blocked.explore')}</Link>
            </div>
          </motion.div>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 pb-10 pt-10 sm:px-6">
      <h1 className="font-display text-3xl font-extrabold text-white sm:text-4xl">
        {t('sub.title')}<span className="text-gradient">{t('sub.title.hl')}</span>
      </h1>
      <p className="mt-2 text-slate-400">{t('sub.sub')}</p>

      <form onSubmit={submit} className="mt-8 grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <div className="space-y-5">
          <div className="glass p-5">
            <label className="label">{t('sub.titleLabel')}</label>
            <input className="input" required maxLength={120} value={title}
              onChange={(e) => setTitle(e.target.value)} placeholder={t('sub.title.ph')} />

            <label className="label mt-5">{t('sub.descLabel')}</label>
            <textarea className="input min-h-[130px]" required value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('sub.desc.ph')} />
            <div className="mt-4 flex items-center justify-between gap-3">
              <VoiceInput onText={(txt) => setDescription((d) => (d ? `${d} ${txt}` : txt))} />
              <span className="text-xs text-slate-500">{description.trim().length} {t('sub.chars')}</span>
            </div>
          </div>

          <div className="glass p-5">
            <div className="flex items-center justify-between">
              <label className="label !mb-0">{t('sub.photo')}</label>
              <select className="input !w-auto !py-1.5 text-xs" value={categoryHint}
                onChange={(e) => setCategoryHint(e.target.value)}>
                <option value="auto">{t('sub.autoCat')}</option>
                {CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>{t('sub.force')}{categoryLabel(c.key, t)}</option>
                ))}
              </select>
            </div>
            <div
              onClick={() => fileRef.current?.click()}
              className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/15 bg-white/[0.02] py-8 transition hover:border-accent/50"
            >
              {image ? (
                <img src={URL.createObjectURL(image)} alt="preview" className="max-h-44 rounded-lg" />
              ) : (
                <>
                  <span className="text-3xl">📷</span>
                  <p className="mt-2 text-sm text-slate-400">{t('sub.photo.tap')}</p>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden
              onChange={(e) => setImage(e.target.files[0])} />
          </div>
        </div>

        <div className="space-y-5">
          <div className="glass p-5">
            <div className="mb-3 flex gap-2">
              <button type="button" onClick={() => setLocMode('gps')}
                className={`chip ${locMode === 'gps' ? 'chip-active' : 'chip-idle'}`}>{t('sub.gps')}</button>
              <button type="button" onClick={() => setLocMode('address')}
                className={`chip ${locMode === 'address' ? 'chip-active' : 'chip-idle'}`}>{t('sub.addr')}</button>
            </div>

            {locMode === 'gps' ? (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <label className="label !mb-0">{t('sub.exact')}</label>
                  <button type="button" onClick={useMyLocation} className="rounded-lg bg-accent/15 px-3 py-1.5 text-xs font-bold text-accent hover:bg-accent/30">
                    📍 {t('sub.refreshLoc')}
                  </button>
                </div>
                {geoState === 'detecting' && <p className="mb-2 text-xs text-slate-400">{t('sub.detecting')}</p>}
                {geoState === 'auto' && <p className="mb-2 text-xs text-mint">{t('sub.showing')}</p>}
                {geoState === 'ok' && <p className="mb-2 text-xs text-mint">{t('sub.captured')}</p>}
                {geoState === 'denied' && <p className="mb-2 text-xs text-amber-300">{t('sub.denied')}</p>}
                {geoState === 'fallback' && <p className="mb-2 text-xs text-amber-300">{t('sub.fallback')}</p>}
                <MapPanel center={loc} markers={[{ ...loc, emoji: '📌', color: '#ff6cb5' }]}
                  onPick={setLoc} height="280px" recenterSignal={recenterSignal} />
                <p className="mt-2 text-xs text-slate-500">
                  {t('sub.picked')} {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)} — {t('sub.tapAdjust')}
                </p>
              </>
            ) : (
              <>
                <label className="label">{t('sub.division')}</label>
                <select className="input" value={addr.division} onChange={(e) => setAddrField('division', e.target.value)}>
                  <option value="">{t('sub.selectDivision')}</option>
                  {divisions.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
                </select>

                <label className="label mt-3">{t('sub.district')}</label>
                <select className="input" value={addr.district} onChange={(e) => setAddrField('district', e.target.value)} disabled={!addr.division}>
                  <option value="">{t('sub.selectDistrict')}</option>
                  {districts.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>

                <label className="label mt-3">{t('sub.type')}</label>
                <select className="input" value={addr.type} onChange={(e) => setAddrField('type', e.target.value)}>
                  <option value="CITY_CORPORATION">{t('sub.typeCity')}</option>
                  <option value="POUROSHOVA">{t('sub.typePouro')}</option>
                  <option value="UNION_PARISHAD">{t('sub.typeUnion')}</option>
                </select>

                <label className="label mt-3">
                  {isUnion ? t('sub.union') : addr.type === 'POUROSHOVA' ? t('sub.pouro') : t('sub.cityCorp')}
                </label>
                <select className="input" value={addr.authority_id}
                  onChange={(e) => setAddrField('authority_id', e.target.value)} disabled={!addr.district}>
                  <option value="">{addr.district ? t('sub.selectList') : t('sub.selectFirst')}</option>
                  {authorities.map((a) => <option key={a.authority_id} value={a.authority_id}>{a.name}</option>)}
                </select>
                {addr.district && authorities.length === 0 && (
                  <p className="mt-1.5 text-xs text-amber-300">{t('sub.noAuthority')}</p>
                )}

                {isUnion ? (
                  <>
                    <label className="label mt-3">{t('sub.village')}</label>
                    <input className="input" value={addr.village} onChange={(e) => setAddrField('village', e.target.value)} placeholder={t('sub.village.ph')} />
                    <label className="label mt-3">{t('sub.upazila')}</label>
                    <input className="input" value={addr.upazila} onChange={(e) => setAddrField('upazila', e.target.value)} placeholder={t('sub.upazila.ph')} />
                  </>
                ) : (
                  <>
                    <label className="label mt-3">{t('sub.area')}</label>
                    <input className="input" value={addr.area_text} onChange={(e) => setAddrField('area_text', e.target.value)} placeholder={t('sub.area.ph')} />
                    <label className="label mt-3">{t('sub.ward')}</label>
                    <input className="input" value={addr.ward} onChange={(e) => setAddrField('ward', e.target.value)} placeholder={t('sub.ward.ph')} />
                  </>
                )}

                <label className="label mt-3">{t('sub.road')}</label>
                <input className="input" value={addr.road} onChange={(e) => setAddrField('road', e.target.value)} placeholder={t('sub.road.ph')} />

                <label className="label mt-3">{t('sub.sector')}</label>
                <input className="input" value={addr.sector} onChange={(e) => setAddrField('sector', e.target.value)} placeholder={t('sub.sector.ph')} />

                <button type="button" onClick={geocodeAddress} disabled={geocoding}
                  className="btn-ghost mt-4 w-full !py-2.5 text-sm disabled:opacity-60">
                  {geocoding ? t('sub.finding') : t('sub.find')}
                </button>
                {geoNote && <p className="mt-2 text-xs text-mint">{geoNote}</p>}
                {composedAddress() && (
                  <p className="mt-2 rounded-lg bg-white/[0.03] border border-white/5 px-3 py-2 text-[11px] leading-relaxed text-slate-400">
                    {composedAddress()}
                  </p>
                )}
                <div className="mt-3">
                  <MapPanel center={loc} markers={[{ ...loc, emoji: '📌', color: '#ff6cb5' }]} height="220px" zoom={15} />
                </div>
              </>
            )}
          </div>

          <div className="glass p-5">
            <label className="label">{t('sub.landmark')}</label>
            <input className="input" value={address} onChange={(e) => setAddress(e.target.value)}
              placeholder={t('sub.landmark.ph')} />
          </div>

          {err && <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{err}</p>}

          <button disabled={busy || description.trim().length < 10}
            className="btn-primary w-full !py-4 text-base disabled:opacity-50">
            {busy ? t('sub.processing') : t('sub.submit')}
          </button>
          <p className="text-center text-xs text-slate-500">{t('sub.confirm')}</p>
        </div>
      </form>
    </main>
  );
}
