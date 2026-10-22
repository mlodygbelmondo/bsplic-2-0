-- Let the NANO instance go quiet when nobody is playing.
--
-- The project ran out of its Disk IO budget on 2026-10-22: every pg_cron job
-- failed with "job startup timeout" for five hours. The instance has 431 MB of
-- RAM and swaps constantly, so each extra process start costs disk reads.
-- Postgres also closes and archives a 16 MB WAL segment within two minutes of
-- any write (archive_timeout = 120 s). pg_cron logs every run to
-- cron.job_run_details, so the every-minute roulette job alone kept the
-- archiver uploading a segment every two minutes, day and night.
--
-- 1. The backup crons run on the same ten-minute marks, so an idle database
--    wakes at most six times an hour. Clients still advance roulette rounds
--    and finalize the jackpot while anyone is watching; the crons only cover
--    tables nobody is watching. The jackpot draw is on the hour, so the draw
--    minute is still covered.
-- 2. cron.job_run_details kept every run since June (half the database);
--    keep three days.
-- 3. Jackpot polls (every 45 s per open app) no longer lock and rewrite the
--    pool when its funding is unchanged. A row lock alone writes WAL.

DO $$
BEGIN
  IF to_regnamespace('cron') IS NOT NULL THEN
    PERFORM cron.alter_job(j.jobid, schedule := s.schedule)
       FROM cron.job AS j
       JOIN (
         VALUES
           ('bsplic-roulette-advance-main', '*/10 * * * *'),
           ('bsplic-daily-jackpot-maintenance', '*/10 * * * *'),
           ('bsplic-auto-bets-settle', '10,40 * * * *'),
           ('bsplic-social-realtime-events-retention', '10 3 * * *')
       ) AS s(jobname, schedule) ON s.jobname = j.jobname;

    PERFORM cron.unschedule(jobid)
       FROM cron.job
      WHERE jobname = 'bsplic-cron-run-details-retention';

    PERFORM cron.schedule(
      'bsplic-cron-run-details-retention',
      '10 3 * * *',
      $job$DELETE FROM cron.job_run_details WHERE end_time < NOW() - INTERVAL '3 days';$job$
    );

    DELETE FROM cron.job_run_details
     WHERE end_time < NOW() - INTERVAL '3 days';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION private.sync_daily_jackpot_funding(p_pool_date DATE)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_pool public.daily_jackpot_pools%ROWTYPE;
  v_pool_id UUID;
  v_season_started_at TIMESTAMPTZ := private.get_active_season_started_at();
  v_source_day DATE := p_pool_date - 1;
  v_source_start TIMESTAMPTZ;
  v_source_end TIMESTAMPTZ;
