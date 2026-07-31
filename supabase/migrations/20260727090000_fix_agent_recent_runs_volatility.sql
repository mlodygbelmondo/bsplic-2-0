-- Fix volatility on the agent run read-back.
--
-- PostgREST executes STABLE/IMMUTABLE functions inside a read-only transaction.
-- `private.require_agent_scope` updates `last_used_at` on every call, so a
-- STABLE agent RPC fails with:
--   25006 cannot execute UPDATE in a read-only transaction
--
-- Every other token-gated agent RPC is VOLATILE for exactly this reason;
-- `agent_get_recent_runs` shipped STABLE by mistake.

CREATE OR REPLACE FUNCTION public.agent_get_recent_runs(
  p_token TEXT,
  p_limit INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_limit INTEGER;
BEGIN
  PERFORM private.require_agent_scope(p_token, 'manage:runs');

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 10), 1), 50);

  RETURN COALESCE(
    (
      SELECT jsonb_agg(to_jsonb(r) ORDER BY r.started_at DESC)
      FROM (
        SELECT *
        FROM public.agent_runs
        ORDER BY started_at DESC
        LIMIT v_limit
      ) r
    ),
    '[]'::JSONB
  );
END;
$$;

-- Restore the admin reader to its original volatility. It only reads, so STABLE
-- was safe, but the admin path was not in scope for a behaviour change.
CREATE OR REPLACE FUNCTION public.admin_get_bet_ako_exclusions(p_bet_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Brak uprawnień administratora';
  END IF;

  RETURN private.get_bet_ako_exclusions(p_bet_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_get_bet_ako_exclusions(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_bet_ako_exclusions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agent_get_recent_runs(TEXT, INTEGER)
TO anon, authenticated, service_role;
