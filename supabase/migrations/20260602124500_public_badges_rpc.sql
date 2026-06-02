-- Route public badge reads through the same profile visibility gate as public profile data.

CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.get_public_badges_for_rpc(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(
           json_build_object(
             'id', b.id,
             'user_id', b.user_id,
             'badge_key', b.badge_key,
             'unlocked_at', b.unlocked_at
           )
           ORDER BY b.unlocked_at DESC
         )
    INTO v_result
  FROM public.badges b
  WHERE b.user_id = p_user_id;

  RETURN COALESCE(v_result, '[]'::JSON);
END;
$$;

REVOKE ALL ON FUNCTION private.get_public_badges_for_rpc(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.get_public_badges_for_rpc(UUID) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_public_badges(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, private
AS $$
BEGIN
  IF NOT public.check_profile_access(p_user_id) THEN
    RETURN '[]'::JSON;
  END IF;

  RETURN private.get_public_badges_for_rpc(p_user_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_badges(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_badges(UUID) TO anon, authenticated;

DROP POLICY IF EXISTS "Badges viewable by everyone" ON public.badges;
DROP POLICY IF EXISTS "Public badges are readable" ON public.badges;

REVOKE SELECT ON TABLE public.badges FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.badges FROM anon, authenticated;
