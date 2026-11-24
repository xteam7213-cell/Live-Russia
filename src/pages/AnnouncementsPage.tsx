import { useState, useEffect, useCallback } from 'react';
import { Megaphone, Pin, Search, Calendar, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/AppShell';
import { Panel, Badge, EmptyState } from '@/components/ui';
import { Avatar } from '@/components/Status';
import { cn } from '@/lib/utils';

interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  category: string;
  pinned: boolean;
  author_id: string | null;
  created_at: string;
  profiles?: { handle: string; avatar_initials: string; accent: string } | null;
}

const categoryVariant: Record<string, 'gold' | 'green' | 'blue' | 'amber' | 'violet' | 'red'> = {
  Community: 'green',
  Event: 'violet',
  Policy: 'gold',
  System: 'blue',
  Staff: 'amber',
};

const categories: string[] = ['all', 'Community', 'Event', 'Policy', 'System', 'Staff'];

export function AnnouncementsPage() {
  const [cat, setCat] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('announcements')
      .select('*, profiles:announcements_author_id_fkey(handle, avatar_initials, accent)')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });
    setAnnouncements(data as AnnouncementRow[] || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAnnouncements(); }, [fetchAnnouncements]);

  const filtered = announcements
    .filter((a) => cat === 'all' || a.category === cat)
    .filter((a) => !query || `${a.title} ${a.body}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements"
        subtitle="From the Command Council and departments"
        icon={<Megaphone className="h-5 w-5" />}
      />

      <Panel className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search announcements…"
              className="input-field pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                  cat === c
                    ? 'bg-gold-500/15 text-gold-200 border border-gold-500/40'
                    : 'bg-ink-900/60 text-ink-300 border border-white/5 hover:text-white',
                )}
              >
                {c === 'all' ? 'All' : c}
              </button>
            ))}
          </div>
        </div>
      </Panel>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gold-500" />
        </div>
      ) : filtered.length === 0 ? (
        <Panel>
          <EmptyState icon={<Megaphone className="h-6 w-6" />} title="No announcements found" subtitle="Try a different category or search." />
        </Panel>
      ) : (
        <div className="space-y-4">
          {filtered.map((a) => (
            <Panel key={a.id} hover className="overflow-hidden">
              <div className={cn('h-1 w-full', a.pinned ? 'bg-gold-gradient' : 'bg-white/5')} />
              <div className="p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={categoryVariant[a.category] || 'neutral'}>{a.category}</Badge>
                  {a.pinned && (
                    <Badge variant="gold">
                      <Pin className="h-3 w-3" /> Pinned
                    </Badge>
                  )}
                  <span className="ml-auto flex items-center gap-1.5 text-xs text-ink-400">
                    <Calendar className="h-3 w-3" /> {new Date(a.created_at).toLocaleDateString()}
                  </span>
                </div>

                <h2 className="mt-3 font-display text-xl font-bold text-white">{a.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-200">{a.body}</p>

                <div className="mt-4 flex items-center gap-2 border-t border-white/5 pt-4">
                  {a.profiles && <Avatar initials={a.profiles.avatar_initials} accent={a.profiles.accent} size="sm" />}
                  <div className="text-xs">
                    <p className="font-semibold text-white">{a.profiles?.handle || 'Staff'}</p>
                    <p className="text-ink-400">Command Council</p>
                  </div>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
