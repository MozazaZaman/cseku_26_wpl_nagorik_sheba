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
  const [userAddr, setUserAddr] = useState('');
  const [geoState, setGeoState] = useState('locating');
  const [type, setType] = useState('all');
  const [services, setServices] = useState([]);
  const [routeCoords, setRouteCoords] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);

  const reverseUser = async (lat,lng) => {
    try {
      const { data } = await api.get('/reverse', { params: { lat, lng } });
      if (data?.found) setUserAddr(data.display_name);
    } catch {}
  };

  const locate = () => {
    setGeoState('locating');
    setRouteCoords(null);
    setSelectedId(null);
    setUserAddr('');
    if (!navigator.geolocation) {
      const d = { lat: 23.7385, lng: 90.3965 };
      setLoc(d); reverseUser(d.lat, d.lng);
      return setGeoState('fallback');
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const d = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLoc(d); setGeoState('ok'); reverseUser(d.lat, d.lng);
      },
      () => {
        const d = { lat: 23.7385, lng: 90.3965 };
        setLoc(d); setGeoState('fallback'); reverseUser(d.lat, d.lng);
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
        color: s.service_id === selectedId ? '#ffffff' : (COLORS[s.type] || '#5b8cff')
      }))
    ];
  }, [loc, services, selectedId]);

  const hasPhone = (s) => s.phone && s.phone.trim() !== '';

  const handleDirections = async (s) => {
    if (!loc) return;
    setSelectedId(s.service_id);
    setRouteCoords(null);
    setRouteInfo(null);
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${loc.lng},${loc.lat};${s.longitude},${s.latitude}?overview=full&geometries=geojson`;
      const r = await fetch(url);
      const j = await r.json();
      if (j.code === 'Ok' && j.routes && j.routes[0]) {
        const coords = j.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
        setRouteCoords(coords);
        const d = j.routes[0].distance;
        const dur = j.routes[0].duration;
        setRouteInfo({
          dist: d >= 1000 ? `${(d / 1000).toFixed(1)} km` : `${Math.round(d)} m`,
          mins: Math.round(dur / 60)
        });
      } else {
        window.open(`https://www.google.com/maps/dir/?api=1&origin=${loc.lat},${loc.lng}&destination=${s.latitude},${s.longitude}`, '_blank');
      }
    } catch {
      window.open(`https://www.google.com/maps/dir/?api=1&origin=${loc.lat},${loc.lng}&destination=${s.latitude},${s.longitude}`, '_blank');
    }
  };

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
          <button key={s.key} onClick={() => { setRouteCoords(null); setSelectedId(null); setType(s.key); }} className={`chip ${type === s.key ? 'chip-active' : 'chip-idle'}`}>
            {s.icon} {s.key === 'all' ? t('svc.all') : serviceLabel(s.key, t)}
          </button>
        ))}
      </div>

      {routeCoords && routeInfo && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-accent/40 bg-accent/10 px-4 py-2.5 text-sm">
          <span className="text-accent">🧭 {routeInfo.dist} · ~{routeInfo.mins} min</span>
          <span className="text-slate-500">— route shown on map</span>
          <button onClick={() => { setRouteCoords(null); setSelectedId(null); setRouteInfo(null); }} className="ml-auto text-xs font-bold text-slate-400 hover:text-white">✕ Clear</button>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.15fr]">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
          <MapPanel center={loc || undefined} markers={markers} routeCoords={routeCoords} height="480px" zoom={14} />
        </motion.div>

        <div className="max-h-[480px] space-y-3 overflow-y-auto pr-1">
          {services.length === 0 && loc && (
            <p className="glass p-6 text-center text-slate-400">{t('em.none')}</p>
          )}
          {services.map((s, i) => (
            <motion.div
              key={s.service_id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`glass p-4 transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-glow ${s.service_id === selectedId ? 'border-accent/60 shadow-glow' : ''}`}
            >
              <div className="flex items-start gap-4">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl"
                  style={{ background: (COLORS[s.type] || '#5b8cff') + '26' }}
                >
                  {(SERVICE_TYPES.find((x) => x.key === s.type) || {}).icon || '🏢'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-white">{s.name}</p>
                  <p className="truncate text-xs text-slate-500">{s.address}</p>
                  {hasPhone(s) && (
                    <p className="mt-0.5 text-sm font-semibold" style={{ color: COLORS[s.type] }}>{s.phone}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      onClick={() => handleDirections(s)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${s.service_id === selectedId ? 'bg-accent text-white' : 'bg-accent/15 text-accent hover:bg-accent/30'}`}
                    >
                      🧭 Directions
                    </button>
                    {hasPhone(s) && (
                      <a
                        href={`tel:${s.phone.split('/')[0].trim()}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-white/10"
                      >
                        📞 Call
                      </a>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-display text-lg font-bold text-white">
                    {s.distance_m >= 1000 ? `${(s.distance_m / 1000).toFixed(1)} km` : `${s.distance_m} m`}
                  </p>
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">{t('em.away')}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </main>
  );
}
