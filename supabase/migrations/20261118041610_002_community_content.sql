/*
# Community Content Schema: Announcements, Events, Activity, Verification, Loans, Support, Suggestions

## Overview
Creates the community-facing content tables for the LIVE RUSSIA GAMING portal.
All tables use RLS with authenticated-only access. Admin-only write where appropriate.

## New Tables

1. **announcements** — Community-wide announcements posted by staff/admins.
   - id, title, body, category, pinned, author_id, created_at

2. **events** — Community events with RSVP.
   - id, title, description, location, starts_at, ends_at, image_url, created_by, created_at

3. **event_rsvps** — Members RSVPing to events.
   - id, event_id, user_id, status (attending/maybe/declined), created_at

4. **activity_logs** — Public community activity feed entries.
   - id, user_id, type, label, detail, created_at

5. **verification_requests** — Member verification applications.
   - id, user_id, handle, game, status, notes, reviewer_id, created_at, reviewed_at

6. **loans** — Community loan records (Loan Center Management).
   - id, member_id, amount, purpose, status, officer_id, issued_date, due_date, created_at

7. **support_tickets** — Member support tickets.
   - id, user_id, subject, description, status, priority, assigned_to, created_at, updated_at

8. **suggestions** — Community suggestions with voting.
   - id, user_id, title, body, category, status, created_at

9. **suggestion_votes** — Votes on suggestions.
   - id, suggestion_id, user_id, vote (up/down), created_at

## Security
- RLS enabled on all tables.
- Public/community read for most tables (authenticated can see announcements, events, suggestions, activity).
- Write restricted: announcements/events/loans/verification by admins; suggestions/tickets by owner.
- Event RSVPs and suggestion votes are user-scoped (each user manages their own).
*/

-- =============================================================
-- ANNOUNCEMENTS
-- =============================================================
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  category text NOT NULL DEFAULT 'Community',
  pinned boolean NOT NULL DEFAULT false,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;

DROP POLICY IF EXISTS "ann_select_all" ON public.announcements;
CREATE POLICY "ann_select_all" ON public.announcements FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "ann_insert_admin" ON public.announcements;
CREATE POLICY "ann_insert_admin" ON public.announcements FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "ann_update_admin" ON public.announcements;
CREATE POLICY "ann_update_admin" ON public.announcements FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "ann_delete_admin" ON public.announcements;
CREATE POLICY "ann_delete_admin" ON public.announcements FOR DELETE
  TO authenticated USING (public.is_admin());

-- =============================================================
-- EVENTS
-- =============================================================
CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  image_url text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;

DROP POLICY IF EXISTS "events_select_all" ON public.events;
CREATE POLICY "events_select_all" ON public.events FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "events_insert_admin" ON public.events;
CREATE POLICY "events_insert_admin" ON public.events FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "events_update_admin" ON public.events;
CREATE POLICY "events_update_admin" ON public.events FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "events_delete_admin" ON public.events;
CREATE POLICY "events_delete_admin" ON public.events FOR DELETE
  TO authenticated USING (public.is_admin());

-- =============================================================
-- EVENT_RSVPS
-- =============================================================
CREATE TABLE IF NOT EXISTS public.event_rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'attending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_rsvps TO authenticated;

DROP POLICY IF EXISTS "rsvp_select_all" ON public.event_rsvps;
CREATE POLICY "rsvp_select_all" ON public.event_rsvps FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "rsvp_insert_own" ON public.event_rsvps;
CREATE POLICY "rsvp_insert_own" ON public.event_rsvps FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rsvp_update_own" ON public.event_rsvps;
CREATE POLICY "rsvp_update_own" ON public.event_rsvps FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rsvp_delete_own" ON public.event_rsvps;
CREATE POLICY "rsvp_delete_own" ON public.event_rsvps FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- =============================================================
-- ACTIVITY_LOGS
-- =============================================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'announcement',
  label text NOT NULL,
  detail text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.activity_logs TO authenticated;

DROP POLICY IF EXISTS "activity_select_all" ON public.activity_logs;
CREATE POLICY "activity_select_all" ON public.activity_logs FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "activity_insert_all" ON public.activity_logs;
CREATE POLICY "activity_insert_all" ON public.activity_logs FOR INSERT
  TO authenticated WITH CHECK (true);

-- =============================================================
-- VERIFICATION_REQUESTS
-- =============================================================
CREATE TABLE IF NOT EXISTS public.verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  handle text NOT NULL,
  game text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  notes text,
  reviewer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.verification_requests TO authenticated;

-- Users can see their own requests; admins can see all
DROP POLICY IF EXISTS "verif_select_own_or_admin" ON public.verification_requests;
CREATE POLICY "verif_select_own_or_admin" ON public.verification_requests FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR public.is_admin());

