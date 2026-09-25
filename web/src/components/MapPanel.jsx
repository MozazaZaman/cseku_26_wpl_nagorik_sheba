import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';

export function makeIcon(emoji, color) {
  return L.divIcon({
    className: '',
    html: `<div class="ns-pin" style="background:${color}"><span>${emoji}</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 32]
  });
}

function ClickCatcher({ onPick }) {
  useMapEvents({
    click(e) {
      onPick && onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    }
  });
  return null;
}

// Flies to `center` whenever it changes (maps without tap-picking: Emergency, Detail, Address preview)
function FollowCenter({ center }) {
  const map = useMapEvents({});
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (center) map.flyTo([center.lat, center.lng], Math.max(map.getZoom(), 14), { duration: 0.8 });
  }, [center, map]);
  return null;
}

// Flies only when the parent bumps `signal` (tap-picking maps: GPS location picker)
function SignalRecenter({ center, signal }) {
  const map = useMapEvents({});
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (center) map.flyTo([center.lat, center.lng], Math.max(map.getZoom(), 14), { duration: 0.8 });
  }, [signal, center, map]);
  return null;
}

// Fits map to a route once it appears
function FitRoute({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (!coords || coords.length < 2) return;
    const bounds = L.latLngBounds(coords.map(([lat, lng]) => [lat, lng]));
    map.fitBounds(bounds.pad(0.25), { animate: true, duration: 0.6 });
  }, [coords, map]);
  return null;
}

// Density heatmap layer (leaflet.heat) — points: [{lat, lng, intensity}]
function HeatLayer({ points = [], enabled }) {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    if (!enabled) {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
      return;
    }
    if (!points.length) return;
    if (layerRef.current) map.removeLayer(layerRef.current);
    layerRef.current = L.heatLayer(
      points.map((p) => [p.lat, p.lng, p.intensity ?? 0.5]),
      { radius: 22, blur: 18, maxZoom: 13, max: 1,
        gradient: { 0.2: '#2dd4bf', 0.45: '#3b82f6', 0.7: '#f59e0b', 1: '#ef4444' } }
    ).addTo(map);
    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [points, enabled, map]);
  return null;
}

const LAYERS = {
  map: {
    name: 'Map',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  },
  satellite: {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics'
  },
  dark: {
    name: 'Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
  }
};

export default function MapPanel({
  center = { lat: 23.7385, lng: 90.3965 },
  markers = [],
  routeCoords = null,
  onPick,
  height = '380px',
  zoom = 14,
  defaultLayer = 'map',
  recenterSignal = 0,
  heatPoints = null,          // array of {lat,lng,intensity} enables the heat toggle
  heatOn = false,
  onHeatToggle = null
}) {
  const [layer, setLayer] = useState(defaultLayer);
  const [heat, setHeat] = useState(heatOn);
  const l = LAYERS[layer] || LAYERS.map;
  const showHeat = heatPoints && heatPoints.length > 0;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10" style={{ height }}>
      <MapContainer center={[center.lat, center.lng]} zoom={zoom} scrollWheelZoom style={{ height: '100%' }}>
        <TileLayer key={layer} url={l.url} attribution={l.attribution} />
        <ClickCatcher onPick={onPick} />
        {showHeat && <HeatLayer points={heatPoints} enabled={heat} />}
        {onPick ? (
          <SignalRecenter center={center} signal={recenterSignal} />
        ) : (
          <FollowCenter center={center} />
        )}
        {markers.map((m, i) => (
          <Marker key={i} position={[m.lat, m.lng]} icon={makeIcon(m.emoji || '📍', m.color || '#5b8cff')} />
        ))}
        {routeCoords && routeCoords.length > 1 && (
          <>
            <Polyline positions={routeCoords} pathOptions={{ color: '#5b8cff', weight: 5, opacity: 0.85 }} />
            <FitRoute coords={routeCoords} />
          </>
        )}
      </MapContainer>
      <div className="absolute right-2 top-2 z-[500] flex gap-1 rounded-lg bg-night/85 p-1 backdrop-blur">
        {Object.entries(LAYERS).map(([key, val]) => (
          <button
            key={key}
            type="button"
            onClick={() => setLayer(key)}
            className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition ${
              layer === key ? 'bg-accent text-onaccent' : 'text-slate-400 hover:text-white'
            }`}
          >
            {val.name}
          </button>
        ))}
        {showHeat && (
          <button
            type="button"
            onClick={() => { setHeat(!heat); onHeatToggle?.(!heat); }}
            className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition ${
              heat ? 'bg-rose-500 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            🔥 Heatmap
          </button>
        )}
      </div>
    </div>
  );
}
