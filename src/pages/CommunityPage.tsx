import { useState, useEffect, useCallback } from 'react';
import { Users, Search, Gamepad2, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/store/AppContext';
import { PageHeader } from '@/components/AppShell';
import { Panel, Badge, EmptyState } from '@/components/ui';
import { Avatar, StatusBadge } from '@/components/Status';
import type { DiscordStatus } from '@/types';
import { cn } from '@/lib/utils';

interface ProfileRow {
  id: string;
  handle: string;
  display_name: string;
  avatar_initials: string;
  accent: string;
  game: string;
  verified: boolean;
  discord_status: string;
  discord_connected: boolean;
  reputation: number;
  created_at: string;
}

const statusFilters: { id: DiscordStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'online', label: 'Online' },
  { id: 'idle', label: 'Idle' },
  { id: 'dnd', label: 'DND' },
  { id: 'offline', label: 'Offline' },
];

export function CommunityPage() {
  const { navigate, setProfileId } = useApp();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<DiscordStatus | 'all'>('all');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [members, setMembers] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    setMembers(data as ProfileRow[] || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const filtered = members.filter((m) => {
    if (status !== 'all' && m.discord_status !== status) return false;
    if (query && !`${m.handle} ${m.display_name} ${m.game}`.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const openProfile = (id: string) => {
    setProfileId(id);
    navigate('profile');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Community Directory"
        subtitle={`${members.length} members`}
        icon={<Users className="h-5 w-5" />}
      />

      <Panel className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1 lg:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by handle, name, game…"
              className="input-field pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-white/5 bg-ink-900/60 p-0.5">
              {statusFilters.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStatus(s.id)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                    status === s.id ? 'bg-gold-500/15 text-gold-200' : 'text-ink-300 hover:text-white',
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="flex rounded-lg border border-white/5 bg-ink-900/60 p-0.5">
              <button onClick={() => setView('grid')} className={cn('rounded-md px-3 py-1.5 text-xs font-semibold', view === 'grid' ? 'bg-gold-500/15 text-gold-200' : 'text-ink-300')}>Grid</button>
              <button onClick={() => setView('list')} className={cn('rounded-md px-3 py-1.5 text-xs font-semibold', view === 'list' ? 'bg-gold-500/15 text-gold-200' : 'text-ink-300')}>List</button>
            </div>
          </div>
        </div>
      </Panel>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gold-500" />
        </div>
      ) : filtered.length === 0 ? (
        <Panel>
          <EmptyState icon={<Users className="h-6 w-6" />} title="No members found" subtitle="Adjust your filters or search query." />
        </Panel>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m) => (
            <Panel key={m.id} hover className="cursor-pointer p-5">
              <button onClick={() => openProfile(m.id)} className="w-full text-left">
                <div className="flex items-start gap-4">
                  <Avatar initials={m.avatar_initials || '??'} accent={m.accent} status={(m.discord_status as DiscordStatus) || 'offline'} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="truncate font-display text-base font-semibold text-white">{m.handle}</h3>
                      {m.verified && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />}
                    </div>
                    <p className="truncate text-xs text-ink-300">{m.display_name}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {m.verified && <Badge variant="gold">Verified</Badge>}
                      <StatusBadge status={(m.discord_status as DiscordStatus) || 'offline'} withDot={false} />
                    </div>
                  </div>
                </div>
                <div className="mt-4 space-y-1.5 border-t border-white/5 pt-3 text-xs text-ink-300">
                  <p className="flex items-center gap-2"><Gamepad2 className="h-3.5 w-3.5 text-gold-400" /> {m.game || 'Not set'}</p>
                  <p className="flex items-center gap-2"><span className="text-ink-400">Joined</span> {new Date(m.created_at).toLocaleDateString()}</p>
                </div>
                <div className="mt-3 flex items-center justify-end text-xs font-semibold text-gold-400">
                  View profile <ArrowRight className="h-3 w-3" />
                </div>
              </button>
            </Panel>
          ))}
        </div>
      ) : (
        <Panel>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/5 text-[11px] uppercase tracking-wider text-ink-400">
                  <th className="px-5 py-3 font-semibold">Member</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="hidden px-5 py-3 font-semibold sm:table-cell">Game</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((m) => (
                  <tr key={m.id} className="table-row-hover">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar initials={m.avatar_initials || '??'} accent={m.accent} status={(m.discord_status as DiscordStatus) || 'offline'} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-white">{m.handle}</p>
                          <p className="truncate text-xs text-ink-300">{m.display_name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3"><StatusBadge status={(m.discord_status as DiscordStatus) || 'offline'} /></td>
                    <td className="hidden px-5 py-3 text-ink-200 sm:table-cell">{m.game || '—'}</td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => openProfile(m.id)} className="text-xs font-semibold text-gold-400 hover:text-gold-300">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