-- Users can submit their own verification request
DROP POLICY IF EXISTS "verif_insert_own" ON public.verification_requests;
CREATE POLICY "verif_insert_own" ON public.verification_requests FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- Only admins can update (approve/reject)
DROP POLICY IF EXISTS "verif_update_admin" ON public.verification_requests;
CREATE POLICY "verif_update_admin" ON public.verification_requests FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- =============================================================
-- LOANS
-- =============================================================
CREATE TABLE IF NOT EXISTS public.loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  purpose text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  officer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  issued_date date,
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.loans TO authenticated;

-- Loan officers + admins can see all loans; members can see their own
DROP POLICY IF EXISTS "loans_select_own_or_staff" ON public.loans;
CREATE POLICY "loans_select_own_or_staff" ON public.loans FOR SELECT
  TO authenticated USING (
    auth.uid() = member_id
    OR public.is_admin()
    OR public.current_user_role() IN ('Loan Center Management', 'Loan Officer')
  );

-- Members can submit loan requests for themselves
DROP POLICY IF EXISTS "loans_insert_own" ON public.loans;
CREATE POLICY "loans_insert_own" ON public.loans FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = member_id);

-- Loan officers + admins can update loan status
DROP POLICY IF EXISTS "loans_update_staff" ON public.loans;
CREATE POLICY "loans_update_staff" ON public.loans FOR UPDATE
  TO authenticated USING (
    public.is_admin()
    OR public.current_user_role() IN ('Loan Center Management', 'Loan Officer')
  ) WITH CHECK (
    public.is_admin()
    OR public.current_user_role() IN ('Loan Center Management', 'Loan Officer')
  );

-- =============================================================
-- SUPPORT_TICKETS
-- =============================================================
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'normal',
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;

-- Users see their own tickets; support team + admins see all
DROP POLICY IF EXISTS "tickets_select_own_or_staff" ON public.support_tickets;
CREATE POLICY "tickets_select_own_or_staff" ON public.support_tickets FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id
    OR public.is_admin()
    OR public.current_user_role() IN ('Support Team', 'Junior Administrator')
  );

-- Users can create their own tickets
DROP POLICY IF EXISTS "tickets_insert_own" ON public.support_tickets;
CREATE POLICY "tickets_insert_own" ON public.support_tickets FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- Users can update their own (e.g. close); support/admins can update any
DROP POLICY IF EXISTS "tickets_update_own_or_staff" ON public.support_tickets;
CREATE POLICY "tickets_update_own_or_staff" ON public.support_tickets FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin() OR public.current_user_role() IN ('Support Team', 'Junior Administrator'))
  WITH CHECK (auth.uid() = user_id OR public.is_admin() OR public.current_user_role() IN ('Support Team', 'Junior Administrator'));

-- =============================================================
-- SUGGESTIONS
-- =============================================================
CREATE TABLE IF NOT EXISTS public.suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'General',
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.suggestions TO authenticated;

-- All authenticated users can see suggestions (community feature)
DROP POLICY IF EXISTS "sugg_select_all" ON public.suggestions;
CREATE POLICY "sugg_select_all" ON public.suggestions FOR SELECT
  TO authenticated USING (true);

-- Users can create their own suggestions
DROP POLICY IF EXISTS "sugg_insert_own" ON public.suggestions;
CREATE POLICY "sugg_insert_own" ON public.suggestions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- Users can update their own; admins can update any (change status)
DROP POLICY IF EXISTS "sugg_update_own_or_admin" ON public.suggestions;
CREATE POLICY "sugg_update_own_or_admin" ON public.suggestions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- =============================================================
-- SUGGESTION_VOTES
-- =============================================================
CREATE TABLE IF NOT EXISTS public.suggestion_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id uuid NOT NULL REFERENCES public.suggestions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  vote text NOT NULL DEFAULT 'up',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(suggestion_id, user_id)
);

ALTER TABLE public.suggestion_votes ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suggestion_votes TO authenticated;

-- All authenticated users can see votes (for vote counts)
DROP POLICY IF EXISTS "votes_select_all" ON public.suggestion_votes;
CREATE POLICY "votes_select_all" ON public.suggestion_votes FOR SELECT
  TO authenticated USING (true);

-- Users can vote (only their own vote)
DROP POLICY IF EXISTS "votes_insert_own" ON public.suggestion_votes;
CREATE POLICY "votes_insert_own" ON public.suggestion_votes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "votes_update_own" ON public.suggestion_votes;
CREATE POLICY "votes_update_own" ON public.suggestion_votes FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "votes_delete_own" ON public.suggestion_votes;
CREATE POLICY "votes_delete_own" ON public.suggestion_votes FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
