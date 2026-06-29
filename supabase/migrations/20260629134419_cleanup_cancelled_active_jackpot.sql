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

DO $$
DECLARE
  v_pool_id UUID;
  v_today DATE := (timezone('Europe/Warsaw', NOW()))::DATE;
BEGIN
  SELECT id
    INTO v_pool_id
    FROM public.daily_jackpot_pools
   WHERE pool_date = v_today
     AND status = 'cancelled'
     AND draw_scheduled_at > NOW()
   FOR UPDATE;

  IF v_pool_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.daily_jackpot_pools
     SET winner_user_id = NULL,
         winning_ticket_id = NULL,
         reward_credit_event_id = NULL
   WHERE id = v_pool_id;

  DELETE FROM public.daily_jackpot_draw_views
   WHERE pool_id = v_pool_id;

  DELETE FROM public.daily_jackpot_funding_entries
   WHERE pool_id = v_pool_id
      OR source_pool_id = v_pool_id;

  DELETE FROM public.daily_jackpot_tickets
   WHERE pool_id = v_pool_id;

  DELETE FROM public.daily_jackpot_events
   WHERE pool_id = v_pool_id;

  UPDATE public.daily_jackpot_pools
     SET status = 'collecting',
         prize_amount = 0,
         locked_at = NULL,
         drawn_at = NULL,
         winner_user_id = NULL,
         winning_ticket_id = NULL,
         rollover_from_pool_id = NULL,
         entropy_hash = NULL,
         result_viewed_at = NULL,
         reward_claimed_at = NULL,
         reward_auto_credited_at = NULL,
         reward_credit_status = 'not_applicable',
         reward_credit_event_id = NULL,
         updated_at = NOW()
   WHERE id = v_pool_id
     AND status = 'cancelled'
     AND draw_scheduled_at > NOW();
END
$$;

REVOKE ALL ON FUNCTION private.sync_daily_jackpot_funding(DATE)
FROM PUBLIC, anon, authenticated;
