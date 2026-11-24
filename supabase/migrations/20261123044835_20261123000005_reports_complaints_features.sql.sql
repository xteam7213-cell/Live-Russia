/*
# Reports, Complaints, Loan Offers, Profile Images, New Features

## New Tables
1. member_reports — staff-filed reports against members
2. admin_complaints — confidential complaints with strict hierarchy
3. loan_offers — loan offers from Loan Center staff
4. community_rules — community rules with categories
5. chat_messages — real-time chat with mentions/replies
6. member_presence — online/offline presence
7. live_shows — live stage shows
8. live_chat_messages — live show chat
9. bans — permanent and temporary bans
10. chat_timeouts — chat timeouts
11. moderation_logs — moderation action history

## Modified Tables
- profiles: add avatar_url, cover_url columns
*/

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cover_url text;

CREATE TABLE IF NOT EXISTS public.member_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text NOT NULL,
  details text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  resolution_notes text NOT NULL DEFAULT '',
  resolver_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.member_reports ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_reports TO authenticated;

DROP POLICY IF EXISTS "reports_select_staff_or_reporter" ON public.member_reports;
CREATE POLICY "reports_select_staff_or_reporter" ON public.member_reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id OR public.is_moderator_or_above());
DROP POLICY IF EXISTS "reports_insert_staff" ON public.member_reports;
CREATE POLICY "reports_insert_staff" ON public.member_reports FOR INSERT TO authenticated
  WITH CHECK (public.is_moderator_or_above() AND auth.uid() = reporter_id);
DROP POLICY IF EXISTS "reports_update_staff" ON public.member_reports;
CREATE POLICY "reports_update_staff" ON public.member_reports FOR UPDATE TO authenticated
  USING (public.is_moderator_or_above()) WITH CHECK (public.is_moderator_or_above());
DROP POLICY IF EXISTS "reports_delete_admin" ON public.member_reports;
CREATE POLICY "reports_delete_admin" ON public.member_reports FOR DELETE TO authenticated USING (public.is_admin());

CREATE TABLE IF NOT EXISTS public.admin_complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complainant_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  accused_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  accused_role text NOT NULL,
  subject text NOT NULL,
  details text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  resolution_notes text NOT NULL DEFAULT '',
  resolver_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_complaints ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_complaints TO authenticated;

DROP POLICY IF EXISTS "complaints_select_hierarchy" ON public.admin_complaints;
CREATE POLICY "complaints_select_hierarchy" ON public.admin_complaints FOR SELECT TO authenticated
  USING (
    (auth.uid() = complainant_id)
    OR (accused_role = 'Junior Administrator' AND public.is_admin())
    OR (accused_role = 'Administrator' AND public.is_server_owner())
  );
DROP POLICY IF EXISTS "complaints_insert_any" ON public.admin_complaints;
CREATE POLICY "complaints_insert_any" ON public.admin_complaints FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = complainant_id AND auth.uid() != accused_id AND accused_role IN ('Junior Administrator', 'Administrator'));
DROP POLICY IF EXISTS "complaints_update_hierarchy" ON public.admin_complaints;
CREATE POLICY "complaints_update_hierarchy" ON public.admin_complaints FOR UPDATE TO authenticated
  USING ((accused_role = 'Junior Administrator' AND public.is_admin()) OR (accused_role = 'Administrator' AND public.is_server_owner()))
  WITH CHECK ((accused_role = 'Junior Administrator' AND public.is_admin()) OR (accused_role = 'Administrator' AND public.is_server_owner()));
DROP POLICY IF EXISTS "complaints_delete_owner" ON public.admin_complaints;
CREATE POLICY "complaints_delete_owner" ON public.admin_complaints FOR DELETE TO authenticated USING (public.is_server_owner());

CREATE TABLE IF NOT EXISTS public.loan_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  interest_rate numeric NOT NULL DEFAULT 0,
  term_days integer NOT NULL DEFAULT 30,
  purpose text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.loan_offers ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_offers TO authenticated;

DROP POLICY IF EXISTS "offers_select_stakeholder" ON public.loan_offers;
CREATE POLICY "offers_select_stakeholder" ON public.loan_offers FOR SELECT TO authenticated
  USING (auth.uid() = member_id OR auth.uid() = officer_id OR public.is_admin() OR public.current_user_role() IN ('Loan Center Management', 'Loan Officer'));
