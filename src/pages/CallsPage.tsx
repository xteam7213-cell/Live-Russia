import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Phone, PhoneOff, Mic, MicOff,
  Loader2, Plus, Users, Volume2, PhoneCall, Radio,
  Signal, Settings, Copy, Check,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/store/AppContext';
import { PageHeader } from '@/components/AppShell';
import { Panel, PanelHeader, Badge, EmptyState } from '@/components/ui';
import { roleIcon } from '@/lib/roleIcons';
import { cn } from '@/lib/utils';

interface CallRoom {
  id: string;
  name: string;
  created_by: string | null;
  type: string;
  status: string;
  created_at: string;
}

interface Participant {
  id: string;
  room_id: string;
  user_id: string;
  joined_at: string;
  left_at: string | null;
  muted: boolean;
  video_on: boolean;
  display_name?: string;
  handle?: string;
  avatar_initials?: string;
  accent?: string;
}

interface SignalMessage {
  id: string;
  room_id: string;
  from_user_id: string;
  to_user_id: string;
  type: string;
  payload: string;
  created_at: string;
}

export function CallsPage() {
  const { user, profile } = useApp();
  const [rooms, setRooms] = useState<CallRoom[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRoom, setActiveRoom] = useState<CallRoom | null>(null);
  const [inRoom, setInRoom] = useState(false);
  const [muted, setMuted] = useState(false);
  const [joining, setJoining] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [connectedPeers, setConnectedPeers] = useState<string[]>([]);
  const [callDuration, setCallDuration] = useState(0);
  const [speakerVolume, setSpeakerVolume] = useState(0.8);
  const [copied, setCopied] = useState(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const participantIdRef = useRef<string | null>(null);
  const inRoomRef = useRef(false);
  const activeRoomRef = useRef<CallRoom | null>(null);
  const userRef = useRef(user);
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const callTimerRef = useRef<number | null>(null);

  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { inRoomRef.current = inRoom; }, [inRoom]);
  useEffect(() => { activeRoomRef.current = activeRoom; }, [activeRoom]);

  const fetchRooms = useCallback(async () => {
    const [{ data: roomData }, { data: partData }] = await Promise.all([
      supabase.from('call_rooms').select('*').eq('status', 'active').order('created_at', { ascending: false }),
      supabase.from('call_participants').select('*').is('left_at', null),
    ]);

    const parts = partData as Participant[] || [];
    if (parts.length > 0) {
      const userIds = Array.from(new Set(parts.map((p) => p.user_id)));
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, handle, avatar_initials, accent')
        .in('id', userIds);
      const profileMap = new Map<string, { display_name: string; handle: string; avatar_initials: string; accent: string }>();
      (profiles || []).forEach((p: { id: string; display_name: string; handle: string; avatar_initials: string; accent: string }) => {
        profileMap.set(p.id, { display_name: p.display_name, handle: p.handle, avatar_initials: p.avatar_initials, accent: p.accent });
      });
      parts.forEach((p) => {
        const info = profileMap.get(p.user_id);
        if (info) {
          p.display_name = info.display_name;
          p.handle = info.handle;
          p.avatar_initials = info.avatar_initials;
          p.accent = info.accent;
        }
      });
    }

    setRooms(roomData as CallRoom[] || []);
    setParticipants(parts);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  const sendSignal = useCallback(async (toUserId: string, type: string, data: Record<string, unknown>) => {
    const u = userRef.current;
    const room = activeRoomRef.current;
    if (!u || !room) return;
    await supabase.from('call_signaling').insert({
      room_id: room.id,
      from_user_id: u.id,
      to_user_id: toUserId,
      type,
      payload: JSON.stringify(data),
    });
  }, []);

  const createPeerConnection = useCallback((remoteUserId: string, isInitiator: boolean): RTCPeerConnection => {
    const config: RTCConfiguration = {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    };
    const pc = new RTCPeerConnection(config);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sendSignal(remoteUserId, 'ice', { candidate: e.candidate });
      }
    };

    pc.ontrack = (e) => {
      let audioEl = audioElementsRef.current.get(remoteUserId);
      if (!audioEl) {
        audioEl = new Audio();
        audioEl.autoplay = true;
        audioEl.setAttribute('playsinline', '');
        audioEl.style.display = 'none';
        audioEl.volume = 0.8;
        document.body.appendChild(audioEl);
        audioElementsRef.current.set(remoteUserId, audioEl);
      }
      const stream = e.streams[0];
      if (stream && stream.getAudioTracks().length > 0) {
        audioEl.srcObject = stream;
        audioEl.play().catch(() => {
          console.warn('[WebRTC] Audio autoplay blocked for user', remoteUserId);
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setConnectedPeers((prev) => prev.includes(remoteUserId) ? prev : [...prev, remoteUserId]);
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'closed' || pc.connectionState === 'disconnected') {
        setConnectedPeers((prev) => prev.filter((id) => id !== remoteUserId));
      }
    };

    if (isInitiator) {
      pc.onnegotiationneeded = async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await sendSignal(remoteUserId, 'offer', { sdp: offer.sdp });
        } catch (err) {
          console.warn('[WebRTC] Negotiation error:', err);
        }
      };
    }

    return pc;
  }, [sendSignal]);

  const handleSignal = useCallback(async (msg: SignalMessage) => {
    const u = userRef.current;
    if (!u || msg.to_user_id !== u.id) return;
    if (!inRoomRef.current) return;

    let pc = peersRef.current.get(msg.from_user_id);
    if (!pc && msg.type === 'offer') {
      pc = createPeerConnection(msg.from_user_id, false);
      peersRef.current.set(msg.from_user_id, pc);
    }
    if (!pc) return;

    try {
      if (msg.type === 'offer') {
        await pc.setRemoteDescription({ type: 'offer', sdp: JSON.parse(msg.payload).sdp });
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendSignal(msg.from_user_id, 'answer', { sdp: answer.sdp });
      } else if (msg.type === 'answer') {
        await pc.setRemoteDescription({ type: 'answer', sdp: JSON.parse(msg.payload).sdp });
      } else if (msg.type === 'ice') {
        const candidate = JSON.parse(msg.payload).candidate;
        if (candidate) await pc.addIceCandidate(candidate);
      }
    } catch (err) {
      console.warn('[WebRTC] Signal error:', err);
    }
  }, [createPeerConnection, sendSignal]);

  // Realtime: update rooms and participants + handle signaling
  useEffect(() => {
    const channel = supabase
      .channel('calls-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'call_rooms' }, () => fetchRooms())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'call_participants' }, () => fetchRooms())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'call_signaling' }, (payload) => {
        handleSignal(payload.new as SignalMessage);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchRooms, handleSignal]);

  const joinRoom = async (room: CallRoom) => {
    if (!user) return;
    setJoining(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      stream.getAudioTracks().forEach((t) => (t.enabled = !muted));

      const { data: partData, error: partErr } = await supabase
        .from('call_participants')
        .insert({ room_id: room.id, user_id: user.id, muted, video_on: false })
        .select('*')
        .single();
      if (partErr) throw partErr;
      participantIdRef.current = (partData as Participant)?.id || null;

      activeRoomRef.current = room;
      setActiveRoom(room);
      setInRoom(true);
      inRoomRef.current = true;

      // Initiate connections to existing participants
      const existingParts = participants.filter((p) => p.room_id === room.id && p.user_id !== user.id);
      for (const p of existingParts) {
        const pc = createPeerConnection(p.user_id, true);
        peersRef.current.set(p.user_id, pc);
      }

      // Start call duration timer
      setCallDuration(0);
      callTimerRef.current = window.setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to join room';
      setError(msg.includes('Permission') || msg.includes('denied') ? 'Microphone access denied. Please allow microphone permissions in your browser.' : msg);
    }
    setJoining(false);
  };

  const leaveRoom = async () => {
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    setConnectedPeers([]);

    audioElementsRef.current.forEach((el) => {
      el.srcObject = null;
      el.remove();
    });
    audioElementsRef.current.clear();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (participantIdRef.current) {
      await supabase.from('call_participants').update({ left_at: new Date().toISOString() }).eq('id', participantIdRef.current);
    }
    participantIdRef.current = null;
    inRoomRef.current = false;
    activeRoomRef.current = null;
    setInRoom(false);
    setActiveRoom(null);
    fetchRooms();
  };

  const toggleMute = async () => {
    const newMuted = !muted;
    setMuted(newMuted);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = !newMuted));
    }
    if (participantIdRef.current) {
      await supabase.from('call_participants').update({ muted: newMuted }).eq('id', participantIdRef.current);
    }
  };

  const handleVolumeChange = (v: number) => {
    setSpeakerVolume(v);
    audioElementsRef.current.forEach((el) => { el.volume = v; });
  };

  const formatDuration = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m}:${s.toString().padStart(2, '0')}`;
  };

  const createRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !roomName.trim()) return;
    const { data, error: err } = await supabase
      .from('call_rooms')
      .insert({ name: roomName.trim(), created_by: user.id, type: 'voice', status: 'active' })
      .select('*')
      .single();
    if (err) { setError(err.message); return; }
    setShowCreate(false);
    setRoomName('');
    fetchRooms();
    if (data) joinRoom(data as CallRoom);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (inRoomRef.current) {
        peersRef.current.forEach((pc) => pc.close());
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((t) => t.stop());
        }
        audioElementsRef.current.forEach((el) => el.remove());
      }
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, []);

  const roomParticipants = activeRoom
    ? participants.filter((p) => p.room_id === activeRoom.id)
    : [];

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gold-500" />
      </div>
    );
  }

  if (inRoom && activeRoom) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={activeRoom.name}
          subtitle={`${roomParticipants.length} participant${roomParticipants.length !== 1 ? 's' : ''}`}
          icon={<PhoneCall className="h-5 w-5" />}
          actions={
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                <span className="font-mono text-xs font-semibold text-emerald-300">{formatDuration(callDuration)}</span>
              </div>
              {connectedPeers.length > 0 && (
                <Badge variant="green">
                  <Signal className="mr-1 h-3 w-3" /> {connectedPeers.length} connected
                </Badge>
              )}
            </div>
          }
        />

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            <PhoneOff className="mt-0.5 h-4 w-4 shrink-0 text-red-400" /><p>{error}</p>
          </div>
        )}

        {/* Participant grid */}
        <Panel className="p-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {roomParticipants.map((p) => {
              const isConnected = p.user_id === user?.id || connectedPeers.includes(p.user_id);
              const isSelf = p.user_id === user?.id;
              return (
                <div
                  key={p.id}
                  className={cn(
                    'flex flex-col items-center gap-3 rounded-2xl border p-5 transition-all',
                    p.muted
                      ? 'border-red-500/20 bg-red-500/5'
                      : 'border-gold-500/20 bg-gold-500/5',
                    isConnected && !p.muted && 'shadow-[0_0_20px_-5px_rgba(212,160,23,0.3)]',
                  )}
                >
                  <div className="relative">
                    {isConnected && !p.muted && (
                      <span className="absolute -inset-1 animate-pulse-ring rounded-full border-2 border-gold-500/30" />
                    )}
                    <div
                      className={cn(
                        'flex h-18 w-18 items-center justify-center rounded-full border-2 transition-all',
                        p.muted ? 'border-red-500/30 bg-red-500/10' : 'border-gold-500/30 bg-gold-500/10',
                      )}
                      style={{ width: '4.5rem', height: '4.5rem' }}
                    >
                      {p.avatar_initials ? (
                        <span className="font-display text-xl font-bold" style={{ color: p.accent || '#d4a017' }}>
                          {p.avatar_initials}
                        </span>
                      ) : p.muted ? (
                        <MicOff className="h-7 w-7 text-red-400" />
                      ) : (
                        <Mic className="h-7 w-7 text-gold-400" />
                      )}
                    </div>
                    {isConnected && !p.muted && (
                      <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-ink-900">
                        <Radio className="h-3 w-3 text-white" />
                      </span>
                    )}
                    {p.muted && (
                      <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 ring-2 ring-ink-900">
                        <MicOff className="h-3 w-3 text-white" />
                      </span>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="truncate text-sm font-semibold text-white">{p.display_name || p.handle || 'Member'}</p>
                    {isSelf ? (
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-gold-400">You</span>
                    ) : p.muted ? (
                      <span className="text-[10px] text-red-400">Muted</span>
                    ) : isConnected ? (
                      <span className="text-[10px] text-emerald-400">Speaking</span>
                    ) : (
                      <span className="text-[10px] text-ink-400">Connecting</span>
                    )}
                  </div>
                </div>
              );
            })}
            {roomParticipants.length === 1 && (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10 bg-ink-900/40 p-5">
                <Users className="h-7 w-7 text-ink-400" />
                <p className="text-[11px] text-ink-400">Waiting for others...</p>
              </div>
            )}
          </div>
        </Panel>

        {/* Professional call control bar */}
        <Panel className="p-6">
          <div className="flex flex-col items-center gap-5">
            <div className="flex items-center gap-4">
              <button
                onClick={toggleMute}
                className={cn(
                  'flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-2xl transition-all active:scale-95',
                  muted
                    ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                    : 'bg-white/5 text-ink-200 border border-white/10 hover:border-gold-500/30 hover:text-gold-400',
                )}
                title={muted ? 'Unmute' : 'Mute'}
              >
                {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                <span className="text-[9px] font-semibold uppercase tracking-wider">{muted ? 'Muted' : 'Mic'}</span>
              </button>

              <button
                onClick={leaveRoom}
                className="flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-2xl bg-red-500/80 text-white transition-all hover:bg-red-500 active:scale-95"
                title="Leave call"
              >
                <PhoneOff className="h-5 w-5" />
                <span className="text-[9px] font-semibold uppercase tracking-wider">Leave</span>
              </button>

              <div className="flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-2xl bg-white/5 text-ink-200 border border-white/10">
                <Volume2 className="h-5 w-5" />
                <span className="text-[9px] font-semibold uppercase tracking-wider">Vol</span>
              </div>
            </div>

            {/* Volume slider */}
            <div className="flex w-full max-w-xs items-center gap-3">
              <Volume2 className="h-4 w-4 shrink-0 text-ink-400" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={speakerVolume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="flex-1 accent-gold-500"
              />
              <span className="w-8 text-right font-mono text-[10px] text-ink-400">{Math.round(speakerVolume * 100)}%</span>
            </div>

            <div className="flex items-center gap-2">
              <p className="text-[10px] text-ink-400">
                {connectedPeers.length > 0
                  ? `Connected to ${connectedPeers.length} peer${connectedPeers.length !== 1 ? 's' : ''} via WebRTC`
                  : 'Establishing peer connections...'}
              </p>
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Voice Rooms"
        subtitle="Join or create community voice rooms with real-time WebRTC audio"
        icon={<Phone className="h-5 w-5" />}
        actions={
          <button onClick={() => setShowCreate(true)} className="btn-gold text-xs">
            <Plus className="h-3.5 w-3.5" /> Create Room
          </button>
        }
      />

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
          <PhoneOff className="mt-0.5 h-4 w-4 shrink-0 text-red-400" /><p>{error}</p>
        </div>
      )}

      <Panel>
        <PanelHeader title={`Active Rooms (${rooms.length})`} icon={<Phone className="h-4 w-4" />} />
        {rooms.length === 0 ? (
          <EmptyState icon={<Phone className="h-6 w-6" />} title="No Active Voice Rooms" subtitle="Create a room to start a voice call with community members." />
        ) : (
          <div className="divide-y divide-white/5">
            {rooms.map((room) => {
              const roomParts = participants.filter((p) => p.room_id === room.id);
              return (
                <div key={room.id} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-white/[0.02]">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-gold-500/20 bg-gold-500/5">
                    <Phone className="h-5 w-5 text-gold-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{room.name}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-ink-300">
                      <Users className="h-3 w-3" />
                      {roomParts.length} participant{roomParts.length !== 1 ? 's' : ''}
                      {roomParts.length > 0 && (
                        <span className="text-ink-400">
                          · {roomParts.map((p) => p.display_name || p.handle).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => joinRoom(room)}
                    disabled={joining}
                    className="btn-gold text-xs disabled:opacity-60"
                  >
                    {joining ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PhoneCall className="h-3.5 w-3.5" />}
                    Join
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <Panel className="w-full max-w-md p-6 animate-fade-up">
            <h3 className="font-display text-lg font-bold uppercase tracking-wide text-white">Create Voice Room</h3>
            <form onSubmit={createRoom} className="mt-4 space-y-4">
              <div>
                <label className="label">Room Name</label>
                <input
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="Community Lounge"
                  className="input-field"
                  required
                  autoFocus
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-ghost flex-1 text-xs">Cancel</button>
                <button type="submit" disabled={joining} className="btn-gold flex-1 text-xs">
                  {joining ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Create & Join'}
                </button>
              </div>
            </form>
          </Panel>
        </div>
      )}
    </div>
  );
}
