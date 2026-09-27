import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useLang } from '../lib/i18n.jsx';
import { useAuth } from '../store/auth.jsx';

const POLL_INTERVAL = 30000;

function relativeTime(value, t) {
  const then = new Date(value.replace(' ', 'T') + 'Z').getTime();
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return t('notif.justNow');
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} ${t(minutes === 1 ? 'notif.minute' : 'notif.minutes')}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${t(hours === 1 ? 'notif.hour' : 'notif.hours')}`;
  const days = Math.floor(hours / 24);
  return `${days} ${t(days === 1 ? 'notif.day' : 'notif.days')}`;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const panelRef = useRef(null);
  const activeRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadUnread = useCallback(async () => {
    if (!user || !activeRef.current) return;
    try {
      const { data } = await api.get('/notifications/unread-count');
      if (activeRef.current) setUnreadCount(Number(data.unread_count || 0));
    } catch {
      if (activeRef.current) setError(t('notif.error'));
    }
  }, [t, user]);

  const loadAll = useCallback(async () => {
    if (!user || !activeRef.current) return;
    setLoading(true);
    setError('');
    try {
      const [listResponse, countResponse] = await Promise.all([
        api.get('/notifications'),
        api.get('/notifications/unread-count')
      ]);
      if (!activeRef.current) return;
      setNotifications(listResponse.data.notifications || []);
      setUnreadCount(Number(
        listResponse.data.unread_count ?? countResponse.data.unread_count ?? 0
      ));
    } catch {
      if (activeRef.current) setError(t('notif.error'));
    } finally {
      if (activeRef.current) setLoading(false);
    }
  }, [t, user]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setError('');
      return;
    }
    activeRef.current = true;
    loadAll();
    const timer = setInterval(loadUnread, POLL_INTERVAL);
    return () => {
      activeRef.current = false;
      clearInterval(timer);
    };
  }, [loadAll, loadUnread, user]);

  useEffect(() => {
    if (!open) return undefined;
    loadAll();
    const closeOnOutsideClick = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('touchstart', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('touchstart', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [loadAll, open]);

  const markRead = async (notification) => {
    const wasUnread = !notification.is_read;
    try {
      await api.patch(`/notifications/${notification.notification_id}/read`);
      setNotifications((current) => current.map((item) => item.notification_id === notification.notification_id
        ? { ...item, is_read: 1 }
        : item));
      if (wasUnread) setUnreadCount((current) => Math.max(0, current - 1));
    } catch {
      setError(t('notif.error'));
    } finally {
      if (notification.complaint_id) navigate(`/complaints/${notification.complaint_id}`);
      setOpen(false);
    }
  };

  const markAllRead = async () => {
    setSaving(true);
    try {
      await api.patch('/notifications/read-all');
      setNotifications((current) => current.map((item) => ({ ...item, is_read: 1 })));
      setUnreadCount(0);
      setError('');
    } catch {
      setError(t('notif.error'));
    } finally {
      setSaving(false);
    }
  };

  // Opening the panel marks everything read immediately (once per open).
  // The badge drops to 0 optimistically so the citizen never has to wait
  // for the next poll cycle to see the cleared state.
  const togglePanel = () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (unreadCount > 0) {
      setUnreadCount(0);
      markAllRead();
    }
  };

  const deleteNotification = async (notification) => {
    const id = notification.notification_id;
    const wasUnread = !notification.is_read;
    // Optimistic update: remove the row now, fix the count if it was unread.
    setNotifications((current) => current.filter((n) => n.notification_id !== id));
    if (wasUnread) setUnreadCount((current) => Math.max(0, current - 1));
    try {
      const { data } = await api.delete(`/notifications/${id}`);
      if (typeof data.unread_count === 'number') setUnreadCount(data.unread_count);
    } catch {
      // Restore the row at its chronological position if the delete failed.
      setError(t('notif.error'));
      setNotifications((current) =>
        [notification, ...current].sort((a, b) => b.created_at.localeCompare(a.created_at)));
    }
  };

  const clearAll = async () => {
    if (notifications.length === 0) return;
    // eslint-disable-next-line no-alert
    if (!window.confirm(t('notif.clearAllConfirm'))) return;
    const backup = notifications;
    setNotifications([]);
    setUnreadCount(0);
    try {
      await api.delete('/notifications/clear-all');
      setError('');
    } catch {
      setError(t('notif.error'));
      setNotifications(backup);
      loadUnread();
    }
  };

  if (!user) return null;

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={togglePanel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('notif.bell')}
        title={t('notif.bell')}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10 hover:text-white"
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-lg shadow-rose-500/30">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute right-0 z-50 mt-2 w-[min(92vw,24rem)] overflow-hidden rounded-2xl border border-white/10 bg-night/95 shadow-2xl shadow-black/40 backdrop-blur-2xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/5 px-3 py-2.5">
              <p className="text-sm font-semibold text-white">{t('notif.title')}</p>
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  disabled={saving}
                  className="rounded-lg px-2 py-1 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/10 disabled:cursor-wait disabled:opacity-60"
                >
                  {t('notif.clearAll')}
                </button>
              )}
            </div>

            <div className="max-h-[min(70vh,28rem)] overflow-y-auto p-1.5">
              {loading && (
                <p className="px-3 py-6 text-center text-sm text-slate-400">{t('notif.loading')}</p>
              )}
              {!loading && error && notifications.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-rose-300">{error}</p>
              )}
              {!loading && !error && notifications.length === 0 && (
                <p className="px-3 py-8 text-center text-sm text-slate-400">{t('notif.empty')}</p>
              )}
              {notifications.map((notification) => {
                const unread = !notification.is_read;
                return (
                  <div
                    key={notification.notification_id}
                    role="button"
                    tabIndex={0}
                    onClick={() => markRead(notification)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); markRead(notification); }
                    }}
                    className={`group relative flex w-full cursor-pointer gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition ${
                      unread ? 'bg-white/5' : 'hover:bg-white/5'
                    }`}
                  >
                    <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${unread ? 'bg-rose-400' : 'bg-slate-600'}`} />
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm ${unread ? 'font-semibold text-white' : 'text-slate-300'}`}>
                        {notification.title}
                      </span>
                      <span className="mt-0.5 block max-h-10 overflow-hidden text-xs leading-relaxed text-slate-400">
                        {notification.message}
                      </span>
                      <span className="mt-1 block text-[10px] uppercase tracking-wider text-slate-500">
                        {relativeTime(notification.created_at, t)}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); deleteNotification(notification); }}
                      aria-label={t('notif.delete')}
                      title={t('notif.delete')}
                      className="absolute right-1.5 top-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 opacity-0 transition hover:bg-rose-500/15 hover:text-rose-300 group-hover:opacity-100 focus:opacity-100"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