DROP POLICY IF EXISTS "offers_insert_staff" ON public.loan_offers;
CREATE POLICY "offers_insert_staff" ON public.loan_offers FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = officer_id AND (public.is_admin() OR public.current_user_role() IN ('Loan Center Management', 'Loan Officer')));
DROP POLICY IF EXISTS "offers_update_staff" ON public.loan_offers;
CREATE POLICY "offers_update_staff" ON public.loan_offers FOR UPDATE TO authenticated
  USING (auth.uid() = officer_id OR public.is_admin() OR public.current_user_role() IN ('Loan Center Management'))
  WITH CHECK (auth.uid() = officer_id OR public.is_admin() OR public.current_user_role() IN ('Loan Center Management'));
DROP POLICY IF EXISTS "offers_delete_admin" ON public.loan_offers;
CREATE POLICY "offers_delete_admin" ON public.loan_offers FOR DELETE TO authenticated USING (public.is_admin());

CREATE TABLE IF NOT EXISTS public.community_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_handle text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.community_rules ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_rules TO authenticated;

DROP POLICY IF EXISTS "rules_select_all" ON public.community_rules;
CREATE POLICY "rules_select_all" ON public.community_rules FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "rules_insert_admin" ON public.community_rules;
CREATE POLICY "rules_insert_admin" ON public.community_rules FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "rules_update_admin" ON public.community_rules;
CREATE POLICY "rules_update_admin" ON public.community_rules FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "rules_delete_admin" ON public.community_rules;
CREATE POLICY "rules_delete_admin" ON public.community_rules FOR DELETE TO authenticated USING (public.is_admin());

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  handle text NOT NULL DEFAULT '',
  display_name text NOT NULL DEFAULT '',
  avatar_url text,
  avatar_initials text NOT NULL DEFAULT '',
  accent text NOT NULL DEFAULT '#d4a017',
  role text NOT NULL DEFAULT 'Normal Member',
  secondary_role text,
  body text NOT NULL,
  reply_to uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  reply_preview text,
  mentions text[] DEFAULT '{}',
  deleted boolean NOT NULL DEFAULT false,
  deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;

DROP POLICY IF EXISTS "chat_select_all" ON public.chat_messages;
CREATE POLICY "chat_select_all" ON public.chat_messages FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "chat_insert_own" ON public.chat_messages;
CREATE POLICY "chat_insert_own" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "chat_update_own" ON public.chat_messages;
CREATE POLICY "chat_update_own" ON public.chat_messages FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "chat_delete_own" ON public.chat_messages;
CREATE POLICY "chat_delete_own" ON public.chat_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "chat_delete_admin" ON public.chat_messages;
CREATE POLICY "chat_delete_admin" ON public.chat_messages FOR DELETE TO authenticated USING (public.is_admin());

