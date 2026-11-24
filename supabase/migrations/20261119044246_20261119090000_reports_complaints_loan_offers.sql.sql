/*
# Member Reports, Admin Complaints, and Loan Offers

## Overview
Creates three new table groups for Phase 4 community features:
1. member_reports — Reports filed by staff against ordinary members (visible to Moderation + admins).
2. admin_complaints — Confidential complaints against staff, with a strict two-tier hierarchy:
   - Complaints against Junior Administrators are visible to Administrator + Server Owner ONLY.
   - Complaints against Administrators are visible to Server Owner ONLY.
   - The accused staff member can NEVER see complaints filed against them.
3. loan_offers — Loan offers issued by Loan Center staff, separate from the existing `loans` table (which holds loan requests from members).

## New Tables

### member_reports
- id (uuid PK)
- reporter_id (uuid, FK profiles) — the staff member filing the report
- reported_id (uuid, FK profiles) — the member being reported
- reason (text) — short reason category
- details (text) — full description
- status (text) — pending/under_review/resolved/dismissed
- resolution_notes (text) — filled when resolved
- resolver_id (uuid, FK profiles) — who resolved it
- created_at (timestamptz)
- updated_at (timestamptz)

### admin_complaints
- id (uuid PK)
- complainant_id (uuid, FK profiles) — the member filing the complaint
- accused_id (uuid, FK profiles) — the staff member being complained about
- accused_role (text) — the role of the accused at time of filing (Junior Administrator / Administrator)
- subject (text) — short subject
- details (text) — full description
- status (text) — pending/under_review/resolved/dismissed
- resolution_notes (text) — filled when resolved
- resolver_id (uuid, FK profiles) — who resolved it
- created_at (timestamptz)
- updated_at (timestamptz)

### loan_offers
- id (uuid PK)
- officer_id (uuid, FK profiles) — the Loan Center staff member creating the offer
- member_id (uuid, FK profiles) — the member receiving the offer
- amount (numeric) — offered amount
- interest_rate (numeric) — interest rate percentage
- term_days (integer) — repayment term in days
- purpose (text) — purpose of the offer
- status (text) — pending/accepted/rejected/withdrawn
- created_at (timestamptz)
- updated_at (timestamptz)

## Security — RLS Policies

### member_reports
- SELECT: Moderators, Junior Administrators, Administrators, Server Owner can see all reports. The reporter can always see their own filed reports.
- INSERT: Moderators, Junior Administrators, Administrators, Server Owner can file reports.
- UPDATE: Moderators, Administrators, Server Owner can update status/resolution.
- DELETE: Administrators, Server Owner only.

### admin_complaints — STRICT HIERARCHY
The key security requirement: the accused can NEVER see complaints against themselves.
- SELECT: 
  - The complainant can see their own filed complaints.
  - Complaints against Junior Administrators: visible to Administrator + Server Owner only.
  - Complaints against Administrators: visible to Server Owner ONLY.
  - The accused themselves can NEVER see the complaint.
- INSERT: Any authenticated member can file a complaint against a Junior Administrator or Administrator.
- UPDATE: 
  - Complaints against Junior Administrators: Administrator + Server Owner can update.
  - Complaints against Administrators: Server Owner ONLY can update.
- DELETE: Server Owner ONLY.

### loan_offers
- SELECT: The member who received the offer, the officer who created it, Loan Center Management, Administrators, Server Owner.
- INSERT: Loan Center Management, Loan Officer, Administrators, Server Owner.
- UPDATE: The officer who created it, Loan Center Management, Administrators, Server Owner.
- DELETE: Administrators, Server Owner.

## New Helper Functions
- is_server_owner() — returns true if caller's role is Server Owner.
- is_moderator_or_above() — returns true if caller's role is Moderator, Junior Administrator, Administrator, or Server Owner.

## Important Notes
1. The admin_complaints table enforces the hierarchy at the database level via RLS policies — the accused cannot bypass this even with direct API access.
2. The accused_role column is stored at filing time so the hierarchy is preserved even if the accused's role later changes.
3. loan_offers is completely separate from the existing loans table (which holds member-initiated loan requests).
*/

-- =============================================================
-- HELPER FUNCTIONS
-- =============================================================

CREATE OR REPLACE FUNCTION public.is_server_owner()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'Server Owner',
    false
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_server_owner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_server_owner() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_moderator_or_above()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('Moderator', 'Junior Administrator', 'Administrator', 'Server Owner'),
    false
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_moderator_or_above() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_moderator_or_above() TO authenticated;

-- =============================================================
-- MEMBER_REPORTS
-- =============================================================

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

-- SELECT: moderators+ can see all; reporter can see their own
DROP POLICY IF EXISTS "reports_select_staff_or_reporter" ON public.member_reports;
CREATE POLICY "reports_select_staff_or_reporter" ON public.member_reports FOR SELECT
  TO authenticated USING (
    auth.uid() = reporter_id
    OR public.is_moderator_or_above()
  );

-- INSERT: moderators+ can file reports
DROP POLICY IF EXISTS "reports_insert_staff" ON public.member_reports;
CREATE POLICY "reports_insert_staff" ON public.member_reports FOR INSERT
  TO authenticated WITH CHECK (
    public.is_moderator_or_above()
    AND auth.uid() = reporter_id
  );

