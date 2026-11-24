/*
# Add get_user_secondary_role RPC
Returns the secondary_role from raw_app_meta_data for a given user.
*/
CREATE OR REPLACE FUNCTION public.get_user_secondary_role(target_user uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT raw_app_meta_data ->> 'secondary_role' FROM auth.users WHERE id = target_user),
    NULL
  );
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_secondary_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_secondary_role(uuid) TO authenticated;
