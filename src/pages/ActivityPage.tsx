import { useState, useEffect, useCallback } from 'react';
import {
  Activity as ActivityIcon,
  Shield,
  Coins,
  CalendarDays,
  Radio,
  Megaphone,
  UserPlus,
  ArrowUpRight,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/AppShell';
import { Panel, PanelHeader, Badge, EmptyState } from '@/components/ui';
import { Avatar } from '@/components/Status';
import { cn } from '@/lib/utils';

const typeConfig: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  verification: { label: 'Verification', icon: <Shield className="h-4 w-4" />, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  promotion: { label: 'Promotion', icon: <ArrowUpRight className="h-4 w-4" />, color: 'text-gold-400', bg: 'bg-gold-500/10' },
  loan: { label: 'Loan', icon: <Coins className="h-4 w-4" />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  event: { label: 'Event', icon: <CalendarDays className="h-4 w-4" />, color: 'text-violet-400', bg: 'bg-violet-500/10' },
  discord: { label: 'Discord', icon: <Radio className="h-4 w-4" />, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  announcement: { label: 'Announcement', icon: <Megaphone className="h-4 w-4" />, color: 'text-gold-400', bg: 'bg-gold-500/10' },
  join: { label: 'New Member', icon: <UserPlus className="h-4 w-4" />, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
};

const filters: { id: string | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'verification', label: 'Verification' },
  { id: 'loan', label: 'Loans' },
  { id: 'event', label: 'Events' },
  { id: 'discord', label: 'Discord' },
  { id: 'announcement', label: 'Announcements' },
  { id: 'join', label: 'New Members' },
];

interface ActivityRow {
  id: string;
  type: string;
  label: string;
  detail: string;
  created_at: string;
  user_id: string | null;
  profiles?: { handle: string; avatar_initials: string; accent: string } | null;
}

export function ActivityPage() {
  const [filter, setFilter] = useState<string | 'all'>('all');
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('activity_logs')
      .select('*, profiles:activity_logs_user_id_fkey(handle, avatar_initials, accent)')
      .order('created_at', { ascending: false })
      .limit(50);
    setActivity((data as ActivityRow[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchActivity(); }, [fetchActivity]);

  const filtered = activity.filter((a) => filter === 'all' || a.type === filter);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity Center"
        subtitle="Community-wide event log"
        icon={<ActivityIcon className="h-5 w-5" />}
      />

      {/* Type filters */}
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
              filter === f.id
                ? 'border-gold-500/40 bg-gold-500/15 text-gold-200'
                : 'border-white/5 bg-ink-900/60 text-ink-300 hover:border-gold-500/20 hover:text-white',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <Panel>
        <PanelHeader title="Activity Timeline" subtitle={`${filtered.length} records`} icon={<ActivityIcon className="h-4 w-4" />} />
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gold-500" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<ActivityIcon className="h-6 w-6" />} title="No activity yet" subtitle="Community events will appear here as they happen." />
        ) : (
          <div className="relative px-5 py-5">
            <div className="absolute left-[34px] top-2 bottom-2 w-px bg-white/5" />
            <div className="space-y-1">
              {filtered.map((a) => {
                const cfg = typeConfig[a.type] || { label: a.type, icon: <ActivityIcon className="h-4 w-4" />, color: 'text-ink-300', bg: 'bg-white/5' };
                return (
                  <div key={a.id} className="relative flex items-start gap-4 py-3">
                    <div
                      className={cn(
                        'relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-4 ring-ink-850',
                        cfg.bg,
                        cfg.color,
                      )}
                    >
                      {cfg.icon}
                    </div>
                    <div className="min-w-0 flex-1 pt-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="neutral">{cfg.label}</Badge>
                        <span className="font-mono text-[11px] text-ink-400">{new Date(a.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="mt-1.5 text-sm text-white">
                        <span className="font-semibold">{a.profiles?.handle || 'System'}</span>{' '}
                        <span className="text-ink-300">— {a.label}</span>
                      </p>
                      <p className="text-xs text-ink-300">{a.detail}</p>
                    </div>
                    {a.profiles && (
                      <div className="hidden sm:block">
                        <Avatar initials={a.profiles.avatar_initials} accent={a.profiles.accent} size="sm" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Panel>

      {/* Summary by type */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Object.entries(typeConfig).slice(0, 4).map(([key, cfg]) => {
            const count = activity.filter((a) => a.type === key).length;
            return (
              <Panel key={key} className="flex items-center gap-3 p-4">
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', cfg.bg, cfg.color)}>
                  {cfg.icon}
                </div>
                <div>
                  <p className="font-display text-xl font-bold text-white">{count}</p>
                  <p className="text-[10px] uppercase tracking-wider text-ink-400">{cfg.label}</p>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
