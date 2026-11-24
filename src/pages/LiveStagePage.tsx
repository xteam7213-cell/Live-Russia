import { useState, useEffect, useCallback, useRef } from 'react';
import { Mic, MicOff, Radio, Users, Plus, X, Calendar, Clock, Video, MessageSquare, Send, Trash2, Circle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/store/AppContext';
import { PageHeader } from '@/components/AppShell';
import { RoleBadges, RoleName } from '@/components/RoleBadge';
import { type RbacRole } from '@/lib/rbac';

interface LiveShow {
  id: string;
  host_id: string | null;
  host_handle: string;
  title: string;
  description: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  is_live: boolean;
  audience_count: number;
  created_at: string;
}

interface LiveChatMsg {
  id: string;
  show_id: string;
  user_id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  avatar_initials: string;
  accent: string;
  role: string;
  body: string;
  deleted: boolean;
  created_at: string;
}

export function LiveStagePage() {
  const { profile, user, rbacRole, secondaryRole } = useApp();
  const [shows, setShows] = useState<LiveShow[]>([]);
  const [chatMessages, setChatMessages] = useState<LiveChatMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');
  const [micOn, setMicOn] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [selectedShow, setSelectedShow] = useState<LiveShow | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const canHost = rbacRole === 'Server Owner' || rbacRole === 'Administrator' || rbacRole === 'Project Team' || rbacRole === 'Support Team';

  const loadShows = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('live_shows')
      .select('*')
      .order('scheduled_start', { ascending: false, nullsFirst: false })
      .limit(20);
    if (err) { setError(err.message); setLoading(false); return; }
    setShows(data || []);
    const live = (data || []).find((s) => s.is_live);
    if (live) setSelectedShow(live);
    setLoading(false);
  }, []);

  const loadChat = useCallback(async (showId: string) => {
    const { data } = await supabase
      .from('live_chat_messages')
      .select('*')
      .eq('show_id', showId)
      .order('created_at', { ascending: true })
      .limit(100);
    setChatMessages(data || []);
  }, []);

  useEffect(() => {
    loadShows();
    const channel = supabase
      .channel('live-shows')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_shows' }, (payload) => {
        loadShows();
        if (payload.eventType === 'UPDATE' && payload.new && (payload.new as LiveShow).is_live) {
          setSelectedShow(payload.new as LiveShow);
        }
      })
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [loadShows]);

  useEffect(() => {
    if (selectedShow?.id) {
      loadChat(selectedShow.id);
      const chatChannel = supabase
        .channel(`live-chat-${selectedShow.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_chat_messages', filter: `show_id=eq.${selectedShow.id}` }, (payload) => {
          setChatMessages((prev) => [...prev, payload.new as LiveChatMsg]);
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'live_chat_messages', filter: `show_id=eq.${selectedShow.id}` }, (payload) => {
          setChatMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
        })
        .subscribe();
      return () => { chatChannel.unsubscribe(); };
    }
  }, [selectedShow, loadChat]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleStartShow = async () => {
    if (!user || !profile || !formTitle.trim()) return;
    const { data, error: insErr } = await supabase.from('live_shows').insert({
      host_id: user.id,
      host_handle: profile.handle,
      title: formTitle.trim(),
      description: formDesc.trim(),
      scheduled_start: formStart || null,
      scheduled_end: formEnd || null,
      is_live: true,
    }).select().single();
    if (insErr) { setError(insErr.message); return; }
    setShowForm(false);
    setFormTitle('');
    setFormDesc('');
    setFormStart('');
    setFormEnd('');
    setSelectedShow(data);
    loadShows();
  };

  const handleGoLive = async (show: LiveShow) => {
    if (!user || show.host_id !== user.id) return;
    const { error: updErr } = await supabase.from('live_shows').update({ is_live: true }).eq('id', show.id);
    if (updErr) { setError(updErr.message); return; }
    setSelectedShow({ ...show, is_live: true });
    loadShows();
  };

  const handleEndShow = async (show: LiveShow) => {
    if (!user || show.host_id !== user.id) return;
    const { error: updErr } = await supabase.from('live_shows').update({ is_live: false }).eq('id', show.id);
    if (updErr) { setError(updErr.message); return; }
    if (selectedShow?.id === show.id) setSelectedShow(null);
    loadShows();
    stopMic();
  };

  const handleDeleteShow = async (show: LiveShow) => {
    if (!user || (show.host_id !== user.id && rbacRole !== 'Server Owner' && rbacRole !== 'Administrator')) return;
    if (!confirm('Delete this show?')) return;
    const { error: delErr } = await supabase.from('live_shows').delete().eq('id', show.id);
    if (delErr) { setError(delErr.message); return; }
    if (selectedShow?.id === show.id) setSelectedShow(null);
    loadShows();
  };

  const startMic = async () => {
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      setMicOn(true);
    } catch (err) {
      setMicError('Microphone access denied. Please allow microphone permissions in your browser settings.');
      setMicOn(false);
    }
  };

  const stopMic = () => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    setMicOn(false);
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || !user || !profile || !selectedShow) return;
    const roleStr = rbacRole as string;
    const { error: insErr } = await supabase.from('live_chat_messages').insert({
      show_id: selectedShow.id,
      user_id: user.id,
      handle: profile.handle,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      avatar_initials: profile.avatar_initials,
      accent: profile.accent,
      role: roleStr,
      body: chatInput.trim(),
    });
    if (insErr) { setError(insErr.message); return; }
    setChatInput('');
  };

  const handleDeleteChat = async (msg: LiveChatMsg) => {
    if (!user) return;
    if (msg.user_id !== user.id && rbacRole !== 'Server Owner' && rbacRole !== 'Administrator') return;
    await supabase.from('live_chat_messages').delete().eq('id', msg.id);
  };

  const formatDateTime = (ts: string | null) => {
    if (!ts) return '—';
    return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-gold-500/30 border-t-gold-500" />
      </div>
    );
  }

  const liveShow = shows.find((s) => s.is_live);

  return (
    <div>
      <PageHeader
        title="Live Stage"
        subtitle="Live broadcasts, shows and community sessions"
        icon={<Mic className="h-5 w-5" />}
        actions={canHost && !showForm ? (
          <button onClick={() => setShowForm(true)} className="btn-gold">
            <Plus className="h-4 w-4" /> Schedule Show
          </button>
        ) : undefined}
      />

      {error && <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
      {micError && <div className="mb-4 rounded-lg border border-orange-500/30 bg-orange-500/10 p-3 text-sm text-orange-300">{micError}</div>}

      {/* Show form */}
      {showForm && (
        <div className="mb-6 panel p-5 animate-fade-up">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg font-bold uppercase tracking-wide text-white">New Live Show</h3>
            <button onClick={() => setShowForm(false)} className="text-ink-300 hover:text-white"><X className="h-5 w-5" /></button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="label">Show Title</label>
              <input type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Friday Night Live…" className="input-field" maxLength={120} />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="What is this show about?" className="input-field min-h-[80px] resize-y" maxLength={500} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Start Time</label>
                <input type="datetime-local" value={formStart} onChange={(e) => setFormStart(e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="label">End Time</label>
                <input type="datetime-local" value={formEnd} onChange={(e) => setFormEnd(e.target.value)} className="input-field" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleStartShow} disabled={!formTitle.trim()} className="btn-gold disabled:opacity-40">
                <Radio className="h-4 w-4" /> Go Live Now
              </button>
              <button onClick={() => setShowForm(false)} className="btn-ghost">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Live broadcast area */}
      {liveShow && (
        <div className="mb-6 panel overflow-hidden">
          <div className="relative bg-gradient-to-br from-ink-900 via-ink-950 to-black p-6 sm:p-8">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-red-500/5 to-transparent" />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 rounded-full bg-red-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-400">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                    </span>
                    LIVE
                  </span>
                  <span className="text-xs text-ink-400">{liveShow.audience_count} listening</span>
                </div>
                <h2 className="mt-2 font-display text-2xl font-bold text-white sm:text-3xl">{liveShow.title}</h2>
                {liveShow.description && <p className="mt-1 text-sm text-ink-300">{liveShow.description}</p>}
                <p className="mt-2 text-xs text-ink-400">Host: <span className="font-semibold text-gold-300">{liveShow.host_handle}</span></p>
              </div>

              {/* Mic controls */}
              {liveShow.host_id === user?.id && (
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={micOn ? stopMic : startMic}
                    className={`flex h-16 w-16 items-center justify-center rounded-full border-2 transition-all ${
                      micOn
                        ? 'border-red-500/50 bg-red-500/20 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.3)]'
                        : 'border-gold-500/40 bg-gold-500/10 text-gold-400 hover:border-gold-500/60'
                    }`}
                  >
                    {micOn ? <MicOff className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
                  </button>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-300">
                    {micOn ? 'On Air' : 'Mic Off'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Live chat */}
          <div className="border-t border-white/5">
            <div className="border-b border-white/5 px-4 py-2">
              <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-300">
                <MessageSquare className="h-3.5 w-3.5 text-gold-400" /> Live Chat
              </h3>
            </div>
            <div className="max-h-[300px] overflow-y-auto p-4 scrollbar-thin space-y-2">
              {chatMessages.length === 0 && (
                <p className="text-center text-sm text-ink-500 py-4">No chat messages yet. Say something!</p>
              )}
              {chatMessages.map((msg) => {
                const msgRole = (msg.role as RbacRole) || 'Normal Member';
                const isOwn = user?.id === msg.user_id;
                return (
                  <div key={msg.id} className="group flex gap-2 animate-fade-up">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: msg.accent }}>
                      {msg.avatar_initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <RoleName role={msgRole} className="text-xs">{msg.display_name}</RoleName>
                        <span className="text-[9px] text-ink-400">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-sm text-ink-100 break-words">{msg.body}</p>
                    </div>
                    {(isOwn || rbacRole === 'Server Owner' || rbacRole === 'Administrator') && (
                      <button onClick={() => handleDeleteChat(msg)} className="opacity-0 group-hover:opacity-100 text-ink-400 hover:text-red-400">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>
            <div className="flex items-center gap-2 border-t border-white/5 p-3">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSendChat(); } }}
                placeholder="Send a message…"
                className="input-field flex-1"
                maxLength={300}
              />
              <button onClick={handleSendChat} disabled={!chatInput.trim()} className="btn-gold shrink-0 disabled:opacity-40">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>

          {liveShow.host_id === user?.id && (
            <div className="border-t border-white/5 p-3 text-center">
              <button onClick={() => handleEndShow(liveShow)} className="btn-ghost text-red-400 hover:border-red-500/30">
                End Show
              </button>
            </div>
          )}
        </div>
      )}

      {/* Upcoming & past shows */}
      <div className="space-y-4">
        <h3 className="font-display text-sm font-bold uppercase tracking-wider text-ink-300">All Shows</h3>
        {shows.length === 0 && (
          <div className="panel flex flex-col items-center justify-center p-12 text-center">
            <Video className="mb-3 h-12 w-12 text-ink-500" />
            <p className="text-sm text-ink-400">No shows scheduled yet. {canHost && 'Use "Schedule Show" to create one.'}</p>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {shows.map((show) => (
            <div key={show.id} className="panel panel-hover p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {show.is_live ? (
                      <span className="flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[9px] font-bold uppercase text-red-400">
                        <Circle className="h-2 w-2 fill-red-400" /> LIVE
                      </span>
                    ) : (
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-bold uppercase text-ink-400">Scheduled</span>
                    )}
                    <span className="truncate text-xs text-ink-400">{show.host_handle}</span>
                  </div>
                  <h4 className="mt-1 font-display text-base font-bold text-white">{show.title}</h4>
                  {show.description && <p className="mt-1 text-xs text-ink-300 line-clamp-2">{show.description}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-ink-400">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDateTime(show.scheduled_start)}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDateTime(show.scheduled_end)}</span>
                    {show.is_live && <span className="flex items-center gap-1 text-gold-400"><Users className="h-3 w-3" /> {show.audience_count}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  {show.host_id === user?.id && !show.is_live && (
                    <button onClick={() => handleGoLive(show)} className="rounded-md bg-gold-500/10 px-2 py-1 text-[10px] font-semibold text-gold-400 hover:bg-gold-500/20">
                      Go Live
                    </button>
                  )}
                  {show.host_id === user?.id && (
                    <button onClick={() => handleDeleteShow(show)} className="rounded-md p-1 text-ink-400 hover:text-red-400" title="Delete">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
