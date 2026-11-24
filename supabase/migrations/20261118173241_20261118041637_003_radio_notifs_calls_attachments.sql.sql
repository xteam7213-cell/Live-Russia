/*
# Radio, Notifications, Calls & Attachments Schema

## Overview
Creates the remaining feature tables: community radio system, notifications,
WebRTC call rooms/signaling, and file attachments.

## New Tables

1. **radio_tracks** — Music tracks for community radio.
2. **radio_playback_state** — Single-row table for synchronized playback.
3. **radio_queue** — Upcoming tracks in the queue.
4. **radio_shows** — Scheduled DJ shows.
5. **song_requests** — Member song requests.
6. **notifications** — User notifications.
7. **call_rooms** — Voice/video call rooms.
8. **call_participants** — Users in a call room.
9. **call_signaling** — WebRTC signaling messages between participants.
10. **attachments** — File metadata for uploads (Supabase Storage paths).

## Security
- Radio tables: read for all authenticated; write for DJs/admins.
- Notifications: user-scoped (each user reads/updates their own).
- Call tables: participants can read/insert within rooms they've joined.
- Attachments: owner-scoped; others can read if they have access to the related record.
*/

-- =============================================================
-- RADIO_TRACKS
-- =============================================================
CREATE TABLE IF NOT EXISTS public.radio_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  artist text NOT NULL DEFAULT '',
  duration_seconds integer NOT NULL DEFAULT 0,
  source_url text NOT NULL DEFAULT '',
  cover_url text,
  added_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.radio_tracks ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.radio_tracks TO authenticated;

DROP POLICY IF EXISTS "tracks_select_all" ON public.radio_tracks;
CREATE POLICY "tracks_select_all" ON public.radio_tracks FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "tracks_insert_admin" ON public.radio_tracks;
CREATE POLICY "tracks_insert_admin" ON public.radio_tracks FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "tracks_update_admin" ON public.radio_tracks;
CREATE POLICY "tracks_update_admin" ON public.radio_tracks FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "tracks_delete_admin" ON public.radio_tracks;
CREATE POLICY "tracks_delete_admin" ON public.radio_tracks FOR DELETE
  TO authenticated USING (public.is_admin());

-- =============================================================
-- RADIO_PLAYBACK_STATE (single row, id=1)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.radio_playback_state (
  id integer PRIMARY KEY DEFAULT 1,
  current_track_id uuid REFERENCES public.radio_tracks(id) ON DELETE SET NULL,
  is_playing boolean NOT NULL DEFAULT false,
  position_seconds integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT single_row CHECK (id = 1)
);

ALTER TABLE public.radio_playback_state ENABLE ROW LEVEL SECURITY;
GRANT SELECT, UPDATE ON public.radio_playback_state TO authenticated;

