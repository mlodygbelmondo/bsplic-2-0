-- Agent-created markets must close at the verified event start. This protects
-- direct RPC callers as well as the MCP edge function.

CREATE OR REPLACE FUNCTION private.enforce_agent_event_start()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, private
AS $$
DECLARE
  v_event_starts_at_text TEXT;
  v_event_starts_at TIMESTAMPTZ;
  v_schedule_source JSONB;
  v_schedule_observed_at TIMESTAMPTZ;
BEGIN
  IF NEW.agent_duplicate_key IS NULL THEN
    RETURN NEW;
  END IF;

  v_event_starts_at_text := NULLIF(
    BTRIM(COALESCE(NEW.agent_metadata ->> 'event_starts_at', '')),
    ''
  );
  IF v_event_starts_at_text IS NULL THEN
    RAISE EXCEPTION 'Agent market requires agent_metadata.event_starts_at';
  END IF;

  BEGIN
    v_event_starts_at := v_event_starts_at_text::TIMESTAMPTZ;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Agent event_starts_at must be a valid timestamp';
  END;
  IF NOT isfinite(v_event_starts_at) THEN
    RAISE EXCEPTION 'Agent event_starts_at must be a finite timestamp';
  END IF;

  IF NEW.ends_at IS DISTINCT FROM v_event_starts_at THEN
    RAISE EXCEPTION 'Agent ends_at must exactly equal event_starts_at';
  END IF;

  IF v_event_starts_at < NOW() + INTERVAL '2 hours' THEN
    RAISE EXCEPTION 'Agent event start must leave at least two hours to bet';
  END IF;

  v_schedule_source := NEW.agent_metadata -> 'schedule_source';
  IF jsonb_typeof(v_schedule_source) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Agent market requires agent_metadata.schedule_source';
  END IF;

  IF NULLIF(BTRIM(COALESCE(v_schedule_source ->> 'provider', '')), '') IS NULL
     OR NULLIF(BTRIM(COALESCE(v_schedule_source ->> 'displayed_start', '')), '') IS NULL
     OR NULLIF(BTRIM(COALESCE(v_schedule_source ->> 'timezone', '')), '') IS NULL
     OR COALESCE(v_schedule_source ->> 'url', '') !~* '^https://' THEN
    RAISE EXCEPTION 'Agent schedule_source is incomplete or does not use HTTPS';
  END IF;

  IF NULLIF(
    BTRIM(COALESCE(v_schedule_source ->> 'observed_at', '')),
    ''
  ) IS NULL THEN
    RAISE EXCEPTION 'Agent schedule_source.observed_at is required';
  END IF;

  BEGIN
    v_schedule_observed_at := (v_schedule_source ->> 'observed_at')::TIMESTAMPTZ;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Agent schedule_source.observed_at must be a valid timestamp';
  END;
  IF NOT isfinite(v_schedule_observed_at) THEN
    RAISE EXCEPTION 'Agent schedule_source.observed_at must be finite';
  END IF;

  IF v_schedule_observed_at > NOW() + INTERVAL '5 minutes'
     OR v_schedule_observed_at < NOW() - INTERVAL '24 hours' THEN
    RAISE EXCEPTION 'Agent schedule source must be observed in the last 24 hours';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_agent_event_start() FROM PUBLIC;

DROP TRIGGER IF EXISTS enforce_agent_event_start ON public.bets;
CREATE TRIGGER enforce_agent_event_start
BEFORE INSERT ON public.bets
FOR EACH ROW
EXECUTE FUNCTION private.enforce_agent_event_start();
