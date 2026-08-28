import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { api, SERVICE_TYPES } from '../lib/api';
import { useLang, serviceLabel } from '../lib/i18n.jsx';
import MapPanel from '../components/MapPanel.jsx';

const COLORS = {
  fire_service: '#ff6b57',
  police_station: '#5b8cff',
  wasa: '#38bdf8',
  lged: '#fbbf24',
  desa: '#a76cff',
  titas_gas: '#fb7185',
  public_toilet: '#2dd4bf'
};

export default function Emergency() {
  const { t } = useLang();
  const [loc, setLoc] = useState(null);
  const [geoState, setGeoState] = useState('locating');
  const [type, setType] = useState('all');
  const [services, setServices] = useState([]);

  const locate = () => {
    setGeoState('locating');
    if (!navigator.geolocation) {
      setLoc({ lat: 23.7385, lng: 90.3965 });
      return setGeoState('fallback');
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoState('ok');
      },
      () => {
        setLoc({ lat: 23.7385, lng: 90.3965 });
        setGeoState('fallback');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  useEffect(locate, []);

  useEffect(() => {
    if (!loc) return;
    api
      .get('/services/nearby', { params: { lat: loc.lat, lng: loc.lng, type } })
      .then(({ data }) => setServices(data.services))
      .catch(() => {});
  }, [loc, type]);

  const markers = useMemo(() => {
    if (!loc) return [];
    return [
      { lat: loc.lat, lng: loc.lng, emoji: '🧍', color: '#ffffff' },
      ...services.map((s) => ({
        lat: s.latitude, lng: s.longitude,
        emoji: (SERVICE_TYPES.find((x) => x.key === s.type) || {}).icon || '🏢',
        color: COLORS[s.type] || '#5b8cff'
      }))
    ];
  }, [loc, services]);

  return (
    <main className="mx-auto max-w-7xl px-4 pb-10 pt-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-white sm:text-4xl">
            {t('em.title')}<span className="text-gradient">{t('em.title.hl')}</span>
          </h1>
          <p className="mt-2 text-slate-400">{t('em.sub')}</p>
        </div>
        <button onClick={locate} className="btn-ghost !py-2.5 text-sm">
          📍 {geoState === 'locating' ? t('em.locating') : t('em.refresh')}
        </button>
      </div>

      {geoState === 'fallback' && (
        <p className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-300">
          {t('em.denied')}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {SERVICE_TYPES.map((s) => (
          <button key={s.key} onClick={() => setType(s.key)} className={`chip ${type === s.key ? 'chip-active' : 'chip-idle'}`}>
            {s.icon} {s.key === 'all' ? t('svc.all') : serviceLabel(s.key, t)}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.15fr]">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
          <MapPanel center={loc || undefined} markers={markers} height="480px" zoom={14} />
        </motion.div>

        <div className="max-h-[480px] space-y-3 overflow-y-auto pr-1">
          {services.length === 0 && loc && (
            <p className="glass p-6 text-center text-slate-400">{t('em.none')}</p>
          )}
          {services.map((s, i) => (
            <motion.a
              key={s.service_id}
              href={`tel:${s.phone.split('/')[0].trim()}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass flex items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-glow"
            >
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl"
                style={{ background: (COLORS[s.type] || '#5b8cff') + '26' }}
              >
                {(SERVICE_TYPES.find((x) => x.key === s.type) || {}).icon || '🏢'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-white">{s.name}</p>
                <p className="truncate text-xs text-slate-500">{s.address}</p>
                <p className="mt-0.5 text-sm font-semibold" style={{ color: COLORS[s.type] }}>{s.phone}</p>
              </div>
              <div className="text-right">
                <p className="font-display text-lg font-bold text-white">
                  {s.distance_m >= 1000 ? `${(s.distance_m / 1000).toFixed(1)} km` : `${s.distance_m} m`}
                </p>
                <p className="text-[11px] uppercase tracking-wider text-slate-500">{t('em.away')}</p>
              </div>
            </motion.a>
          ))}
        </div>
      </div>
    </main>
  );
}
