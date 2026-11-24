/*
# Admin Role Management RPCs + Storage Bucket + Helper Functions

## Functions
- set_user_role(target_user, new_role) — admin-only role update in auth.users
- get_user_role(target_user) — read any user's role
- is_server_owner() — check if caller is Server Owner
- is_moderator_or_above() — check if caller is Moderator+

## Storage
- attachments bucket: public read, authenticated write
*/

CREATE OR REPLACE FUNCTION public.set_user_role(target_user uuid, new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied: only admins can assign roles';
  END IF;
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', new_role)
  WHERE id = target_user;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_user_role(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, text) TO authenticated;

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

CREATE OR REPLACE FUNCTION public.is_server_owner()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'Server Owner', false);
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

INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "attachments_bucket_read" ON storage.objects;
CREATE POLICY "attachments_bucket_read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'attachments');

DROP POLICY IF EXISTS "attachments_bucket_insert" ON storage.objects;
CREATE POLICY "attachments_bucket_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'attachments');

DROP POLICY IF EXISTS "attachments_bucket_delete" ON storage.objects;
CREATE POLICY "attachments_bucket_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'attachments' AND owner = auth.uid());

DROP POLICY IF EXISTS "attachments_bucket_update" ON storage.objects;
CREATE POLICY "attachments_bucket_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'attachments' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'attachments' AND owner = auth.uid());
