import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

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
  onPick,
  height = '380px',
  zoom = 14,
  defaultLayer = 'map',
  recenterSignal = 0
}) {
  const [layer, setLayer] = useState(defaultLayer);
  const l = LAYERS[layer] || LAYERS.map;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10" style={{ height }}>
      <MapContainer center={[center.lat, center.lng]} zoom={zoom} scrollWheelZoom style={{ height: '100%' }}>
        <TileLayer key={layer} url={l.url} attribution={l.attribution} />
        <ClickCatcher onPick={onPick} />
        {onPick ? (
          <SignalRecenter center={center} signal={recenterSignal} />
        ) : (
          <FollowCenter center={center} />
        )}
        {markers.map((m, i) => (
          <Marker key={i} position={[m.lat, m.lng]} icon={makeIcon(m.emoji || '📍', m.color || '#5b8cff')} />
        ))}
      </MapContainer>
      <div className="absolute right-2 top-2 z-[500] flex gap-1 rounded-lg bg-night/85 p-1 backdrop-blur">
        {Object.entries(LAYERS).map(([key, val]) => (
          <button
            key={key}
            type="button"
            onClick={() => setLayer(key)}
            className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition ${
              layer === key ? 'bg-accent text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {val.name}
          </button>
        ))}
      </div>
    </div>
  );
}