-- UPDATE: moderators+ can update (resolve/dismiss)
DROP POLICY IF EXISTS "reports_update_staff" ON public.member_reports;
CREATE POLICY "reports_update_staff" ON public.member_reports FOR UPDATE
  TO authenticated USING (public.is_moderator_or_above())
  WITH CHECK (public.is_moderator_or_above());

-- DELETE: admins only
DROP POLICY IF EXISTS "reports_delete_admin" ON public.member_reports;
CREATE POLICY "reports_delete_admin" ON public.member_reports FOR DELETE
  TO authenticated USING (public.is_admin());

-- =============================================================
-- ADMIN_COMPLAINTS — STRICT CONFIDENTIALITY HIERARCHY
-- =============================================================

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

-- SELECT: Strict hierarchy — accused can NEVER see complaints against themselves
-- Complainant can see their own filed complaints.
-- Complaints against Junior Administrators: visible to Administrator + Server Owner.
-- Complaints against Administrators: visible to Server Owner ONLY.
DROP POLICY IF EXISTS "complaints_select_hierarchy" ON public.admin_complaints;
CREATE POLICY "complaints_select_hierarchy" ON public.admin_complaints FOR SELECT
  TO authenticated USING (
    -- Complainant can always see their own filed complaint
    (auth.uid() = complainant_id)
    -- Accused can NEVER see complaints against themselves — no clause for accused_id
    -- Complaints against Junior Administrators: Admin + Server Owner
    OR (
      accused_role = 'Junior Administrator'
      AND public.is_admin()
    )
    -- Complaints against Administrators: Server Owner ONLY
    OR (
      accused_role = 'Administrator'
      AND public.is_server_owner()
    )
  );

-- INSERT: Any authenticated user can file a complaint against a Junior Admin or Administrator
DROP POLICY IF EXISTS "complaints_insert_any" ON public.admin_complaints;
CREATE POLICY "complaints_insert_any" ON public.admin_complaints FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = complainant_id
    AND auth.uid() != accused_id
    AND accused_role IN ('Junior Administrator', 'Administrator')
  );

-- UPDATE: Same hierarchy as SELECT for the resolver
-- Complaints against Junior Administrators: Admin + Server Owner can update.
-- Complaints against Administrators: Server Owner ONLY can update.
DROP POLICY IF EXISTS "complaints_update_hierarchy" ON public.admin_complaints;
CREATE POLICY "complaints_update_hierarchy" ON public.admin_complaints FOR UPDATE
  TO authenticated
  USING (
    (accused_role = 'Junior Administrator' AND public.is_admin())
    OR (accused_role = 'Administrator' AND public.is_server_owner())
  )
  WITH CHECK (
    (accused_role = 'Junior Administrator' AND public.is_admin())
    OR (accused_role = 'Administrator' AND public.is_server_owner())
  );

-- DELETE: Server Owner ONLY
DROP POLICY IF EXISTS "complaints_delete_owner" ON public.admin_complaints;
CREATE POLICY "complaints_delete_owner" ON public.admin_complaints FOR DELETE
  TO authenticated USING (public.is_server_owner());

-- =============================================================
-- LOAN_OFFERS — separate from loan requests (loans table)
-- =============================================================

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

-- SELECT: member who received the offer, officer who created it, loan staff, admins
DROP POLICY IF EXISTS "offers_select_stakeholder" ON public.loan_offers;
CREATE POLICY "offers_select_stakeholder" ON public.loan_offers FOR SELECT
  TO authenticated USING (
    auth.uid() = member_id
    OR auth.uid() = officer_id
    OR public.is_admin()
    OR public.current_user_role() IN ('Loan Center Management', 'Loan Officer')
  );

-- INSERT: Loan Center staff + admins can create offers
DROP POLICY IF EXISTS "offers_insert_staff" ON public.loan_offers;
CREATE POLICY "offers_insert_staff" ON public.loan_offers FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = officer_id
    AND (
      public.is_admin()
      OR public.current_user_role() IN ('Loan Center Management', 'Loan Officer')
    )
  );

-- UPDATE: officer who created, loan management, admins
DROP POLICY IF EXISTS "offers_update_staff" ON public.loan_offers;
CREATE POLICY "offers_update_staff" ON public.loan_offers FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = officer_id
    OR public.is_admin()
    OR public.current_user_role() IN ('Loan Center Management')
  )
  WITH CHECK (
    auth.uid() = officer_id
    OR public.is_admin()
    OR public.current_user_role() IN ('Loan Center Management')
  );

-- DELETE: Admins only
DROP POLICY IF EXISTS "offers_delete_admin" ON public.loan_offers;
CREATE POLICY "offers_delete_admin" ON public.loan_offers FOR DELETE
  TO authenticated USING (public.is_admin());

-- =============================================================
-- INDEXES for performance
-- =============================================================
CREATE INDEX IF NOT EXISTS idx_member_reports_status ON public.member_reports(status);
CREATE INDEX IF NOT EXISTS idx_member_reports_reported_id ON public.member_reports(reported_id);
CREATE INDEX IF NOT EXISTS idx_admin_complaints_status ON public.admin_complaints(status);
CREATE INDEX IF NOT EXISTS idx_admin_complaints_accused_role ON public.admin_complaints(accused_role);
CREATE INDEX IF NOT EXISTS idx_loan_offers_status ON public.loan_offers(status);
CREATE INDEX IF NOT EXISTS idx_loan_offers_member_id ON public.loan_offers(member_id);
