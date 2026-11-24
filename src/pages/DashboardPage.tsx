import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Shield, Users, Megaphone,
  Activity as ActivityIcon, Radio, ArrowRight, Sparkles, Loader2,
  CalendarDays, Lightbulb, LifeBuoy, Music, Crown, Zap, TrendingUp,
  Gamepad2, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/store/AppContext';
import { Panel, PanelHeader, StatCard, Badge } from '@/components/ui';
import { Avatar, StatusBadge } from '@/components/Status';

interface ActivityRow {
  id: string;
  label: string;
  detail: string;
  created_at: string;
  profiles?: { handle: string; avatar_initials: string; accent: string } | null;
}

interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  category: string;
  created_at: string;
}

interface ProfileRow {
  id: string;
  handle: string;
  display_name: string;
  avatar_initials: string;
  accent: string;
  discord_status: string;
  verified: boolean;
  game: string;
  reputation: number;
}

const GAME_SCREENSHOTS = [
  'https://play-lh.googleusercontent.com/qXExqxvfs4qz3ySrh-RenAJzEc3mGOoSeZ37RarY2L61HNCm9oYvh2nOR3MxLRBGsfl8XJRbN1ErNccq73-TwAs=w1052-h592-rw',
  'https://play-lh.googleusercontent.com/mdJc8hrYC-fFLoGT2b1xz_5aWaRUg8SOdCc85XQZkYm4jZz1zTcIHboJUddfIqBb8gBtuZh3kh3Rfy__0IKF=w1052-h592-rw',
  'https://play-lh.googleusercontent.com/9xq7bJ__B550x8bBRpGpJOGtNyM8Za6K67PWKTKXEPmRibG1yK4b56ohXKk3CDmpCayvylrYA1vuQ2IgJn8hzw=w1052-h592-rw',
  'https://play-lh.googleusercontent.com/vT3upOU7FVPvOyYQ9kZIU71RaHuim55kNmOGFN2xCMpbsEbnEL-U628HnGednqpfSpZqFsCtx_IrYW7rG9Yhmg=w1052-h592-rw',
  'https://play-lh.googleusercontent.com/w-GDUJzk9UpgEA95gE02Yr-f5VswvEHdv_AkW-AAmzdLgqKf6yzYQUZ5SwffCBtkJkFGPYn5wIdt_WIPDa2g=w1052-h592-rw',
  'https://play-lh.googleusercontent.com/H65GDNHuQ8xSJr25uYq04K173U0ef7EoIY4OpAGJSmlX_fz4zAMbn11hwLn9WFc3uZItf86Xpr3_j8yOiJAK=w1052-h592-rw',
  'https://play-lh.googleusercontent.com/gMKggjzSao85wQXiPdg5Z-df2B0-pN8gz-2LB0IVzPSN5DM0_WVamLWG8AafIUH7j_zmx9v2adAw_QN9Kxy3FA=w1052-h592-rw',
  'https://play-lh.googleusercontent.com/AZky4GR2SeKbxq42DKgJB_SQq92JlCxFzAkhKoHCVrKOCXVyOeon-B-k-NC98_ameAACfVSsMpHy2FD__FsAqQ=w1052-h592-rw',
];

const APP_ICON = 'https://play-lh.googleusercontent.com/vvjbsFDeRiEOQ7IJ_9dNkGCMtK6qVfWkrTYHTc9f9LXupObXSAvFmAJTuhFyv477y43sHXrkwFgtXSDxs_9MYu4=s192-rw';

const MARQUEE_ITEMS = [
  { label: 'LIVE RUSSIA GAMING', icon: <Crown className="h-5 w-5" /> },
  { label: 'Community Portal', icon: <Users className="h-5 w-5" /> },
  { label: 'Staff HQ', icon: <Shield className="h-5 w-5" /> },
  { label: 'Music & Radio', icon: <Music className="h-5 w-5" /> },
  { label: 'Live Stage', icon: <Radio className="h-5 w-5" /> },
  { label: 'Events', icon: <CalendarDays className="h-5 w-5" /> },
  { label: 'Voice Rooms', icon: <Zap className="h-5 w-5" /> },
  { label: 'Community Chat', icon: <Sparkles className="h-5 w-5" /> },
];

