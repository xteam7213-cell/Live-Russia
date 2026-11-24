import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Music, Play, Pause, SkipForward, Loader2, Plus, Radio,
  ListMusic, CalendarDays, Mic2, Volume2, Clock,
  Trash2, Search, Settings, Headphones, Disc3,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/store/AppContext';
import { usePermissions } from '@/lib/rbac';
import { PageHeader } from '@/components/AppShell';
import { Panel, PanelHeader, Badge, EmptyState } from '@/components/ui';
import { cn } from '@/lib/utils';

interface Track {
  id: string;
  title: string;
  artist: string;
  duration_seconds: number;
  source_url: string;
  cover_url: string | null;
}

interface PlaybackState {
  id: number;
  current_track_id: string | null;
  is_playing: boolean;
  position_seconds: number;
  updated_at: string;
}

interface QueueItem {
  id: string;
  track_id: string;
  position: number;
  track?: Track;
}

interface Show {
  id: string;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string | null;
}

interface SearchResult {
  trackId: number;
  trackName: string;
  artistName: string;
  previewUrl: string;
  artworkUrl100: string;
  trackTimeMillis: number;
  collectionName?: string;
}

function formatDuration(seconds: number) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function RadioPage() {
  const { user } = useApp();
  const { can } = usePermissions();
  const isDJ = can('admin.announcements');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playback, setPlayback] = useState<PlaybackState | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'player' | 'search' | 'queue' | 'schedule' | 'manage'>('player');
  const [volume, setVolume] = useState(0.7);
  const [trackForm, setTrackForm] = useState({ title: '', artist: '', source_url: '', duration_seconds: '0', cover_url: '' });
  const [addingTrack, setAddingTrack] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [importingId, setImportingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const syncRef = useRef<number | null>(null);

  const fetchData = useCallback(async () => {
    const [trackRes, pbRes, queueRes, showRes] = await Promise.all([
      supabase.from('radio_tracks').select('*').order('created_at', { ascending: false }),
      supabase.from('radio_playback_state').select('*').eq('id', 1).maybeSingle(),
      supabase.from('radio_queue').select('*, track:radio_tracks(*)').order('position', { ascending: true }),
      supabase.from('radio_shows').select('*').order('starts_at', { ascending: true }),
    ]);
    setTracks(trackRes.data as Track[] || []);
    setPlayback(pbRes.data as PlaybackState | null);
    setQueue(queueRes.data as QueueItem[] || []);
    setShows(showRes.data as Show[] || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime subscriptions for shared playback sync
  useEffect(() => {
    const channel = supabase
      .channel('radio-playback-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'radio_playback_state' }, (payload) => {
        const newPb = payload.new as PlaybackState;
        setPlayback(newPb);
        syncAudioFromPlayback(newPb);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'radio_queue' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'radio_tracks' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const currentTrack = tracks.find((t) => t.id === playback?.current_track_id) || null;

  // Sync audio element whenever playback state or track list changes (covers initial load + realtime updates)
  useEffect(() => {
    if (playback && tracks.length > 0) {
      syncAudioFromPlayback(playback);
    }
  }, [playback, tracks, syncAudioFromPlayback]);

  // Set initial volume on the audio element once it's available
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, []);

  const syncAudioFromPlayback = useCallback((pb: PlaybackState) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (pb.current_track_id) {
      const track = tracks.find((t) => t.id === pb.current_track_id);
      if (track && audio.src !== track.source_url) {
        audio.src = track.source_url;
        audio.load();
      }
      if (Math.abs(audio.currentTime - pb.position_seconds) > 2) {
        audio.currentTime = pb.position_seconds;
      }
      if (pb.is_playing) {
        audio.play().catch(() => {});
      } else {
        audio.pause();
      }
    } else {
      audio.pause();
      audio.src = '';
    }
  }, [tracks]);

  // Local progress tracking — periodically update position for DJs
  useEffect(() => {
    if (syncRef.current) clearInterval(syncRef.current);
    if (!playback?.is_playing || !isDJ) return;
    syncRef.current = window.setInterval(async () => {
      const audio = audioRef.current;
      if (audio && !audio.paused) {
        await supabase
          .from('radio_playback_state')
          .update({ position_seconds: Math.floor(audio.currentTime) })
          .eq('id', 1);
      }
    }, 5000);
    return () => { if (syncRef.current) clearInterval(syncRef.current); };
  }, [playback?.is_playing, isDJ]);

  // Handle track ending — auto-advance for DJs
  const handleTrackEnd = useCallback(async () => {
    if (!isDJ) return;
    const nextItem = queue[0];
    if (nextItem) {
      await supabase.from('radio_playback_state').update({
        current_track_id: nextItem.track_id,
        position_seconds: 0,
        is_playing: true,
      }).eq('id', 1);
      await supabase.from('radio_queue').delete().eq('id', nextItem.id);
    } else {
      await supabase.from('radio_playback_state').update({
        is_playing: false,
        position_seconds: 0,
      }).eq('id', 1);
    }
  }, [isDJ, queue]);

  // DJ Controls
  const togglePlayPause = async () => {
    if (!playback || !isDJ) return;
    const audio = audioRef.current;
    const newPlaying = !playback.is_playing;
    if (audio) {
      if (newPlaying) audio.play().catch(() => {});
      else audio.pause();
    }
    await supabase.from('radio_playback_state').update({
      is_playing: newPlaying,
      position_seconds: audio ? Math.floor(audio.currentTime) : playback.position_seconds,
    }).eq('id', 1);
  };

  const skipToNext = async () => {
    if (!isDJ) return;
    const nextItem = queue[0];
    if (!nextItem) return;
    await supabase.from('radio_playback_state').update({
      current_track_id: nextItem.track_id,
      position_seconds: 0,
      is_playing: true,
    }).eq('id', 1);
    await supabase.from('radio_queue').delete().eq('id', nextItem.id);
  };

  const playTrack = async (trackId: string) => {
    if (!isDJ) return;
    await supabase.from('radio_playback_state').update({
      current_track_id: trackId,
      position_seconds: 0,
      is_playing: true,
    }).eq('id', 1);
  };

  const addToQueue = async (trackId: string) => {
    const maxPos = queue.length > 0 ? Math.max(...queue.map((q) => q.position)) : 0;
    await supabase.from('radio_queue').insert({
      track_id: trackId,
      position: maxPos + 1,
    });
  };

  const removeFromQueue = async (itemId: string) => {
    if (!isDJ) return;
    await supabase.from('radio_queue').delete().eq('id', itemId);
  };

  const addTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDJ || !trackForm.title.trim() || !trackForm.source_url.trim()) return;
    setAddingTrack(true);
    await supabase.from('radio_tracks').insert({
      title: trackForm.title.trim(),
      artist: trackForm.artist.trim(),
      source_url: trackForm.source_url.trim(),
      duration_seconds: parseInt(trackForm.duration_seconds) || 0,
      cover_url: trackForm.cover_url.trim() || null,
    });
    setTrackForm({ title: '', artist: '', source_url: '', duration_seconds: '0', cover_url: '' });
    setAddingTrack(false);
    fetchData();
  };

  const deleteTrack = async (trackId: string) => {
    if (!isDJ) return;
    await supabase.from('radio_tracks').delete().eq('id', trackId);
    fetchData();
  };

  const importFromSearch = async (result: SearchResult) => {
    if (!isDJ) return;
    setImportingId(result.trackId);
    const durationSec = Math.round(result.trackTimeMillis / 1000);
    const largerCover = result.artworkUrl100?.replace('100x100', '300x300') || null;
    const { data, error } = await supabase.from('radio_tracks').insert({
      title: result.trackName,
      artist: result.artistName,
      source_url: result.previewUrl,
      duration_seconds: durationSec,
      cover_url: largerCover,
    }).select('*').single();
    if (!error && data) {
      await addToQueue(data.id);
    }
    setImportingId(null);
    fetchData();
  };

  const runSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `https://itunes.apple.com/search?media=music&entity=song&limit=20&term=${encodeURIComponent(query)}`,
      );
      const json = await res.json();
      setSearchResults((json.results || []) as SearchResult[]);
    } catch {
      setSearchResults([]);
    }
    setSearching(false);
  }, []);

  const debouncedSearch = useRef<number | null>(null);
  useEffect(() => {
    if (debouncedSearch.current) clearTimeout(debouncedSearch.current);
    if (searchQuery.trim()) {
      debouncedSearch.current = window.setTimeout(() => runSearch(searchQuery), 400);
    } else {
      setSearchResults([]);
    }
    return () => { if (debouncedSearch.current) clearTimeout(debouncedSearch.current); };
  }, [searchQuery, runSearch]);

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const formatTime = (d: string) => new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gold-500" />
      </div>
    );
  }

  const tabs = [
    { id: 'player' as const, label: 'Library', icon: <Music className="h-4 w-4" /> },
    { id: 'search' as const, label: 'Search', icon: <Search className="h-4 w-4" /> },
    { id: 'queue' as const, label: 'Queue', icon: <ListMusic className="h-4 w-4" /> },
    { id: 'schedule' as const, label: 'Schedule', icon: <CalendarDays className="h-4 w-4" /> },
    ...(isDJ ? [{ id: 'manage' as const, label: 'DJ Panel', icon: <Settings className="h-4 w-4" /> }] : []),
  ];

  return (
    <div>
      <audio ref={audioRef} onEnded={handleTrackEnd} preload="auto" />
      <PageHeader
        title="Community Radio"
        subtitle="Live music and DJ shows — shared playback synced in real time"
        icon={<Radio className="h-5 w-5" />}
        actions={isDJ ? <Badge variant="gold"><Headphones className="mr-1 h-3 w-3" /> DJ Mode</Badge> : undefined}
      />

      {/* Now Playing — premium player bar */}
      <Panel className="mb-6 overflow-hidden">
        <div className="relative">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-gold-500/5 via-transparent to-transparent" />
          <div className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
            {/* Album art */}
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border border-gold-500/20 bg-ink-850 overflow-hidden">
              {currentTrack?.cover_url ? (
                <img src={currentTrack.cover_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <Disc3 className={cn('h-10 w-10 text-gold-500', playback?.is_playing && 'animate-spin')} />
              )}
              {playback?.is_playing && currentTrack && (
                <div className="absolute inset-0 bg-gradient-to-t from-ink-950/60 to-transparent" />
              )}
              {playback?.is_playing && (
                <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex items-end gap-0.5">
                  <span className="h-2 w-0.5 animate-pulse rounded-full bg-gold-400" style={{ animationDuration: '0.6s' }} />
                  <span className="h-3 w-0.5 animate-pulse rounded-full bg-gold-400" style={{ animationDuration: '0.4s' }} />
                  <span className="h-2 w-0.5 animate-pulse rounded-full bg-gold-400" style={{ animationDuration: '0.8s' }} />
                  <span className="h-2.5 w-0.5 animate-pulse rounded-full bg-gold-400" style={{ animationDuration: '0.5s' }} />
                </div>
              )}
            </div>

            {/* Track info + progress */}
            <div className="relative min-w-0 flex-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold-400">
                {playback?.is_playing ? 'Now Playing' : playback?.current_track_id ? 'Paused' : 'Silent'}
              </p>
              <h2 className="mt-1 truncate font-display text-xl font-bold text-white sm:text-2xl">
                {currentTrack?.title || 'No track loaded'}
              </h2>
              <p className="mt-0.5 truncate text-sm text-ink-200">
                {currentTrack?.artist || '—'}
              </p>
              {currentTrack && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="font-mono text-[11px] text-ink-400">{formatDuration(playback?.position_seconds || 0)}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-700">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-gold-400 to-gold-600 transition-all duration-1000"
                      style={{ width: `${Math.min(100, ((playback?.position_seconds || 0) / (currentTrack.duration_seconds || 1)) * 100)}%` }}
                    />
                  </div>
                  <span className="font-mono text-[11px] text-ink-400">{formatDuration(currentTrack.duration_seconds)}</span>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="relative flex items-center gap-3">
              {isDJ && (
                <>
                  <button
                    onClick={togglePlayPause}
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-gold-gradient text-ink-950 transition-transform hover:scale-105 active:scale-95"
                    title={playback?.is_playing ? 'Pause' : 'Play'}
                  >
                    {playback?.is_playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                  </button>
                  <button
                    onClick={skipToNext}
                    disabled={queue.length === 0}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-ink-200 transition-colors hover:border-gold-500/30 hover:text-gold-400 disabled:opacity-40"
                    title="Skip to next in queue"
                  >
                    <SkipForward className="h-4 w-4" />
                  </button>
                </>
              )}
              {!isDJ && playback?.is_playing && (
                <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5">
                  <Radio className="h-3.5 w-3.5 animate-pulse text-emerald-400" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300">Live</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-ink-300" />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setVolume(v);
                    if (audioRef.current) audioRef.current.volume = v;
                  }}
                  className="w-20 accent-gold-500"
                />
              </div>
            </div>
          </div>
        </div>
      </Panel>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto scrollbar-thin">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold transition-colors',
              activeTab === tab.id
                ? 'border-gold-500/40 bg-gold-500/10 text-gold-300'
                : 'border-white/5 bg-white/5 text-ink-300 hover:border-white/10 hover:text-white',
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Library tab */}
      {activeTab === 'player' && (
        <Panel>
          <PanelHeader title="Track Library" subtitle={`${tracks.length} tracks available`} icon={<Music className="h-4 w-4" />} />
          {tracks.length === 0 ? (
            <EmptyState icon={<Music className="h-6 w-6" />} title="No tracks in the library" subtitle={isDJ ? "Use the Search tab to find and add music, or add tracks manually in DJ Panel." : "Tracks will appear here once added by DJs."} />
          ) : (
            <div className="divide-y divide-white/5">
              {tracks.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-white/5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/5 bg-ink-850 overflow-hidden">
                    {t.cover_url ? <img src={t.cover_url} alt="" className="h-full w-full object-cover" /> : <Music className="h-4 w-4 text-ink-300" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{t.title}</p>
                    <p className="truncate text-xs text-ink-300">{t.artist}</p>
                  </div>
                  <span className="font-mono text-xs text-ink-400">{formatDuration(t.duration_seconds)}</span>
                  {isDJ && (
                    <>
                      <button
                        onClick={() => playTrack(t.id)}
                        className="rounded-lg p-1.5 text-ink-300 hover:bg-gold-500/10 hover:text-gold-400"
                        title="Play now"
                      >
                        <Play className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => addToQueue(t.id)}
                        className="rounded-lg p-1.5 text-ink-300 hover:bg-gold-500/10 hover:text-gold-400"
                        title="Add to queue"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {/* Search tab */}
      {activeTab === 'search' && (
        <div className="space-y-4">
          <Panel className="p-5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for songs, artists, albums..."
                className="input-field pl-9"
                autoFocus
              />
            </div>
            <p className="mt-2 text-[10px] text-ink-400">
              Search powered by iTunes. Results include 30-second previews. {isDJ ? 'Import tracks to your library and queue.' : 'Ask a DJ to import tracks.'}
            </p>
          </Panel>

          {searching && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gold-500" />
            </div>
          )}

          {!searching && searchResults.length > 0 && (
            <Panel>
              <PanelHeader title="Search Results" subtitle={`${searchResults.length} tracks found`} icon={<Search className="h-4 w-4" />} />
              <div className="divide-y divide-white/5">
                {searchResults.map((r) => (
                  <div key={r.trackId} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-white/5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/5 bg-ink-850 overflow-hidden">
                      {r.artworkUrl100 ? <img src={r.artworkUrl100} alt="" className="h-full w-full object-cover" /> : <Music className="h-4 w-4 text-ink-300" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{r.trackName}</p>
                      <p className="truncate text-xs text-ink-300">{r.artistName}{r.collectionName ? ` — ${r.collectionName}` : ''}</p>
                    </div>
                    <span className="font-mono text-xs text-ink-400">{formatDuration(r.trackTimeMillis / 1000)}</span>
                    {isDJ ? (
                      <button
                        onClick={() => importFromSearch(r)}
                        disabled={importingId === r.trackId}
                        className="btn-gold text-[11px] disabled:opacity-60"
                        title="Import to library & queue"
                      >
                        {importingId === r.trackId ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                        Import
                      </button>
                    ) : (
                      <span className="text-[10px] text-ink-400">Ask a DJ to add</span>
                    )}
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {!searching && searchQuery.trim() && searchResults.length === 0 && (
            <Panel>
              <EmptyState icon={<Search className="h-6 w-6" />} title="No results found" subtitle="Try a different search term." />
            </Panel>
          )}

          {!searching && !searchQuery.trim() && (
            <Panel>
              <EmptyState icon={<Search className="h-6 w-6" />} title="Search for music" subtitle="Find songs by title, artist, or album name." />
            </Panel>
          )}
        </div>
      )}

      {/* Queue tab */}
      {activeTab === 'queue' && (
        <Panel>
          <PanelHeader title="Up Next" subtitle={`${queue.length} tracks in queue`} icon={<ListMusic className="h-4 w-4" />} />
          {queue.length === 0 ? (
            <EmptyState icon={<ListMusic className="h-6 w-6" />} title="Queue is empty" subtitle="Tracks added to the queue will appear here." />
          ) : (
            <div className="divide-y divide-white/5">
              {queue.map((q, i) => (
                <div key={q.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="font-mono text-sm text-gold-400">{i + 1}</span>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/5 bg-ink-850 overflow-hidden">
                    {q.track?.cover_url ? <img src={q.track.cover_url} alt="" className="h-full w-full object-cover" /> : <Music className="h-4 w-4 text-ink-300" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{q.track?.title || 'Unknown'}</p>
                    <p className="truncate text-xs text-ink-300">{q.track?.artist}</p>
                  </div>
                  <span className="font-mono text-xs text-ink-400">{q.track ? formatDuration(q.track.duration_seconds) : ''}</span>
                  {isDJ && (
                    <button onClick={() => removeFromQueue(q.id)} className="rounded-lg p-1.5 text-ink-300 hover:bg-red-500/10 hover:text-red-400" title="Remove">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {/* Schedule tab */}
      {activeTab === 'schedule' && (
        <Panel>
          <PanelHeader title="DJ Show Schedule" subtitle="Upcoming live shows" icon={<CalendarDays className="h-4 w-4" />} />
          {shows.length === 0 ? (
            <EmptyState icon={<CalendarDays className="h-6 w-6" />} title="No shows scheduled" subtitle="DJ shows will be listed here once scheduled." />
          ) : (
            <div className="divide-y divide-white/5">
              {shows.map((s) => (
                <div key={s.id} className="flex items-start gap-3 px-5 py-4">
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg border border-gold-500/20 bg-gold-500/5">
                    <span className="font-display text-sm font-bold text-gold-300">{new Date(s.starts_at).getDate()}</span>
                    <span className="text-[9px] uppercase text-gold-400">{new Date(s.starts_at).toLocaleDateString('en-US', { month: 'short' })}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-sm font-semibold text-white">{s.title}</h3>
                    {s.description && <p className="mt-0.5 text-xs text-ink-200">{s.description}</p>}
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-ink-400">
                      <Clock className="h-3 w-3" /> {formatTime(s.starts_at)}
                      {s.ends_at && ` — ${formatTime(s.ends_at)}`}
                    </p>
                  </div>
                  <Badge variant="gold"><Mic2 className="mr-1 h-3 w-3" /> Live Show</Badge>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {/* DJ Panel tab */}
      {activeTab === 'manage' && isDJ && (
        <div className="space-y-4">
          <Panel className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <Headphones className="h-4 w-4 text-gold-400" />
              <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-white">DJ Control Panel</h3>
            </div>
            <p className="mb-4 text-xs text-ink-300">Add tracks manually, or use the Search tab to import music. Tracks need a direct audio URL (mp3, ogg, etc.).</p>
            <form onSubmit={addTrack} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  type="text"
                  value={trackForm.title}
                  onChange={(e) => setTrackForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Track title"
                  className="input-field"
                  required
                />
                <input
                  type="text"
                  value={trackForm.artist}
                  onChange={(e) => setTrackForm((f) => ({ ...f, artist: e.target.value }))}
                  placeholder="Artist"
                  className="input-field"
                />
              </div>
              <input
                type="url"
                value={trackForm.source_url}
                onChange={(e) => setTrackForm((f) => ({ ...f, source_url: e.target.value }))}
                placeholder="Audio URL (mp3, ogg, etc.)"
                className="input-field"
                required
              />
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="label">Duration (seconds)</label>
                  <input
                    type="number"
                    value={trackForm.duration_seconds}
                    onChange={(e) => setTrackForm((f) => ({ ...f, duration_seconds: e.target.value }))}
                    placeholder="180"
                    className="input-field"
                  />
                </div>
                <div className="flex-1">
                  <label className="label">Cover art URL (optional)</label>
                  <input
                    type="url"
                    value={trackForm.cover_url}
                    onChange={(e) => setTrackForm((f) => ({ ...f, cover_url: e.target.value }))}
                    placeholder="https://..."
                    className="input-field"
                  />
                </div>
                <button type="submit" disabled={addingTrack} className="btn-gold text-xs disabled:opacity-60">
                  {addingTrack ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Add Track
                </button>
              </div>
            </form>
          </Panel>

          <Panel>
            <PanelHeader title="All Tracks" subtitle={`${tracks.length} in library`} icon={<Music className="h-4 w-4" />} />
            {tracks.length === 0 ? (
              <EmptyState icon={<Music className="h-6 w-6" />} title="No tracks yet" />
            ) : (
              <div className="divide-y divide-white/5">
                {tracks.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/5 bg-ink-850 overflow-hidden">
                      {t.cover_url ? <img src={t.cover_url} alt="" className="h-full w-full object-cover" /> : <Music className="h-4 w-4 text-ink-300" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{t.title}</p>
                      <p className="truncate text-xs text-ink-300">{t.artist}</p>
                    </div>
                    <span className="font-mono text-xs text-ink-400">{formatDuration(t.duration_seconds)}</span>
                    <button onClick={() => playTrack(t.id)} className="rounded-lg p-1.5 text-ink-300 hover:bg-gold-500/10 hover:text-gold-400" title="Play">
                      <Play className="h-4 w-4" />
                    </button>
                    <button onClick={() => deleteTrack(t.id)} className="rounded-lg p-1.5 text-ink-300 hover:bg-red-500/10 hover:text-red-400" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
