import axios from 'axios';

export const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ns_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const CATEGORIES = [
  { key: 'road', label: 'Road', icon: '🛣️' },
  { key: 'electricity', label: 'Electricity', icon: '⚡' },
  { key: 'water', label: 'Water', icon: '💧' },
  { key: 'gas', label: 'Gas', icon: '🔥' },
  { key: 'sanitation', label: 'Sanitation', icon: '🧹' },
  { key: 'other', label: 'Other', icon: '📌' }
];

export const STATUS_META = {
  submitted: { label: 'Submitted', cls: 'bg-sky-500/15 text-sky-300 border-sky-400/30', dot: 'bg-sky-400' },
  verified: { label: 'Verified · Sent', cls: 'bg-violet-500/15 text-violet-300 border-violet-400/30', dot: 'bg-violet-400' },
  in_process: { label: 'In Process', cls: 'bg-amber-500/15 text-amber-300 border-amber-400/30', dot: 'bg-amber-400' },
  resolved: { label: 'Resolved', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30', dot: 'bg-emerald-400' },
  rejected: { label: 'Rejected', cls: 'bg-rose-500/15 text-rose-300 border-rose-400/30', dot: 'bg-rose-400' },
  merged: { label: 'Merged as Vote', cls: 'bg-slate-500/15 text-slate-300 border-slate-400/30', dot: 'bg-slate-400' }
};

export const SERVICE_TYPES = [
  { key: 'all', label: 'All Services', icon: '🏙️' },
  { key: 'fire_service', label: 'Fire Service', icon: '🚒' },
  { key: 'police_station', label: 'Police', icon: '🚓' },
  { key: 'wasa', label: 'WASA', icon: '🚰' },
  { key: 'lged', label: 'LGED', icon: '🏗️' },
  { key: 'desa', label: 'DESA', icon: '💡' },
  { key: 'titas_gas', label: 'Titas Gas', icon: '🔥' },
  { key: 'public_toilet', label: 'Public Toilet', icon: '🚻' }
];

export function fmtDate(d) {
  if (!d) return '';
  return new Date(d.replace(' ', 'T') + 'Z').toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}