BEGIN
  v_pool_id := private.ensure_daily_jackpot_pool(p_pool_date);
  v_source_start := (v_source_day::TEXT || ' 00:00:00 Europe/Warsaw')::TIMESTAMPTZ;
  v_source_end := ((v_source_day + 1)::TEXT || ' 00:00:00 Europe/Warsaw')::TIMESTAMPTZ;

  -- Read-only check first, without the row lock: client polls reach this
  -- every 45 s, and nearly always there is nothing to change. The three
  -- conditions mirror the DELETE, INSERT and UPDATE below; keep them in step.
  SELECT *
    INTO v_pool
    FROM public.daily_jackpot_pools
   WHERE id = v_pool_id;

  IF v_pool.status <> 'collecting' THEN
    RETURN v_pool_id;
  END IF;

  IF NOT EXISTS (
       SELECT 1
         FROM public.daily_jackpot_funding_entries f
        WHERE f.pool_id = v_pool.id
          AND f.source_type = 'lost_coupon'
          AND f.source_day = v_source_day
          AND NOT EXISTS (
            SELECT 1
              FROM public.coupons c
             WHERE c.id = f.coupon_id
               AND c.status = 'lost'
               AND c.stake > 0
               AND COALESCE(c.settled_at, c.created_at) >= v_season_started_at
               AND ROUND(c.stake * 0.20, 2) = ROUND(f.amount, 2)
               AND (
                 (
                   c.settled_at IS NOT NULL
                   AND c.settled_at >= v_source_start
                   AND c.settled_at < v_source_end
                 )
                 OR (
                   c.settled_at IS NULL
                   AND c.created_at >= v_source_start
                   AND c.created_at < v_source_end
                 )
               )
          )
     )
     AND NOT EXISTS (
       SELECT 1
         FROM public.coupons c
        WHERE c.status = 'lost'
          AND c.stake > 0
          AND COALESCE(c.settled_at, c.created_at) >= v_season_started_at
          AND (
            (
              c.settled_at IS NOT NULL
              AND c.settled_at >= v_source_start
              AND c.settled_at < v_source_end
            )
            OR (
              c.settled_at IS NULL
              AND c.created_at >= v_source_start
              AND c.created_at < v_source_end
            )
          )
          -- Lost-coupon entries are unique per coupon, across all pools.
          AND NOT EXISTS (
            SELECT 1
              FROM public.daily_jackpot_funding_entries f
             WHERE f.source_type = 'lost_coupon'
               AND f.coupon_id = c.id
          )
     )
     AND v_pool.prize_amount IS NOT DISTINCT FROM ROUND(COALESCE((
       SELECT SUM(f.amount)
         FROM public.daily_jackpot_funding_entries f
        WHERE f.pool_id = v_pool.id
     ), 0), 2)
  THEN
    RETURN v_pool_id;
  END IF;

  SELECT *
    INTO v_pool
    FROM public.daily_jackpot_pools
   WHERE id = v_pool_id
   FOR UPDATE;

  IF v_pool.status <> 'collecting' THEN
    RETURN v_pool_id;
  END IF;

  DELETE FROM public.daily_jackpot_funding_entries f
   WHERE f.pool_id = v_pool.id
     AND f.source_type = 'lost_coupon'
     AND f.source_day = v_source_day
     AND NOT EXISTS (
       SELECT 1
         FROM public.coupons c
        WHERE c.id = f.coupon_id
          AND c.status = 'lost'
          AND c.stake > 0
          AND COALESCE(c.settled_at, c.created_at) >= v_season_started_at
          AND ROUND(c.stake * 0.20, 2) = ROUND(f.amount, 2)
          AND (
            (
              c.settled_at IS NOT NULL
              AND c.settled_at >= v_source_start
              AND c.settled_at < v_source_end
            )
            OR (
              c.settled_at IS NULL
              AND c.created_at >= v_source_start
              AND c.created_at < v_source_end
            )
          )
     );

  INSERT INTO public.daily_jackpot_funding_entries (
    pool_id,
    source_type,
    coupon_id,
    amount,
    source_day
  )
  SELECT
    v_pool.id,
    'lost_coupon',
    c.id,
    ROUND(c.stake * 0.20, 2),
    v_source_day
  FROM public.coupons c
  WHERE c.status = 'lost'
    AND c.stake > 0
    AND COALESCE(c.settled_at, c.created_at) >= v_season_started_at
    AND (
      (
        c.settled_at IS NOT NULL
        AND c.settled_at >= v_source_start
        AND c.settled_at < v_source_end
      )
      OR (
        c.settled_at IS NULL
        AND c.created_at >= v_source_start
        AND c.created_at < v_source_end
      )
    )
  ON CONFLICT DO NOTHING;

  UPDATE public.daily_jackpot_pools p
     SET prize_amount = ROUND(COALESCE((
           SELECT SUM(amount)
             FROM public.daily_jackpot_funding_entries f
            WHERE f.pool_id = p.id
         ), 0), 2),
         updated_at = NOW()
   WHERE p.id = v_pool.id;

  RETURN v_pool_id;
END;
$$;

REVOKE ALL ON FUNCTION private.sync_daily_jackpot_funding(DATE)
  FROM PUBLIC, anon, authenticated;
