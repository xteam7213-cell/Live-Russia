/*
# Core Schema: Profiles, Departments, Staff Assignments, Audit Logs

## Overview
Creates the foundational tables for the LIVE RUSSIA GAMING community portal.
This migration establishes user profiles linked to Supabase Auth, the department
structure, staff role assignments, and the audit log system.

## New Tables

1. **profiles** — Public user profile for each authenticated member.
   - id (uuid, PK, matches auth.users.id)
   - handle (text, unique) — community username
   - display_name (text)
   - avatar_initials (text) — 2-letter abbreviation
   - accent (text) — hex color for avatar
   - country (text)
   - bio (text)
   - game (text) — primary game
   - verified (boolean, default false) — community verification status
   - discord_connected (boolean, default false)
   - discord_username (text, nullable)
   - discord_status (text, default 'offline') — online/idle/dnd/offline
   - reputation (integer, default 0)
   - created_at (timestamptz)

2. **departments** — Staff department definitions.
   - id (uuid, PK)
   - name (text, unique) — e.g. "Moderation", "Support Team"
   - description (text)
   - icon (text) — lucide icon name
   - display_order (integer, default 0)
   - created_at (timestamptz)

3. **staff_assignments** — Links users to departments with a role title.
   - id (uuid, PK)
   - user_id (uuid, FK to profiles.id)
   - department_id (uuid, FK to departments.id)
   - role_title (text) — e.g. "Loan Officer", "Moderation Officer"
   - created_at (timestamptz)

4. **audit_logs** — Immutable record of admin/staff actions.
   - id (uuid, PK)
   - actor_id (uuid, nullable) — the user who performed the action
   - action (text)
   - target (text)
   - severity (text, default 'info') — info/warning/critical
   - created_at (timestamptz)

## Security
- RLS enabled on all tables.
- profiles: each user reads all profiles (community directory), updates only their own.
- departments: read-only for all authenticated users (public directory data).
- staff_assignments: read for all authenticated; insert/update/delete by admin-level roles only
  (enforced via a helper function checking raw_app_meta_data.role).
- audit_logs: insert for any authenticated user (system logs actions); read by admin-level only.
- A SECURITY DEFINER function `is_admin()` checks the user's role from raw_app_meta_data.

## Notes
- Role is stored in auth.users raw_app_meta_data (set by an admin RPC, not client-writable).
- All owner columns default to auth.uid() where applicable.
*/

-- Helper function: check if current user has an admin-level role
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

-- Helper function: get current user's role string
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

-- =============================================================
-- PROFILES
-- =============================================================
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

GRANT SELECT, UPDATE ON public.profiles TO authenticated;

-- All authenticated users can see all profiles (community directory)
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Users can update only their own profile
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can update any profile (e.g. verify members)
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- =============================================================
-- DEPARTMENTS
-- =============================================================
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

-- All authenticated users can read departments
DROP POLICY IF EXISTS "departments_select_all" ON public.departments;
CREATE POLICY "departments_select_all"
  ON public.departments FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can create/update/delete departments
DROP POLICY IF EXISTS "departments_insert_admin" ON public.departments;
CREATE POLICY "departments_insert_admin"
  ON public.departments FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "departments_update_admin" ON public.departments;
CREATE POLICY "departments_update_admin"
  ON public.departments FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "departments_delete_admin" ON public.departments;
CREATE POLICY "departments_delete_admin"
  ON public.departments FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- =============================================================
-- STAFF_ASSIGNMENTS
-- =============================================================
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

-- All authenticated users can see staff assignments (Staff HQ directory)
DROP POLICY IF EXISTS "staff_select_all" ON public.staff_assignments;
CREATE POLICY "staff_select_all"
  ON public.staff_assignments FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can create/update/delete staff assignments
DROP POLICY IF EXISTS "staff_insert_admin" ON public.staff_assignments;
CREATE POLICY "staff_insert_admin"
  ON public.staff_assignments FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "staff_update_admin" ON public.staff_assignments;
CREATE POLICY "staff_update_admin"
  ON public.staff_assignments FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "staff_delete_admin" ON public.staff_assignments;
CREATE POLICY "staff_delete_admin"
  ON public.staff_assignments FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- =============================================================
-- AUDIT_LOGS
-- =============================================================
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

-- Any authenticated user can insert audit log entries (system logs actions)
DROP POLICY IF EXISTS "audit_insert_all" ON public.audit_logs;
CREATE POLICY "audit_insert_all"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Only admins can read audit logs
DROP POLICY IF EXISTS "audit_select_admin" ON public.audit_logs;
CREATE POLICY "audit_select_admin"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- =============================================================
-- SEED DEPARTMENTS
-- =============================================================
INSERT INTO public.departments (name, description, icon, display_order) VALUES
  ('Command', 'Server leadership and strategic direction.', 'Crown', 1),
  ('Junior Administrator', 'Junior administrative staff supporting senior leadership.', 'ShieldCheck', 2),
  ('Moderation', 'Community moderation and rule enforcement.', 'Shield', 3),
  ('Support Team', 'Member support and ticket resolution.', 'LifeBuoy', 4),
  ('Loan Center Management', 'Loan department management and approvals.', 'Landmark', 5),
  ('Verification', 'Member verification and identity review.', 'BadgeCheck', 6),
  ('Discord Operations', 'Discord server management and integration.', 'MessageSquare', 7),
  ('Events', 'Community events and tournaments.', 'CalendarDays', 8)
ON CONFLICT (name) DO NOTHING;