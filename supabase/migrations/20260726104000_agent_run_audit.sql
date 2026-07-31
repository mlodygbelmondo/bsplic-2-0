-- Audit trail for autonomous agent runs.
--
-- Without this, a nightly cloud job that fails, half-completes or never fires
-- is undetectable without reading the runner's own logs.

CREATE TABLE IF NOT EXISTS public.agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL DEFAULT 'daily',
  status TEXT NOT NULL DEFAULT 'running',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  created_count INTEGER NOT NULL DEFAULT 0,
  settled_count INTEGER NOT NULL DEFAULT 0,
  held_count INTEGER NOT NULL DEFAULT 0,
  summary JSONB NOT NULL DEFAULT '{}'::JSONB,
  report TEXT,
  agent_user_id UUID REFERENCES auth.users(id),
  CONSTRAINT agent_runs_kind_check CHECK (kind IN ('daily', 'settle', 'create', 'manual')),
  CONSTRAINT agent_runs_status_check CHECK (status IN ('running', 'ok', 'partial', 'failed'))
);

CREATE INDEX IF NOT EXISTS agent_runs_started_at_idx
  ON public.agent_runs (started_at DESC);

CREATE INDEX IF NOT EXISTS agent_runs_status_idx
  ON public.agent_runs (status)
  WHERE status <> 'ok';

ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only admins can read agent runs" ON public.agent_runs;
CREATE POLICY "Only admins can read agent runs"
  ON public.agent_runs
  FOR SELECT
  TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'));

CREATE OR REPLACE FUNCTION public.agent_start_run(
  p_token TEXT,
  p_kind TEXT DEFAULT 'daily'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_auth JSONB;
  v_kind TEXT;
  v_run_id UUID;
BEGIN
  v_auth := private.require_agent_scope(p_token, 'manage:runs');

  v_kind := COALESCE(NULLIF(BTRIM(p_kind), ''), 'daily');
  IF v_kind NOT IN ('daily', 'settle', 'create', 'manual') THEN
    RAISE EXCEPTION 'Nieznany rodzaj runu: %', v_kind;
  END IF;

  INSERT INTO public.agent_runs (kind, agent_user_id)
  VALUES (v_kind, (v_auth ->> 'agent_user_id')::UUID)
  RETURNING id INTO v_run_id;

  RETURN jsonb_build_object('run_id', v_run_id, 'kind', v_kind);
END;
$$;

CREATE OR REPLACE FUNCTION public.agent_finish_run(
  p_token TEXT,
  p_run_id UUID,
  p_status TEXT DEFAULT 'ok',
  p_counts JSONB DEFAULT '{}'::JSONB,
  p_summary JSONB DEFAULT '{}'::JSONB,
  p_report TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_status TEXT;
  v_counts JSONB;
  v_summary JSONB;
  v_row public.agent_runs%ROWTYPE;
BEGIN
  PERFORM private.require_agent_scope(p_token, 'manage:runs');

  v_status := COALESCE(NULLIF(BTRIM(p_status), ''), 'ok');
  IF v_status NOT IN ('ok', 'partial', 'failed') THEN
    RAISE EXCEPTION 'Nieznany status runu: %', v_status;
  END IF;

  v_counts := COALESCE(p_counts, '{}'::JSONB);
  IF jsonb_typeof(v_counts) <> 'object' THEN
    v_counts := '{}'::JSONB;
  END IF;

  v_summary := COALESCE(p_summary, '{}'::JSONB);
  IF jsonb_typeof(v_summary) <> 'object' THEN
    v_summary := '{}'::JSONB;
  END IF;

  UPDATE public.agent_runs
     SET status = v_status,
         finished_at = NOW(),
         created_count = COALESCE((v_counts ->> 'created')::INTEGER, created_count),
         settled_count = COALESCE((v_counts ->> 'settled')::INTEGER, settled_count),
         held_count = COALESCE((v_counts ->> 'held')::INTEGER, held_count),
         summary = v_summary,
         report = COALESCE(p_report, report)
   WHERE id = p_run_id
   RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono runu agenta';
  END IF;

  RETURN to_jsonb(v_row);
END;
$$;

-- Read-back for the agent itself, so a run can see whether the previous one
-- finished and what it left behind.
CREATE OR REPLACE FUNCTION public.agent_get_recent_runs(
  p_token TEXT,
  p_limit INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
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

GRANT EXECUTE ON FUNCTION public.agent_start_run(TEXT, TEXT)
TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agent_finish_run(TEXT, UUID, TEXT, JSONB, JSONB, TEXT)
TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agent_get_recent_runs(TEXT, INTEGER)
TO anon, authenticated, service_role;

UPDATE private.agent_api_tokens
   SET scopes = (
     SELECT array_agg(DISTINCT scope_name ORDER BY scope_name)
       FROM unnest(scopes || ARRAY['manage:runs']::TEXT[]) AS scope_name
   )
 WHERE 'create:bets' = ANY(scopes)
   AND NOT 'manage:runs' = ANY(scopes);
