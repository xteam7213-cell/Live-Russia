/*
# Admin Role Management RPC + Storage Bucket

## Overview
1. Creates a SECURITY DEFINER function `set_user_role` that lets admins
   update another user's role in auth.users raw_app_meta_data. The client
   cannot write raw_app_meta_data directly — this function enforces that
   only admin-level users can assign roles.
2. Creates a SECURITY DEFINER function `get_user_role` to read a user's role.
3. Creates a storage bucket for community attachments.

## Functions
- **set_user_role(target_user_uuid, role_text)** — Updates raw_app_meta_data.role
  for the target user. Only callable by users whose own role is Server Owner or Administrator.
- **get_user_role(target_user_uuid)** — Returns the role string for a user.

## Storage
- **attachments** bucket — public read, authenticated write. Used for file uploads.
*/

-- =============================================================
-- set_user_role: admin-only role assignment
-- =============================================================
CREATE OR REPLACE FUNCTION public.set_user_role(target_user uuid, new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied: only admins can assign roles';
  END IF;

  -- Update the target user's app_metadata
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', new_role)
  WHERE id = target_user;
END;
$$;

-- Revoke default PUBLIC execute, grant only to authenticated
REVOKE EXECUTE ON FUNCTION public.set_user_role(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, text) TO authenticated;

-- =============================================================
-- get_user_role: read any user's role (for staff directory display)
-- =============================================================
CREATE OR REPLACE FUNCTION public.get_user_role(target_user uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT raw_app_meta_data ->> 'role' FROM auth.users WHERE id = target_user),
    'Normal Member'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;

-- =============================================================
-- STORAGE BUCKET: attachments
-- =============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Public read for attachments bucket
DROP POLICY IF EXISTS "attachments_bucket_read" ON storage.objects;
CREATE POLICY "attachments_bucket_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'attachments');

-- Authenticated users can upload to attachments bucket
DROP POLICY IF EXISTS "attachments_bucket_insert" ON storage.objects;
CREATE POLICY "attachments_bucket_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'attachments');

-- Users can delete their own uploads
DROP POLICY IF EXISTS "attachments_bucket_delete" ON storage.objects;
CREATE POLICY "attachments_bucket_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'attachments' AND owner = auth.uid());

-- Users can update their own uploads
DROP POLICY IF EXISTS "attachments_bucket_update" ON storage.objects;
CREATE POLICY "attachments_bucket_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'attachments' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'attachments' AND owner = auth.uid());