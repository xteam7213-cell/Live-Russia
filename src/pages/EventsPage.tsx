import { useState, useEffect, useCallback } from 'react';
import { CalendarDays, Plus, Loader2, AlertCircle, MapPin, Users, Check, X, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/store/AppContext';
import { PageHeader } from '@/components/AppShell';
import { Panel, Badge, EmptyState } from '@/components/ui';
import { cn } from '@/lib/utils';

interface EventItem {
  id: string;
  title: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string | null;
  image_url: string | null;
}

interface RSVP {
  id: string;
  event_id: string;
  user_id: string;
  status: 'attending' | 'maybe' | 'declined';
}

export function EventsPage() {
  const { user, profile } = useApp();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [rsvps, setRsvps] = useState<RSVP[]>([]);
  const [allRsvps, setAllRsvps] = useState<RSVP[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: eventData }, { data: rsvpData }] = await Promise.all([
      supabase.from('events').select('*').order('starts_at', { ascending: true }),
      supabase.from('event_rsvps').select('id, event_id, user_id, status'),
    ]);
    setEvents(eventData as EventItem[] || []);
    setAllRsvps(rsvpData as RSVP[] || []);
    setRsvps((rsvpData as RSVP[] || []).filter((r) => r.user_id === user?.id));
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRSVP = async (eventId: string, status: 'attending' | 'maybe' | 'declined') => {
    if (!user) return;
    const existing = rsvps.find((r) => r.event_id === eventId);
    if (existing) {
      await supabase.from('event_rsvps').update({ status }).eq('id', existing.id);
    } else {
      await supabase.from('event_rsvps').insert({ event_id: eventId, user_id: user.id, status });
    }
    fetchData();
  };

  const getRSVPCount = (eventId: string, status: string) => {
    return allRsvps.filter((r) => r.event_id === eventId && r.status === status).length;
  };

  const getUserRSVP = (eventId: string) => {
    return rsvps.find((r) => r.event_id === eventId);
  };

  const formatDate = (d: string) => {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  const formatTime = (d: string) => {
    return new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div>
      <PageHeader
        title="Community Events"
        subtitle="Upcoming events, tournaments and gatherings"
        icon={<CalendarDays className="h-5 w-5" />}
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gold-500" />
        </div>
      ) : events.length === 0 ? (
        <Panel className="p-6">
          <EmptyState icon={<CalendarDays className="h-6 w-6" />} title="No events scheduled" subtitle="Check back soon for upcoming community events and tournaments." />
        </Panel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {events.map((ev) => {
            const userRSVP = getUserRSVP(ev.id);
            const attending = getRSVPCount(ev.id, 'attending');
            const maybe = getRSVPCount(ev.id, 'maybe');
            return (
              <Panel key={ev.id} hover className="overflow-hidden">
                <div className="relative h-32 bg-gradient-to-br from-gold-500/20 via-ink-850 to-ink-900">
                  <div className="pointer-events-none absolute inset-0 bg-radial-gold opacity-30" />
                  <div className="absolute bottom-3 left-4 right-4">
                    <div className="flex items-center gap-2 text-gold-300">
                      <CalendarDays className="h-4 w-4" />
                      <span className="text-xs font-semibold uppercase tracking-wider">{formatDate(ev.starts_at)}</span>
                    </div>
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="font-display text-base font-bold text-white">{ev.title}</h3>
                  {ev.description && <p className="mt-1 text-sm text-ink-200">{ev.description}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink-300">
                    {ev.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {ev.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {formatTime(ev.starts_at)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" /> {attending} attending
                    </span>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => handleRSVP(ev.id, 'attending')}
                      className={cn(
                        'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
                        userRSVP?.status === 'attending'
                          ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300'
                          : 'border-white/10 bg-white/5 text-ink-200 hover:border-emerald-500/30 hover:text-emerald-300'
                      )}
                    >
                      <Check className="h-3.5 w-3.5" /> Attending
                    </button>
                    <button
                      onClick={() => handleRSVP(ev.id, 'maybe')}
                      className={cn(
                        'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
                        userRSVP?.status === 'maybe'
                          ? 'border-amber-500/40 bg-amber-500/20 text-amber-300'
                          : 'border-white/10 bg-white/5 text-ink-200 hover:border-amber-500/30 hover:text-amber-300'
                      )}
                    >
                      <Clock className="h-3.5 w-3.5" /> Maybe
                    </button>
                    <button
                      onClick={() => handleRSVP(ev.id, 'declined')}
                      className={cn(
                        'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
                        userRSVP?.status === 'declined'
                          ? 'border-red-500/40 bg-red-500/20 text-red-300'
                          : 'border-white/10 bg-white/5 text-ink-200 hover:border-red-500/30 hover:text-red-300'
                      )}
                    >
                      <X className="h-3.5 w-3.5" /> Decline
                    </button>
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