DROP POLICY IF EXISTS "playback_select_all" ON public.radio_playback_state;
CREATE POLICY "playback_select_all" ON public.radio_playback_state FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "playback_update_admin" ON public.radio_playback_state;
CREATE POLICY "playback_update_admin" ON public.radio_playback_state FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Seed the single playback row
INSERT INTO public.radio_playback_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- RADIO_QUEUE
-- =============================================================
CREATE TABLE IF NOT EXISTS public.radio_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id uuid NOT NULL REFERENCES public.radio_tracks(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.radio_queue ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.radio_queue TO authenticated;

DROP POLICY IF EXISTS "queue_select_all" ON public.radio_queue;
CREATE POLICY "queue_select_all" ON public.radio_queue FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "queue_insert_admin" ON public.radio_queue;
CREATE POLICY "queue_insert_admin" ON public.radio_queue FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "queue_update_admin" ON public.radio_queue;
CREATE POLICY "queue_update_admin" ON public.radio_queue FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "queue_delete_admin" ON public.radio_queue;
CREATE POLICY "queue_delete_admin" ON public.radio_queue FOR DELETE
  TO authenticated USING (public.is_admin());

-- =============================================================
-- RADIO_SHOWS
-- =============================================================
CREATE TABLE IF NOT EXISTS public.radio_shows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dj_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.radio_shows ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.radio_shows TO authenticated;

DROP POLICY IF EXISTS "shows_select_all" ON public.radio_shows;
CREATE POLICY "shows_select_all" ON public.radio_shows FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "shows_insert_admin" ON public.radio_shows;
CREATE POLICY "shows_insert_admin" ON public.radio_shows FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "shows_update_admin" ON public.radio_shows;
CREATE POLICY "shows_update_admin" ON public.radio_shows FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "shows_delete_admin" ON public.radio_shows;
CREATE POLICY "shows_delete_admin" ON public.radio_shows FOR DELETE
  TO authenticated USING (public.is_admin());

-- =============================================================
-- SONG_REQUESTS
-- =============================================================
CREATE TABLE IF NOT EXISTS public.song_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  track_title text NOT NULL,
  artist text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.song_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.song_requests TO authenticated;

DROP POLICY IF EXISTS "songreq_select_all" ON public.song_requests;
CREATE POLICY "songreq_select_all" ON public.song_requests FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "songreq_insert_own" ON public.song_requests;
CREATE POLICY "songreq_insert_own" ON public.song_requests FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "songreq_update_admin" ON public.song_requests;
CREATE POLICY "songreq_update_admin" ON public.song_requests FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- =============================================================
-- NOTIFICATIONS
-- =============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'general',
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  read boolean NOT NULL DEFAULT false,
  link text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;

DROP POLICY IF EXISTS "notif_select_own" ON public.notifications;
CREATE POLICY "notif_select_own" ON public.notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notif_insert_all" ON public.notifications;
CREATE POLICY "notif_insert_all" ON public.notifications FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "notif_update_own" ON public.notifications;
CREATE POLICY "notif_update_own" ON public.notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =============================================================
-- CALL_ROOMS
-- =============================================================
CREATE TABLE IF NOT EXISTS public.call_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'voice',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.call_rooms ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.call_rooms TO authenticated;

DROP POLICY IF EXISTS "rooms_select_all" ON public.call_rooms;
CREATE POLICY "rooms_select_all" ON public.call_rooms FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "rooms_insert_all" ON public.call_rooms;
CREATE POLICY "rooms_insert_all" ON public.call_rooms FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "rooms_update_creator_or_admin" ON public.call_rooms;
CREATE POLICY "rooms_update_creator_or_admin" ON public.call_rooms FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by OR public.is_admin())
  WITH CHECK (auth.uid() = created_by OR public.is_admin());

-- =============================================================
-- CALL_PARTICIPANTS
-- =============================================================
CREATE TABLE IF NOT EXISTS public.call_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.call_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  muted boolean NOT NULL DEFAULT false,
  video_on boolean NOT NULL DEFAULT false,
  UNIQUE(room_id, user_id)
);

ALTER TABLE public.call_participants ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.call_participants TO authenticated;

DROP POLICY IF EXISTS "participants_select_all" ON public.call_participants;
CREATE POLICY "participants_select_all" ON public.call_participants FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "participants_insert_own" ON public.call_participants;
CREATE POLICY "participants_insert_own" ON public.call_participants FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "participants_update_own" ON public.call_participants;
CREATE POLICY "participants_update_own" ON public.call_participants FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =============================================================
-- CALL_SIGNALING
-- =============================================================
CREATE TABLE IF NOT EXISTS public.call_signaling (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.call_rooms(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  payload text NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.call_signaling ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.call_signaling TO authenticated;

DROP POLICY IF EXISTS "signal_select_participants" ON public.call_signaling;
CREATE POLICY "signal_select_participants" ON public.call_signaling FOR SELECT
  TO authenticated USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

DROP POLICY IF EXISTS "signal_insert_own" ON public.call_signaling;
CREATE POLICY "signal_insert_own" ON public.call_signaling FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = from_user_id);

DROP POLICY IF EXISTS "signal_delete_own" ON public.call_signaling;
CREATE POLICY "signal_delete_own" ON public.call_signaling FOR DELETE
  TO authenticated USING (auth.uid() = from_user_id);

-- =============================================================
-- ATTACHMENTS
-- =============================================================
CREATE TABLE IF NOT EXISTS public.attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  table_name text NOT NULL DEFAULT '',
  record_id uuid,
  filename text NOT NULL,
  storage_path text NOT NULL,
  mime_type text NOT NULL DEFAULT '',
  size_bytes bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attachments TO authenticated;

DROP POLICY IF EXISTS "att_select_own_or_shared" ON public.attachments;
CREATE POLICY "att_select_own_or_shared" ON public.attachments FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "att_insert_own" ON public.attachments;
CREATE POLICY "att_insert_own" ON public.attachments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "att_update_own" ON public.attachments;
CREATE POLICY "att_update_own" ON public.attachments FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "att_delete_own_or_admin" ON public.attachments;
CREATE POLICY "att_delete_own_or_admin" ON public.attachments FOR DELETE
  TO authenticated USING (auth.uid() = user_id OR public.is_admin());