function AnimatedCounter({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (value <= 0) { setDisplay(0); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value, duration]);

  return <span className="animate-count">{display}</span>;
}

function GameShowcase() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [isAuto, setIsAuto] = useState(true);

  useEffect(() => {
    if (!isAuto) return;
    const interval = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % GAME_SCREENSHOTS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [isAuto]);

  const goPrev = () => { setIsAuto(false); setActiveIdx((prev) => (prev - 1 + GAME_SCREENSHOTS.length) % GAME_SCREENSHOTS.length); };
  const goNext = () => { setIsAuto(false); setActiveIdx((prev) => (prev + 1) % GAME_SCREENSHOTS.length); };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gold-500/15 bg-ink-900/60">
      <div className="bg-radial-gold-strong pointer-events-none absolute inset-0 opacity-60" />
      <div className="hero-grid pointer-events-none absolute inset-0 opacity-30" />

      <div className="relative px-3 py-4 sm:px-8 sm:py-8">
        <div className="mb-4 flex items-center justify-between gap-3 sm:mb-5">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <img
              src={APP_ICON}
              alt="LIVE RUSSIA GAMING"
              className="h-10 w-10 rounded-lg border border-gold-500/30 object-cover sm:h-14 sm:w-14"
              loading="lazy"
            />
            <div>
              <h2 className="font-display text-sm font-bold uppercase tracking-wide text-white sm:text-xl">
                Live <span className="gold-text">Russia</span> Gaming
              </h2>
              <p className="text-[9px] uppercase tracking-[0.12em] text-ink-300 sm:text-xs">Official Game Showcase</p>
            </div>
          </div>
          <span className="hidden items-center gap-1.5 rounded-full border border-gold-500/20 bg-gold-500/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gold-300 sm:flex">
            <Gamepad2 className="h-3 w-3" /> Open World RPG
          </span>
        </div>

        {/* Screenshot carousel */}
        <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-gold-500/10 bg-ink-950 sm:rounded-xl">
          {GAME_SCREENSHOTS.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={`LIVE RUSSIA GAMING screenshot ${i + 1}`}
              className="absolute inset-0 h-full w-full object-cover transition-all duration-700"
              style={{
                opacity: i === activeIdx ? 1 : 0,
                transform: i === activeIdx ? 'scale(1)' : 'scale(1.05)',
              }}
              loading={i === 0 ? 'eager' : 'lazy'}
            />
          ))}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950/40 via-transparent to-transparent" />

          <button
            onClick={goPrev}
            className="absolute left-1.5 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-gold-500/20 bg-ink-950/70 text-gold-300 backdrop-blur-sm transition-all hover:bg-gold-500/20 hover:text-gold-200 sm:left-2 sm:h-9 sm:w-9"
            aria-label="Previous screenshot"
          >
            <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
          <button
            onClick={goNext}
            className="absolute right-1.5 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-gold-500/20 bg-ink-950/70 text-gold-300 backdrop-blur-sm transition-all hover:bg-gold-500/20 hover:text-gold-200 sm:right-2 sm:h-9 sm:w-9"
            aria-label="Next screenshot"
          >
            <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>

          <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 gap-1.5 sm:bottom-3">
            {GAME_SCREENSHOTS.map((_, i) => (
              <button
                key={i}
                onClick={() => { setIsAuto(false); setActiveIdx(i); }}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === activeIdx ? 'w-5 bg-gold-400 sm:w-6' : 'w-1.5 bg-white/30 hover:bg-white/50'}`}
                aria-label={`Go to screenshot ${i + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Thumbnail strip - hidden on small mobile */}
        <div className="mt-3 hidden gap-2 overflow-x-auto scrollbar-thin sm:mt-4 sm:flex">
          {GAME_SCREENSHOTS.map((src, i) => (
            <button
              key={i}
              onClick={() => { setIsAuto(false); setActiveIdx(i); }}
              className={`relative h-16 w-28 shrink-0 overflow-hidden rounded-lg border-2 transition-all duration-300 ${i === activeIdx ? 'border-gold-500/60 opacity-100' : 'border-transparent opacity-50 hover:opacity-80'}`}
            >
              <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { navigate } = useApp();
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [onlineMembers, setOnlineMembers] = useState<ProfileRow[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [announcementCount, setAnnouncementCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [
      { data: actData },
      { data: annData },
      { data: profData },
      { count: mCount },
      { count: aCount },
    ] = await Promise.all([
      supabase.from('activity_logs').select('*, profiles:activity_logs_user_id_fkey(handle, avatar_initials, accent)').order('created_at', { ascending: false }).limit(5),
      supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(3),
      supabase.from('profiles').select('*').neq('discord_status', 'offline').limit(6),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('announcements').select('*', { count: 'exact', head: true }),
    ]);
    setActivity(actData as ActivityRow[] || []);
    setAnnouncements(annData as AnnouncementRow[] || []);
    setOnlineMembers(profData as ProfileRow[] || []);
    setMemberCount(mCount || 0);
    setAnnouncementCount(aCount || 0);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gold-500" />
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-8">
      {/* Game showcase - now at the top */}
      <GameShowcase />

      {/* Branding marquee */}
      <div className="marquee-paused relative overflow-hidden rounded-xl border border-gold-500/15 bg-ink-900/60 py-3 sm:py-4">
        <div className="flex animate-marquee whitespace-nowrap">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
            <div key={i} className="flex items-center gap-2.5 px-4 sm:px-6">
              <span className="text-gold-400">{item.icon}</span>
              <span className="font-display text-xs font-bold uppercase tracking-widest text-ink-200 sm:text-sm">{item.label}</span>
              <span className="ml-4 text-gold-500/30 sm:ml-6">·</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stat cards with animated counters */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Total Members" value={<AnimatedCounter value={memberCount} />} icon={<Users className="h-5 w-5" />} accent="gold" />
        <StatCard label="Online Now" value={<AnimatedCounter value={onlineMembers.length} />} icon={<Radio className="h-5 w-5" />} accent="green" />
        <StatCard label="Announcements" value={<AnimatedCounter value={announcementCount} />} icon={<Megaphone className="h-5 w-5" />} accent="amber" />
        <StatCard label="Recent Activity" value={<AnimatedCounter value={activity.length} />} icon={<ActivityIcon className="h-5 w-5" />} accent="blue" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Recent activity */}
        <Panel className="lg:col-span-2">
          <PanelHeader
            title="Recent Activity"
            subtitle="Community-wide events"
            icon={<ActivityIcon className="h-4 w-4" />}
            action={<button onClick={() => navigate('activity')} className="btn-ghost px-2 py-1 text-[11px] sm:px-3 sm:py-1.5 sm:text-xs">View all <ArrowRight className="h-3 w-3" /></button>}
          />
          <div className="divide-y divide-white/5">
            {activity.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-300">No recent activity.</p>
            ) : activity.map((a) => (
              <div key={a.id} className="flex items-start gap-2.5 px-3 py-3 table-row-hover sm:gap-3 sm:px-5 sm:py-3.5">
                {a.profiles && <Avatar initials={a.profiles.avatar_initials} accent={a.profiles.accent} size="sm" />}
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-white sm:text-sm">
                    <span className="font-semibold">{a.profiles?.handle || 'System'}</span>{' '}
                    <span className="text-ink-300">— {a.label}</span>
                  </p>
                  <p className="truncate text-xs text-ink-300">{a.detail}</p>
                </div>
                <span className="shrink-0 font-mono text-[10px] text-ink-400 sm:text-[11px]">{new Date(a.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* Latest announcements */}
        <Panel>
          <PanelHeader
            title="Latest"
            subtitle="Recent announcements"
            icon={<Megaphone className="h-4 w-4" />}
            action={<button onClick={() => navigate('announcements')} className="btn-ghost px-2 py-1 text-[11px] sm:px-3 sm:py-1.5 sm:text-xs">All <ArrowRight className="h-3 w-3" /></button>}
          />
          <div className="space-y-3 p-3 sm:p-5">
            {announcements.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-300">No announcements yet.</p>
            ) : announcements.map((an) => (
              <div key={an.id} className="rounded-lg border border-gold-500/15 bg-gold-500/5 p-2.5 transition-all hover:border-gold-500/30 hover:bg-gold-500/10 sm:p-3">
                <div className="flex items-center justify-between">
                  <Badge variant="gold">{an.category}</Badge>
                  <span className="text-[10px] text-ink-400">{new Date(an.created_at).toLocaleDateString()}</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-white">{an.title}</p>
                <p className="mt-1 line-clamp-2 text-xs text-ink-300">{an.body}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Quick access + online members */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader title="Quick Access" subtitle="Jump to a section" icon={<Sparkles className="h-4 w-4" />} />
          <div className="grid grid-cols-2 gap-2 p-3 sm:gap-3 sm:p-5 sm:grid-cols-4">
            {[
              { id: 'community' as const, label: 'Community', icon: <Users className="h-5 w-5" /> },
              { id: 'staff' as const, label: 'Staff', icon: <Shield className="h-5 w-5" /> },
              { id: 'events' as const, label: 'Events', icon: <CalendarDays className="h-5 w-5" /> },
              { id: 'radio' as const, label: 'Radio', icon: <Music className="h-5 w-5" /> },
              { id: 'suggestions' as const, label: 'Suggestions', icon: <Lightbulb className="h-5 w-5" /> },
              { id: 'support' as const, label: 'Support', icon: <LifeBuoy className="h-5 w-5" /> },
              { id: 'announcements' as const, label: 'News', icon: <Megaphone className="h-5 w-5" /> },
              { id: 'activity' as const, label: 'Activity', icon: <TrendingUp className="h-5 w-5" /> },
            ].map((q) => (
              <button
                key={q.id}
                onClick={() => navigate(q.id)}
                className="group flex flex-col items-start gap-2.5 rounded-lg border border-white/5 bg-ink-900/40 p-3 text-left transition-all duration-300 hover:border-gold-500/30 hover:bg-ink-900/80 hover:shadow-[0_0_16px_rgba(212,160,23,0.08)] sm:gap-3 sm:rounded-xl sm:p-4"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-500/10 text-gold-400 transition-all duration-300 group-hover:bg-gold-500/20 group-hover:scale-110 sm:h-10 sm:w-10">
                  {q.icon}
                </span>
                <span className="text-xs font-semibold text-white sm:text-sm">{q.label}</span>
              </button>
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Online Members" subtitle="Active now" icon={<Radio className="h-4 w-4" />} />
          <div className="space-y-1 p-2 sm:p-3">
            {onlineMembers.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-300">No members online.</p>
            ) : onlineMembers.map((m) => (
              <button
                key={m.id}
                onClick={() => navigate('community')}
                className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-white/5 sm:gap-3"
              >
                <Avatar initials={m.avatar_initials || '??'} accent={m.accent} status={(m.discord_status as 'online'|'idle'|'dnd') || 'online'} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-white sm:text-sm">{m.handle}</p>
                  <p className="truncate text-[11px] text-ink-300 sm:text-xs">{m.game || 'Member'}</p>
                </div>
                <StatusBadge status={(m.discord_status as 'online'|'idle'|'dnd') || 'online'} withDot={false} />
              </button>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
