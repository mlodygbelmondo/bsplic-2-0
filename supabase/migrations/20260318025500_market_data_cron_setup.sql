-- Configure database-side scheduling for market-data Edge Function refresh.

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.setup_market_data_refresh_cron(
  p_project_url TEXT,
  p_anon_key TEXT,
  p_schedule TEXT DEFAULT '*/15 * * * *'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_job_id BIGINT;
  v_url TEXT;
  v_headers_json TEXT;
  v_command TEXT;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can configure market refresh cron';
  END IF;

  IF p_project_url IS NULL OR btrim(p_project_url) = '' THEN
    RAISE EXCEPTION 'p_project_url is required';
  END IF;

  IF p_anon_key IS NULL OR btrim(p_anon_key) = '' THEN
    RAISE EXCEPTION 'p_anon_key is required';
  END IF;

  v_url := rtrim(p_project_url, '/') || '/functions/v1/market-data';
  v_headers_json := format('{"Content-Type":"application/json","Authorization":"Bearer %s"}', p_anon_key);

  v_command := format(
    $request$
    SELECT net.http_post(
      url := %L,
      headers := %L::jsonb,
      body := '{"action":"refresh"}'::jsonb
    ) AS request_id;
    $request$,
    v_url,
    v_headers_json
  );

  SELECT jobid
    INTO v_existing_job_id
    FROM cron.job
   WHERE jobname = 'market-data-refresh';

  IF v_existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_existing_job_id);
  END IF;

  PERFORM cron.schedule('market-data-refresh', p_schedule, v_command);
END;
$$;

CREATE OR REPLACE FUNCTION public.disable_market_data_refresh_cron()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_job_id BIGINT;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can disable market refresh cron';
  END IF;

  SELECT jobid
    INTO v_existing_job_id
    FROM cron.job
   WHERE jobname = 'market-data-refresh';

  IF v_existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_existing_job_id);
  END IF;
END;
$$;
