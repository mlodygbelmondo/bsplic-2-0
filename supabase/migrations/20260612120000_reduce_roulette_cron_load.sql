-- Reduce DB load on the NANO instance.
--
-- 1. The roulette advance cron ran every 5 seconds. Since
--    20260611150000 clients nudge overdue rounds themselves, so the cron is
--    only a backup for tables nobody is watching — once per minute is enough.
--    At 5s intervals the job was eating pooler connections and piling up
--    "job startup timeout" entries whenever the DB was busy.
-- 2. Give the advance function a lock_timeout so it bails out quickly instead
--    of queueing behind a long-running transaction and holding a connection.

ALTER FUNCTION public.advance_roulette_round_if_due(TEXT)
  SET lock_timeout = '3s';

DO $$
BEGIN
  IF to_regnamespace('cron') IS NOT NULL THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'bsplic-roulette-advance-main';

    PERFORM cron.schedule(
      'bsplic-roulette-advance-main',
      '* * * * *',
      $job$SELECT public.advance_roulette_round_if_due('main');$job$
    );
  END IF;
END
$$;
