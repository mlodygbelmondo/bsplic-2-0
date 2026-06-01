-- Make agent token hashing work when pgcrypto is installed in Supabase's extensions schema.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION private.require_agent_scope(
  p_token TEXT,
  p_scope TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public, extensions
AS $$
DECLARE
  v_auth JSONB;
BEGIN
  SELECT jsonb_build_object(
           'token_id', id,
           'agent_user_id', agent_user_id
         )
    INTO v_auth
    FROM private.agent_api_tokens t
   WHERE token_hash = encode(digest(p_token, 'sha256'), 'hex')
     AND is_active = true
     AND p_scope = ANY(scopes)
   LIMIT 1;

  IF v_auth IS NULL THEN
    RAISE EXCEPTION 'Unauthorized agent token';
  END IF;

  UPDATE private.agent_api_tokens
     SET last_used_at = now()
   WHERE id = (v_auth->>'token_id')::UUID;

  RETURN v_auth;
END;
$$;

REVOKE ALL ON FUNCTION private.require_agent_scope(TEXT, TEXT) FROM PUBLIC;
