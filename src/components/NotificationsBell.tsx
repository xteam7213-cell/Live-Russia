import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Check, X, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/store/AppContext';
import { cn } from '@/lib/utils';
import type { PageId } from '@/types';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  link: string | null;
  created_at: string;
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function NotificationsBell() {
  const { user, navigate } = useApp();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(15);
    setNotifications(data as NotificationItem[] || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  // Realtime subscription for instant notification updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('notifications-realtime')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => { fetchNotifications(); }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => { fetchNotifications(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchNotifications]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const unread = notifications.filter((n) => !n.read).length;

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-ink-200 transition-colors hover:bg-white/5 hover:text-white"
        title="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-gold-500 text-[9px] font-bold text-ink-950">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-white/10 bg-ink-850 shadow-2xl animate-fade-up">
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
            <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-white">Notifications</h3>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-[10px] font-semibold uppercase tracking-wider text-gold-400 hover:text-gold-300">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto scrollbar-thin">
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-gold-500" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center">
                <Bell className="mx-auto mb-2 h-6 w-6 text-ink-400" />
                <p className="text-xs text-ink-300">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={cn(
                      'flex items-start gap-2 px-4 py-3 transition-colors hover:bg-white/5 cursor-pointer',
                      !n.read && 'bg-gold-500/5',
                    )}
                    onClick={() => {
                      if (n.link) navigate(n.link as PageId);
                      if (!n.read) markRead(n.id);
                      setOpen(false);
                    }}
                  >
                    {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold-500" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-white">{n.title}</p>
                      {n.body && <p className="mt-0.5 text-[11px] text-ink-300">{n.body}</p>}
                      <p className="mt-1 text-[10px] text-ink-400">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.read && (
                      <button
                        onClick={() => markRead(n.id)}
                        className="shrink-0 rounded p-1 text-ink-400 hover:text-gold-400"
                        title="Mark read"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
