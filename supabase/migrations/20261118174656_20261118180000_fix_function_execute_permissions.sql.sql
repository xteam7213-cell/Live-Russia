/*
# Fix SECURITY DEFINER Function Execute Permissions

## Overview
The security advisor flagged that `is_admin()`, `current_user_role()`, `get_user_role()`, and `set_user_role()`
are SECURITY DEFINER functions callable by the `anon` role (and in some cases all authenticated users).
These functions are used internally by RLS policies or are admin-only RPCs.

## Changes
- Revoke EXECUTE on `is_admin()` and `current_user_role()` from `anon` — these are used by RLS policies
  (which run with the caller's role) but should not be callable as direct RPCs by unauthenticated users.
- Revoke EXECUTE on `get_user_role()` from `anon` — admin/staff-only lookup.
- `set_user_role()` already had `REVOKE FROM PUBLIC, anon` in its original migration; confirmed here.
- All functions remain executable by `authenticated` (needed by RLS policies and authorized admin RPCs).
*/

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_user_role(uuid, text) FROM PUBLIC, anon;