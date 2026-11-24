import { useState, useEffect, useCallback } from 'react';
import {
  Radio,
  Users,
  Circle,
  Clock,
  MinusCircle,
  Wifi,
  WifiOff,
  Server,
  RefreshCw,
  Link2,
  Unlink,
  Info,
  ShieldCheck,
  Activity as ActivityIcon,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/AppShell';
import { Panel, PanelHeader, StatCard, Badge, EmptyState } from '@/components/ui';
import { Avatar, StatusBadge, statusConfigFor } from '@/components/Status';
import type { DiscordStatus } from '@/types';
import { cn } from '@/lib/utils';

interface ProfileRow {
  id: string;
  handle: string;
  display_name: string;
  avatar_initials: string;
  accent: string;
  discord_status: string;
  discord_connected: boolean;
  discord_username: string | null;
  game: string;
  verified: boolean;
  created_at: string;
}

export function DiscordPage() {
  const [tab, setTab] = useState<'members' | 'staff' | 'sync'>('members');
  const [members, setMembers] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, handle, display_name, avatar_initials, accent, discord_status, discord_connected, discord_username, game, verified, created_at')
      .order('created_at', { ascending: false });
    setMembers((data as ProfileRow[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const counts: Record<DiscordStatus, number> = {
    online: members.filter((m) => m.discord_status === 'online').length,
    idle: members.filter((m) => m.discord_status === 'idle').length,
    dnd: members.filter((m) => m.discord_status === 'dnd').length,
    offline: members.filter((m) => m.discord_status === 'offline').length,
  };

  const discordLinked = members.filter((m) => m.discord_connected);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Discord Status Center"
        subtitle="Member presence and Discord integration"
        icon={<Radio className="h-5 w-5" />}
      />

      {/* Integration status banner */}
      <Panel className="relative overflow-hidden border-amber-500/20">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300">
              <Unlink className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-white">
                Discord integration — not connected
              </h3>
              <p className="mt-1 max-w-2xl text-xs text-ink-300">
                This Status Center is prepared for future Discord Bot API integration. Live presence requires
                authorized bot credentials, the required privileged intents (Presence + Server Members), and explicit
                server permissions. Status shown below reflects portal profile data, not live Discord presence.
              </p>
            </div>
          </div>
          <button className="btn-outline shrink-0 text-xs" disabled>
            <Link2 className="h-3.5 w-3.5" /> Connect Discord (soon)
          </button>
        </div>
      </Panel>

      {/* Status summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatusSummaryCard status="online" count={counts.online} icon={<Circle className="h-5 w-5" />} />
        <StatusSummaryCard status="idle" count={counts.idle} icon={<Clock className="h-5 w-5" />} />
        <StatusSummaryCard status="dnd" count={counts.dnd} icon={<MinusCircle className="h-5 w-5" />} />
        <StatusSummaryCard status="offline" count={counts.offline} icon={<WifiOff className="h-5 w-5" />} />
      </div>

      {/* Sync overview */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader title="Server Synchronization" subtitle="Portal Discord data" icon={<Server className="h-4 w-4" />} />
          <div className="space-y-4 p-5">
            <SyncRow label="Portal members" value={members.length.toString()} icon={<Users className="h-4 w-4" />} />
            <SyncRow label="Discord linked" value={discordLinked.length.toString()} icon={<ShieldCheck className="h-4 w-4" />} />
            <SyncRow label="Not linked" value={(members.length - discordLinked.length).toString()} icon={<RefreshCw className="h-4 w-4" />} />
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] text-amber-200/80">
              Real Discord sync requires an authorized Discord bot with the Server Members privileged intent.
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Connection Status" icon={<Wifi className="h-4 w-4" />} />
          <div className="space-y-3 p-5">
            <ConnectionRow label="Bot connection" value="Not configured" connected={false} />
            <ConnectionRow label="Presence intent" value="Not granted" connected={false} />
            <ConnectionRow label="Members intent" value="Not granted" connected={false} />
            <ConnectionRow label="Webhook" value="Not configured" connected={false} />
            <div className="flex items-start gap-2 rounded-lg border border-white/5 bg-ink-900/50 p-3 text-[11px] text-ink-300">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-400" />
              <p>Privileged intents are required to read presence and member lists. They must be approved in the Discord Developer Portal and enabled on the server.</p>
            </div>
          </div>
        </Panel>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-white/5 bg-ink-900/60 p-1">
        {([
          { id: 'members' as const, label: 'Member Activity' },
          { id: 'staff' as const, label: 'Staff Activity' },
          { id: 'sync' as const, label: 'Sync Overview' },
        ]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex-1 rounded-md px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors',
              tab === t.id ? 'bg-gold-500/15 text-gold-200' : 'text-ink-300 hover:text-white',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gold-500" />
        </div>
      ) : members.length === 0 ? (
        <Panel>
          <EmptyState icon={<Users className="h-6 w-6" />} title="No members yet" subtitle="Portal members will appear here once they register." />
        </Panel>
      ) : (
        <>
          {tab === 'members' && (
            <Panel>
              <PanelHeader title="Member Presence" subtitle="Portal member status" icon={<ActivityIcon className="h-4 w-4" />} />
              <div className="divide-y divide-white/5">
                {members.map((m) => (
                  <div
                    key={m.id}
                    className="flex w-full items-center gap-4 px-5 py-3.5 table-row-hover"
                  >
                    <Avatar initials={m.avatar_initials || '??'} accent={m.accent} status={(m.discord_status as DiscordStatus) || 'offline'} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-white">{m.handle}</p>
                      <p className="truncate text-xs text-ink-300">
                        {m.discord_connected ? `@${m.discord_username}` : 'No Discord linked'}
                      </p>
                    </div>
                    <StatusBadge status={(m.discord_status as DiscordStatus) || 'offline'} />
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {tab === 'staff' && (
            <Panel>
              <PanelHeader title="Staff Presence" subtitle="Staff Discord activity" icon={<ShieldCheck className="h-4 w-4" />} />
              <div className="divide-y divide-white/5">
                {discordLinked.length === 0 ? (
                  <EmptyState icon={<ShieldCheck className="h-6 w-6" />} title="No Discord-linked staff" subtitle="Staff with connected Discord accounts will appear here." />
                ) : discordLinked.map((m) => (
                  <div
                    key={m.id}
                    className="flex w-full items-center gap-4 px-5 py-3.5 table-row-hover"
                  >
                    <Avatar initials={m.avatar_initials || '??'} accent={m.accent} status={(m.discord_status as DiscordStatus) || 'offline'} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-white">{m.handle}</p>
                      <p className="truncate text-xs text-ink-300">@{m.discord_username}</p>
                    </div>
                    <StatusBadge status={(m.discord_status as DiscordStatus) || 'offline'} />
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {tab === 'sync' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Panel>
                <PanelHeader title="Portal ↔ Discord" subtitle="Member mapping" icon={<Server className="h-4 w-4" />} />
                <div className="space-y-2 p-4">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 rounded-lg border border-white/5 bg-ink-900/40 p-3">
                      <Avatar initials={m.avatar_initials || '??'} accent={m.accent} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">{m.handle}</p>
                        <p className="truncate text-xs text-ink-300">
                          {m.discord_connected ? `@${m.discord_username}` : 'No Discord linked'}
                        </p>
                      </div>
                      {m.discord_connected ? (
                        <Badge variant="green">Linked</Badge>
                      ) : (
                        <Badge variant="amber">Not Linked</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel>
                <PanelHeader title="Privacy & Permissions" icon={<ShieldCheck className="h-4 w-4" />} />
                <div className="space-y-3 p-5 text-xs text-ink-300">
                  <PrivacyRow text="Only public presence (online/idle/dnd/offline) is displayed." />
                  <PrivacyRow text="Private messages are never monitored or exposed." />
                  <PrivacyRow text="Last seen appears only when legitimately available via the bot API." />
                  <PrivacyRow text="Members can disconnect their Discord account at any time." />
                  <PrivacyRow text="All presence data is fetched server-side via an authorized bot." />
                </div>
              </Panel>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatusSummaryCard({
  status,
  count,
  icon,
}: {
  status: DiscordStatus;
  count: number;
  icon: React.ReactNode;
}) {
  const c = statusConfigFor(status);
  return (
    <StatCard
      label={c.label}
      value={count}
      icon={icon}
      accent={status === 'online' ? 'green' : status === 'idle' ? 'amber' : status === 'dnd' ? 'red' : 'gold'}
    />
  );
}

function SyncRow({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-sm text-ink-200">
        <span className="text-gold-400">{icon}</span> {label}
      </span>
      <span className="font-display text-lg font-bold text-white">{value}</span>
    </div>
  );
}

function ConnectionRow({ label, value, connected }: { label: string; value: string; connected: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 pb-3 last:border-0">
      <span className="text-sm text-ink-200">{label}</span>
      <span className={cn('flex items-center gap-1.5 text-xs font-semibold', connected ? 'text-emerald-300' : 'text-ink-400')}>
        <span className={cn('h-1.5 w-1.5 rounded-full', connected ? 'bg-emerald-400' : 'bg-ink-500')} />
        {value}
      </span>
    </div>
  );
}

function PrivacyRow({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-white/5 bg-ink-900/40 p-3">
      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
      <span>{text}</span>
    </div>
  );
}
