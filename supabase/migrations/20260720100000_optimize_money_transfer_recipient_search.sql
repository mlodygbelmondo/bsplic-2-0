CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- Preserve substring search while avoiding a sequential scan of all profiles.
CREATE INDEX IF NOT EXISTS idx_profiles_username_lower_trgm
  ON public.profiles USING gin (LOWER(username) extensions.gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.search_money_transfer_recipients(
  p_query TEXT,
  p_limit INTEGER DEFAULT 8
)
RETURNS TABLE (
  id UUID,
  username TEXT,
  avatar_url TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_query TEXT := BTRIM(COALESCE(p_query, ''));
  v_pattern TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Musisz być zalogowany';
  END IF;

  IF CHAR_LENGTH(v_query) < 2 THEN
    RETURN;
  END IF;

  v_pattern := REPLACE(
    REPLACE(REPLACE(LOWER(v_query), '\', '\\'), '%', '\%'),
    '_',
    '\_'
  );

  IF private.is_agent_profile(v_user_id)
    OR EXISTS (
      SELECT 1
      FROM private.transfer_restricted_accounts restricted
      WHERE restricted.user_id = v_user_id
    )
  THEN
    RAISE EXCEPTION 'Transfery są niedostępne dla tego konta';
  END IF;

  RETURN QUERY
  SELECT profile.id, profile.username, profile.avatar_url
  FROM public.profiles profile
  WHERE profile.id <> v_user_id
    AND LOWER(profile.username) LIKE '%' || v_pattern || '%' ESCAPE '\'
    AND NOT private.is_agent_profile(profile.id)
    AND NOT EXISTS (
      SELECT 1
      FROM private.transfer_restricted_accounts restricted
      WHERE restricted.user_id = profile.id
    )
  ORDER BY
    CASE WHEN LOWER(profile.username) = LOWER(v_query) THEN 0 ELSE 1 END,
    CASE WHEN LOWER(profile.username) LIKE v_pattern || '%' ESCAPE '\' THEN 0 ELSE 1 END,
    profile.username
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 8), 1), 8);
END;
$$;

REVOKE ALL ON FUNCTION public.search_money_transfer_recipients(TEXT, INTEGER)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_money_transfer_recipients(TEXT, INTEGER)
  TO authenticated;