CREATE TABLE IF NOT EXISTS public.member_presence (
  user_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'offline',
  last_seen timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.member_presence ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.member_presence TO authenticated;

DROP POLICY IF EXISTS "presence_select_all" ON public.member_presence;
CREATE POLICY "presence_select_all" ON public.member_presence FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "presence_upsert_own" ON public.member_presence;
CREATE POLICY "presence_upsert_own" ON public.member_presence FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "presence_update_own" ON public.member_presence;
CREATE POLICY "presence_update_own" ON public.member_presence FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.live_shows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  host_handle text NOT NULL DEFAULT '',
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  is_live boolean NOT NULL DEFAULT false,
  audience_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.live_shows ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_shows TO authenticated;

DROP POLICY IF EXISTS "shows_select_all" ON public.live_shows;
CREATE POLICY "shows_select_all" ON public.live_shows FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "shows_insert_own" ON public.live_shows;
CREATE POLICY "shows_insert_own" ON public.live_shows FOR INSERT TO authenticated WITH CHECK (auth.uid() = host_id OR public.is_admin());
DROP POLICY IF EXISTS "shows_update_own_admin" ON public.live_shows;
CREATE POLICY "shows_update_own_admin" ON public.live_shows FOR UPDATE TO authenticated
  USING (auth.uid() = host_id OR public.is_admin()) WITH CHECK (auth.uid() = host_id OR public.is_admin());
DROP POLICY IF EXISTS "shows_delete_own_admin" ON public.live_shows;
CREATE POLICY "shows_delete_own_admin" ON public.live_shows FOR DELETE TO authenticated USING (auth.uid() = host_id OR public.is_admin());

CREATE TABLE IF NOT EXISTS public.live_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id uuid NOT NULL REFERENCES public.live_shows(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  handle text NOT NULL DEFAULT '',
  display_name text NOT NULL DEFAULT '',
  avatar_url text,
  avatar_initials text NOT NULL DEFAULT '',
  accent text NOT NULL DEFAULT '#d4a017',
  role text NOT NULL DEFAULT 'Normal Member',
  body text NOT NULL,
  deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.live_chat_messages ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.live_chat_messages TO authenticated;

DROP POLICY IF EXISTS "livechat_select_all" ON public.live_chat_messages;
CREATE POLICY "livechat_select_all" ON public.live_chat_messages FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "livechat_insert_own" ON public.live_chat_messages;
CREATE POLICY "livechat_insert_own" ON public.live_chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "livechat_delete_own_admin" ON public.live_chat_messages;
CREATE POLICY "livechat_delete_own_admin" ON public.live_chat_messages FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.is_admin());

CREATE TABLE IF NOT EXISTS public.bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  banned_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  ban_type text NOT NULL DEFAULT 'permanent',
  reason text NOT NULL DEFAULT '',
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  lifted_at timestamptz,
  lifted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);
ALTER TABLE public.bans ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.bans TO authenticated;

DROP POLICY IF EXISTS "bans_select_all" ON public.bans;
CREATE POLICY "bans_select_all" ON public.bans FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "bans_insert_admin" ON public.bans;
CREATE POLICY "bans_insert_admin" ON public.bans FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_moderator_or_above());
DROP POLICY IF EXISTS "bans_update_admin" ON public.bans;
CREATE POLICY "bans_update_admin" ON public.bans FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_moderator_or_above()) WITH CHECK (public.is_admin() OR public.is_moderator_or_above());

CREATE TABLE IF NOT EXISTS public.chat_timeouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  timed_out_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason text NOT NULL DEFAULT '',
  expires_at timestamptz NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  lifted_at timestamptz,
  lifted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);
ALTER TABLE public.chat_timeouts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.chat_timeouts TO authenticated;

DROP POLICY IF EXISTS "timeouts_select_all" ON public.chat_timeouts;
CREATE POLICY "timeouts_select_all" ON public.chat_timeouts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "timeouts_insert_admin" ON public.chat_timeouts;
CREATE POLICY "timeouts_insert_admin" ON public.chat_timeouts FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_moderator_or_above());
DROP POLICY IF EXISTS "timeouts_update_admin" ON public.chat_timeouts;
CREATE POLICY "timeouts_update_admin" ON public.chat_timeouts FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_moderator_or_above()) WITH CHECK (public.is_admin() OR public.is_moderator_or_above());

CREATE TABLE IF NOT EXISTS public.moderation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  target_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_handle text NOT NULL DEFAULT '',
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_handle text NOT NULL DEFAULT '',
  reason text NOT NULL DEFAULT '',
  duration text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.moderation_logs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.moderation_logs TO authenticated;

DROP POLICY IF EXISTS "modlogs_select_admin" ON public.moderation_logs;
CREATE POLICY "modlogs_select_admin" ON public.moderation_logs FOR SELECT TO authenticated USING (public.is_admin() OR public.is_moderator_or_above());
DROP POLICY IF EXISTS "modlogs_insert_admin" ON public.moderation_logs;
CREATE POLICY "modlogs_insert_admin" ON public.moderation_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_moderator_or_above());

CREATE INDEX IF NOT EXISTS idx_member_reports_status ON public.member_reports(status);
CREATE INDEX IF NOT EXISTS idx_member_reports_reported_id ON public.member_reports(reported_id);
CREATE INDEX IF NOT EXISTS idx_admin_complaints_status ON public.admin_complaints(status);
CREATE INDEX IF NOT EXISTS idx_loan_offers_status ON public.loan_offers(status);
CREATE INDEX IF NOT EXISTS idx_loan_offers_member_id ON public.loan_offers(member_id);
