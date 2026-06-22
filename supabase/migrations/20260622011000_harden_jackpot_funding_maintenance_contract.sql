-- Move post-deploy jackpot funding maintenance fixes into a fresh migration so
-- already-applied historical migrations do not need to be edited.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $$
BEGIN
  IF to_regprocedure('public.finalize_daily_jackpot_if_due(date)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.finalize_daily_jackpot_if_due(DATE) FROM PUBLIC, anon, authenticated';
  END IF;
END
$$;

DROP FUNCTION IF EXISTS public.finalize_daily_jackpot_if_due(DATE);

DELETE FROM public.daily_jackpot_funding_entries
 WHERE source_type = 'ticket_fee';

ALTER TABLE public.daily_jackpot_funding_entries
  DROP CONSTRAINT IF EXISTS daily_jackpot_funding_entries_source_type_check;

ALTER TABLE public.daily_jackpot_funding_entries
  ADD CONSTRAINT daily_jackpot_funding_entries_source_type_check
  CHECK (source_type IN ('lost_coupon', 'rollover'));

CREATE OR REPLACE FUNCTION public.resolve_coupon_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total BIGINT;
  v_resolved BIGINT;
  v_lost BIGINT;
  v_refund BIGINT;
  v_stake NUMERIC;
  v_odds NUMERIC;
BEGIN
  IF NEW.coupon_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*),
         count(*) FILTER (WHERE result IN ('won', 'lost', 'refund')),
         count(*) FILTER (WHERE result = 'lost'),
         count(*) FILTER (WHERE result = 'refund')
    INTO v_total, v_resolved, v_lost, v_refund
    FROM public.placed_bets
   WHERE coupon_id = NEW.coupon_id;

  IF v_lost > 0 THEN
    UPDATE public.coupons
       SET status = 'lost',
           payout = 0,
           settled_at = CASE
             WHEN status IS DISTINCT FROM 'lost' THEN NOW()
             ELSE settled_at
           END
     WHERE id = NEW.coupon_id;
    RETURN NEW;
  END IF;

  IF v_resolved = v_total THEN
    SELECT stake, total_odds
      INTO v_stake, v_odds
      FROM public.coupons
     WHERE id = NEW.coupon_id;

    IF v_refund = v_total THEN
      UPDATE public.coupons
         SET status = 'refund',
             payout = ROUND(v_stake, 2),
             settled_at = CASE
               WHEN status IS DISTINCT FROM 'refund' THEN NOW()
               ELSE settled_at
             END
       WHERE id = NEW.coupon_id;
    ELSE
      UPDATE public.coupons
         SET status = 'won',
             payout = ROUND(v_stake * v_odds, 2),
             settled_at = CASE
               WHEN status IS DISTINCT FROM 'won' THEN NOW()
               ELSE settled_at
             END
       WHERE id = NEW.coupon_id;
    END IF;
  ELSE
    UPDATE public.coupons
       SET status = 'pending',
           payout = 0,
           settled_at = NULL
     WHERE id = NEW.coupon_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE INDEX IF NOT EXISTS daily_jackpot_coupons_lost_settled_idx
  ON public.coupons(settled_at)
  WHERE status = 'lost'
    AND settled_at IS NOT NULL
    AND stake > 0;

CREATE INDEX IF NOT EXISTS daily_jackpot_coupons_lost_created_idx
  ON public.coupons(created_at)
  WHERE status = 'lost'
    AND settled_at IS NULL
    AND stake > 0;

CREATE OR REPLACE FUNCTION private.sync_daily_jackpot_funding(p_pool_date DATE)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_pool public.daily_jackpot_pools%ROWTYPE;
  v_pool_id UUID;
  v_source_day DATE := p_pool_date - 1;
  v_source_start TIMESTAMPTZ;
  v_source_end TIMESTAMPTZ;
BEGIN
  v_pool_id := private.ensure_daily_jackpot_pool(p_pool_date);
  v_source_start := (v_source_day::TEXT || ' 00:00:00 Europe/Warsaw')::TIMESTAMPTZ;
  v_source_end := ((v_source_day + 1)::TEXT || ' 00:00:00 Europe/Warsaw')::TIMESTAMPTZ;

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
          AND ROUND(c.stake, 2) = ROUND(f.amount, 2)
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
    ROUND(c.stake, 2),
    v_source_day
  FROM public.coupons c
  WHERE c.status = 'lost'
    AND c.stake > 0
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

REVOKE ALL ON FUNCTION private.ensure_daily_jackpot_pool(DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.get_daily_jackpot_snapshot(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.get_empty_daily_jackpot_snapshot(DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.sync_daily_jackpot_funding(DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.finalize_daily_jackpot_pool(DATE, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.credit_daily_jackpot_reward(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.auto_credit_unclaimed_daily_jackpot_rewards(DATE) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.finalize_daily_jackpot_if_due()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.maintain_daily_jackpot()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.finalize_daily_jackpot_if_due() TO service_role;
GRANT EXECUTE ON FUNCTION public.maintain_daily_jackpot() TO service_role;

DO $$
BEGIN
  IF to_regnamespace('cron') IS NOT NULL THEN
    PERFORM cron.unschedule(jobid)
      FROM cron.job
     WHERE jobname = 'bsplic-daily-jackpot-maintenance';

    PERFORM cron.schedule(
      'bsplic-daily-jackpot-maintenance',
      '*/5 * * * *',
      $job$SELECT public.maintain_daily_jackpot();$job$
    );
  END IF;
END
$$;
