/*
# Fix Missing Profile INSERT Policy + Create Profile for hamdanh1978

## Overview
1. The profiles table was missing an INSERT RLS policy — new users could authenticate but their
   profile row insert was silently blocked by RLS. This caused the "Invalid login credentials"
   symptom (actually a missing-profile state) and the call_rooms FK error (created_by references
   profiles.id, but no profile row existed).
2. Creates the missing profile for hamdanh1978@gmail.com.
3. Role assignment done separately via direct auth.users update.

## Changes
- Add INSERT policy on profiles: users can insert their own profile row (auth.uid() = id).
- Create profile for user 56f0c6b5-b2e9-47eb-a334-5127fad8f82b.
*/

-- =============================================================
-- FIX: Add INSERT policy on profiles (was missing — root cause of signup failures)
-- =============================================================
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

-- =============================================================
-- Create missing profile for hamdanh1978@gmail.com
-- =============================================================
INSERT INTO public.profiles (id, handle, display_name, avatar_initials, accent, bio, game, verified, discord_connected, discord_status, reputation)
SELECT
  '56f0c6b5-b2e9-47eb-a334-5127fad8f82b',
  'HamdanHanif',
  'Hamdan Hanif',
  'HH',
  '#d4a017',
  'Project Team & Administrator',
  '',
  false,
  false,
  'offline',
  0
WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = '56f0c6b5-b2e9-47eb-a334-5127fad8f82b');
