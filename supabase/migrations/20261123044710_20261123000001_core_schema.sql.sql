/*
# Core Schema: Profiles, Departments, Staff Assignments, Audit Logs

Creates foundational tables for the LIVE RUSSIA GAMING community portal.
All tables use RLS. Role stored in auth.users raw_app_meta_data.

## New Tables
1. profiles — user profiles linked to auth.users
2. departments — staff department definitions
3. staff_assignments — links users to departments
4. audit_logs — admin action audit trail

## Security
- is_admin() SECURITY DEFINER checks raw_app_meta_data.role
- current_user_role() returns caller's role
- profiles: all authenticated read, owner+admin update, owner insert
- departments: all authenticated read, admin write
- staff_assignments: all authenticated read, admin write
- audit_logs: all authenticated insert, admin read
*/

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('Server Owner', 'Administrator'),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT coalesce(
    auth.jwt() -> 'app_metadata' ->> 'role',
    'Normal Member'
  );
$$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handle text UNIQUE NOT NULL,
  display_name text NOT NULL,
  avatar_initials text NOT NULL DEFAULT '',
  accent text NOT NULL DEFAULT '#d4a017',
  country text NOT NULL DEFAULT '',
  bio text NOT NULL DEFAULT '',
  game text NOT NULL DEFAULT '',
  verified boolean NOT NULL DEFAULT false,
  discord_connected boolean NOT NULL DEFAULT false,
  discord_username text,
  discord_status text NOT NULL DEFAULT 'offline',
  reputation integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT, UPDATE, INSERT ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all"
  ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT 'Users',
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;

DROP POLICY IF EXISTS "departments_select_all" ON public.departments;
CREATE POLICY "departments_select_all"
  ON public.departments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "departments_insert_admin" ON public.departments;
CREATE POLICY "departments_insert_admin"
  ON public.departments FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "departments_update_admin" ON public.departments;
CREATE POLICY "departments_update_admin"
  ON public.departments FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "departments_delete_admin" ON public.departments;
CREATE POLICY "departments_delete_admin"
  ON public.departments FOR DELETE TO authenticated USING (public.is_admin());

CREATE TABLE IF NOT EXISTS public.staff_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  role_title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, department_id)
);

ALTER TABLE public.staff_assignments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_assignments TO authenticated;

DROP POLICY IF EXISTS "staff_select_all" ON public.staff_assignments;
CREATE POLICY "staff_select_all"
  ON public.staff_assignments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "staff_insert_admin" ON public.staff_assignments;
CREATE POLICY "staff_insert_admin"
  ON public.staff_assignments FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "staff_update_admin" ON public.staff_assignments;
CREATE POLICY "staff_update_admin"
  ON public.staff_assignments FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "staff_delete_admin" ON public.staff_assignments;
CREATE POLICY "staff_delete_admin"
  ON public.staff_assignments FOR DELETE TO authenticated USING (public.is_admin());

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  target text NOT NULL DEFAULT '',
  severity text NOT NULL DEFAULT 'info',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;

DROP POLICY IF EXISTS "audit_insert_all" ON public.audit_logs;
CREATE POLICY "audit_insert_all"
  ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "audit_select_admin" ON public.audit_logs;
CREATE POLICY "audit_select_admin"
  ON public.audit_logs FOR SELECT TO authenticated USING (public.is_admin());

INSERT INTO public.departments (name, description, icon, display_order) VALUES
  ('Support Team', 'Member support and ticket resolution.', 'LifeBuoy', 1),
  ('Junior Administrator', 'Junior administrative staff supporting senior leadership.', 'ShieldCheck', 2),
  ('Moderator', 'Community moderation and rule enforcement.', 'Shield', 3),
  ('Loan Center Management', 'Loan department management and approvals. Loan Officer operates under this department.', 'Landmark', 4),
  ('Events', 'Community events and tournaments.', 'CalendarDays', 5)
ON CONFLICT (name) DO NOTHING;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
