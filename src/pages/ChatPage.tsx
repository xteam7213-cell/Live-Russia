import { useState, useEffect, useCallback, useRef } from 'react';
import { Send, Reply, Trash2, ArrowLeft, AtSign, Circle, Paperclip } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/store/AppContext';
import { PageHeader } from '@/components/AppShell';
import { hasPermission } from '@/lib/rbac';
import { notifyMention, notifyReply } from '@/lib/notifications';

interface ChatMessage {
  id: string;
  user_id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  avatar_initials: string;
  accent: string;
  role: string;
  secondary_role: string | null;
  body: string;
  reply_to: string | null;
  reply_preview: string | null;
  mentions: string[] | null;
  deleted: boolean;
  deleted_by: string | null;
  created_at: string;
}

interface PresenceEntry {
  user_id: string;
  status: string;
  last_seen: string;
}

const PAGE_SIZE = 50;

export function ChatPage() {
  const { profile, user, rbacRole, secondaryRole, refreshProfile } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [presence, setPresence] = useState<PresenceEntry[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [mentionQuery, setMentionQuery] = useState<{ start: number; query: string } | null>(null);
  const [mentionMembers, setMentionMembers] = useState<{ handle: string; display_name: string }[]>([]);
  const [timeoutActive, setTimeoutActive] = useState(false);
  const [timeoutExpiry, setTimeoutExpiry] = useState<string | null>(null);
  const [banned, setBanned] = useState(false);
  const [memberProfiles, setMemberProfiles] = useState<{ id: string; handle: string; avatar_url: string | null; avatar_initials: string; accent: string }[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const allProfilesRef = useRef<{ id: string; handle: string; avatar_url: string | null; avatar_initials: string; accent: string }[]>([]);

  const canModerate = hasPermission(rbacRole, 'moderation.tools') || hasPermission(rbacRole, 'moderation.ban');
  const canDeleteAny = canModerate || hasPermission(rbacRole, 'admin.access');

  const checkBanAndTimeout = useCallback(async () => {
    if (!user) return;
    const now = new Date().toISOString();
    const [{ data: activeBans }, { data: activeTimeouts }] = await Promise.all([
      supabase.from('bans').select('id,expires_at').eq('user_id', user.id).eq('active', true).or(`expires_at.is.null,expires_at.gt.${now}`),
      supabase.from('chat_timeouts').select('id,expires_at').eq('user_id', user.id).eq('active', true).gt('expires_at', now),
    ]);
    if (activeBans && activeBans.length > 0) {
      setBanned(true);
      return;
    }
    setBanned(false);
    if (activeTimeouts && activeTimeouts.length > 0) {
      setTimeoutActive(true);
      setTimeoutExpiry(activeTimeouts[0].expires_at);
    } else {
      setTimeoutActive(false);
      setTimeoutExpiry(null);
    }
  }, [user]);

  const loadMessages = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setMessages((data || []).reverse());
    setLoading(false);
  }, []);

  const loadPresence = useCallback(async () => {
    const [presenceRes, profileRes] = await Promise.all([
      supabase.from('member_presence').select('user_id,status,last_seen'),
      supabase.from('profiles').select('id,handle,avatar_url,avatar_initials,accent'),
    ]);
    setPresence(presenceRes.data || []);
    const profiles = (profileRes.data as { id: string; handle: string; avatar_url: string | null; avatar_initials: string; accent: string }[]) || [];
    setMemberProfiles(profiles);
    allProfilesRef.current = profiles;
  }, []);

  const updatePresence = useCallback(async (status: string) => {
    if (!user) return;
    await supabase.from('member_presence').upsert({
      user_id: user.id,
      status,
      last_seen: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  }, [user]);

  useEffect(() => {
    loadMessages();
    loadPresence();
    checkBanAndTimeout();
    updatePresence('online');

    const channel = supabase
      .channel('community-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        setMessages((prev) => [...prev, payload.new as ChatMessage]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages' }, (payload) => {
        const updated = payload.new as ChatMessage;
        setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_messages' }, (payload) => {
        setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
      })
      .subscribe();

    const presenceChannel = supabase
      .channel('chat-presence')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'member_presence' }, () => {
        loadPresence();
      })
      .subscribe();

    const timeoutChannel = supabase
      .channel('chat-timeouts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_timeouts' }, () => {
        checkBanAndTimeout();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bans' }, () => {
        checkBanAndTimeout();
      })
      .subscribe();

    const handleVisibility = () => {
      updatePresence(document.hidden ? 'idle' : 'online');
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const beforeUnload = () => updatePresence('offline');
    window.addEventListener('beforeunload', beforeUnload);

    return () => {
      channel.unsubscribe();
      presenceChannel.unsubscribe();
      timeoutChannel.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', beforeUnload);
      updatePresence('offline');
    };
  }, [loadMessages, loadPresence, checkBanAndTimeout, updatePresence]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleMentionSearch = useCallback(async (query: string) => {
    if (query.length < 1) {
      setMentionMembers([]);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('handle,display_name')
      .ilike('handle', `${query}%`)
      .limit(5);
    setMentionMembers(data || []);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);
    const cursorPos = e.target.selectionStart ?? val.length;
    const beforeCursor = val.substring(0, cursorPos);
    const atMatch = beforeCursor.match(/@(\w*)$/);
    if (atMatch) {
      const start = beforeCursor.lastIndexOf('@');
      setMentionQuery({ start, query: atMatch[1] });
      handleMentionSearch(atMatch[1]);
    } else {
      setMentionQuery(null);
      setMentionMembers([]);
    }
  };

  const insertMention = (handle: string) => {
    if (!mentionQuery) return;
    const before = input.substring(0, mentionQuery.start);
    const after = input.substring(mentionQuery.start + mentionQuery.query.length + 1);
    const newVal = `${before}@${handle} ${after}`;
    setInput(newVal);
    setMentionQuery(null);
    setMentionMembers([]);
    inputRef.current?.focus();
  };

  const parseMentions = (text: string): string[] => {
    const matches = text.match(/@(\w+)/g);
    return matches ? matches.map((m) => m.substring(1)) : [];
  };

  const handleSend = async () => {
    if (!input.trim() || !user || !profile) return;
    if (banned) {
      setError('You are banned and cannot send messages.');
      return;
    }
    if (timeoutActive) {
      setError(`You are timed out until ${new Date(timeoutExpiry || '').toLocaleString()}.`);
      return;
    }
    setSending(true);
    setError(null);

    const mentions = parseMentions(input);
    const roleStr = rbacRole as string;
    const secRoleStr = secondaryRole as string | null;

    const { error: insertErr } = await supabase.from('chat_messages').insert({
      user_id: user.id,
      handle: profile.handle,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      avatar_initials: profile.avatar_initials,
      accent: profile.accent,
      role: roleStr,
      secondary_role: secRoleStr,
      body: input.trim(),
      reply_to: replyTo?.id || null,
      reply_preview: replyTo ? `${replyTo.display_name}: ${replyTo.body.substring(0, 80)}` : null,
      mentions,
    });

    if (insertErr) {
      setError(insertErr.message);
    } else {
      if (mentions.length > 0) {
        const { data: mentionedProfiles } = await supabase
          .from('profiles')
          .select('id')
          .in('handle', mentions);
        for (const mp of mentionedProfiles || []) {
          if (mp.id !== user.id) {
            notifyMention(mp.id, profile.handle, 'chat');
          }
        }
      }
      if (replyTo && replyTo.user_id !== user.id) {
        notifyReply(replyTo.user_id, profile.handle, replyTo.body);
      }
      setInput('');
      setReplyTo(null);
    }
    setSending(false);
  };

  const handleDelete = async (msg: ChatMessage) => {
    if (!user) return;
    const isOwn = msg.user_id === user.id;
    if (!isOwn && !canDeleteAny) return;

    if (isOwn) {
      const { error: updErr } = await supabase
        .from('chat_messages')
        .update({ deleted: true, deleted_by: user.id })
        .eq('id', msg.id);
      if (updErr) setError(updErr.message);
    } else {
      const { error: delErr } = await supabase
        .from('chat_messages')
        .delete()
        .eq('id', msg.id);
      if (delErr) setError(delErr.message);
    }
  };

  const onlineMembers = presence.filter((p) => p.status === 'online');
  const offlineMembers = presence.filter((p) => p.status !== 'online');

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
  };

  const renderMessageBody = (body: string) => {
    const parts = body.split(/(@\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        const handle = part.substring(1);
        return (
          <span key={i} className="font-semibold text-gold-400 hover:underline cursor-pointer">
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-gold-500/30 border-t-gold-500" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="General Chat" subtitle="Real-time community messaging for all members" icon={<AtSign className="h-5 w-5" />} />

      {banned && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          You are currently banned from the community. You can read messages but cannot participate.
        </div>
      )}

      {timeoutActive && timeoutExpiry && (
        <div className="mb-4 rounded-lg border border-orange-500/30 bg-orange-500/10 p-3 text-sm text-orange-300">
          You are timed out from chat until {new Date(timeoutExpiry).toLocaleString()}.
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>
      )}

      <div className="grid gap-3 sm:gap-4 lg:grid-cols-[1fr_240px]">
        {/* Chat area */}
        <div className="panel flex flex-col" style={{ height: 'calc(100vh - 200px)', minHeight: '350px' }}>
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 scrollbar-thin space-y-3">
            {messages.length === 0 && (
              <div className="flex h-full items-center justify-center text-center text-sm text-ink-400">
                <div>
                  <AtSign className="mx-auto mb-2 h-8 w-8 text-ink-500" />
                  <p>No messages yet. Start the conversation!</p>
                </div>
              </div>
            )}
            {messages.map((msg) => {
              const isOwn = user?.id === msg.user_id;
              return (
                <div key={msg.id} className="group flex gap-3 animate-fade-up">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-ink-800">
                    {msg.avatar_url ? (
                      <img src={msg.avatar_url} alt={msg.handle} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-white" style={{ color: msg.accent || '#d4a017' }}>
                        {msg.avatar_initials || msg.handle.substring(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white">{msg.display_name || msg.handle}</span>
                      <span className="text-[10px] text-ink-400">{formatTime(msg.created_at)}</span>
                    </div>
                    {msg.reply_preview && (
                      <div className="mt-1 flex items-center gap-1.5 rounded-md border-l-2 border-gold-500/40 bg-white/[0.03] px-2 py-1 text-xs text-ink-400">
                        <Reply className="h-3 w-3 shrink-0" />
                        <span className="truncate">{msg.reply_preview}</span>
                      </div>
                    )}
                    {msg.deleted ? (
                      <p className="mt-1 text-sm italic text-ink-500">Message deleted</p>
                    ) : (
                      <p className="mt-1 text-sm text-ink-100 break-words">{renderMessageBody(msg.body)}</p>
                    )}
                    <div className="mt-1 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                      {!msg.deleted && (
                        <button
                          onClick={() => setReplyTo(msg)}
                          className="flex items-center gap-1 text-[10px] text-ink-400 hover:text-gold-400"
                        >
                          <Reply className="h-3 w-3" /> Reply
                        </button>
                      )}
                      {!msg.deleted && (isOwn || canDeleteAny) && (
                        <button
                          onClick={() => handleDelete(msg)}
                          className="flex items-center gap-1 text-[10px] text-ink-400 hover:text-red-400"
                        >
                          <Trash2 className="h-3 w-3" /> Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply preview */}
          {replyTo && (
            <div className="flex items-center gap-2 border-t border-white/5 px-4 py-2 text-xs text-ink-300">
              <ArrowLeft className="h-3 w-3 text-gold-400" />
              <span className="truncate flex-1">Replying to {replyTo.display_name}: {replyTo.body.substring(0, 60)}</span>
              <button onClick={() => setReplyTo(null)} className="text-ink-400 hover:text-white">
                <span className="text-xs">Cancel</span>
              </button>
            </div>
          )}

          {/* Mention suggestions */}
          {mentionQuery && mentionMembers.length > 0 && (
            <div className="border-t border-white/5 px-4 py-2">
              {mentionMembers.map((m) => (
                <button
                  key={m.handle}
                  onClick={() => insertMention(m.handle)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink-200 hover:bg-white/5"
                >
                  <AtSign className="h-3 w-3 text-gold-400" />
                  <span className="font-semibold text-white">{m.handle}</span>
                  <span className="text-ink-400">{m.display_name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex items-center gap-2 border-t border-white/5 p-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={banned || timeoutActive ? 'You cannot send messages right now…' : 'Type a message… use @ to mention someone'}
              disabled={banned || timeoutActive}
              className="input-field flex-1 disabled:opacity-50"

            />
            <button
              onClick={handleSend}
              disabled={sending || !input.trim() || banned || timeoutActive}
              className="btn-gold shrink-0 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Presence sidebar */}
        <div className="panel hidden flex-col lg:flex" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          <div className="border-b border-white/5 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-300">Members</h3>
            <p className="mt-0.5 text-[10px] text-ink-400">{onlineMembers.length} online · {offlineMembers.length} offline</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
            {onlineMembers.length > 0 && (
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-green-400/80">Online</p>
            )}
            {onlineMembers.map((p) => {
              const mp = allProfilesRef.current.find((m) => m.id === p.user_id);
              return (
                <div key={p.user_id} className="flex items-center gap-2 rounded-md px-2 py-1.5">
                  <div className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-ink-800">
                    {mp?.avatar_url ? (
                      <img src={mp.avatar_url} alt={mp.handle} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-bold" style={{ color: mp?.accent || '#d4a017' }}>
                        {mp?.avatar_initials || '??'}
                      </span>
                    )}
                    <Circle className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 fill-green-400 text-green-400" />
                  </div>
                  <span className="text-xs text-ink-200">{mp?.handle || 'Member'}</span>
                </div>
              );
            })}
            {offlineMembers.length > 0 && (
              <p className="mt-3 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-400">Offline</p>
            )}
            {offlineMembers.slice(0, 20).map((p) => {
              const mp = allProfilesRef.current.find((m) => m.id === p.user_id);
              return (
                <div key={p.user_id} className="flex items-center gap-2 rounded-md px-2 py-1.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/5 bg-ink-850">
                    {mp?.avatar_url ? (
                      <img src={mp.avatar_url} alt={mp.handle} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-bold text-ink-400">
                        {mp?.avatar_initials || '??'}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-ink-400">{mp?.handle || 'Member'}</span>
                  <span className="ml-auto text-[9px] text-ink-500">{new Date(p.last_seen).toLocaleDateString()}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
