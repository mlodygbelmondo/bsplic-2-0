CREATE OR REPLACE FUNCTION public.execute_global_season_reset(
  p_reset_at TIMESTAMPTZ DEFAULT NOW(),
  p_confirm BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_summary JSONB;
  v_season_id UUID;
BEGIN
  IF p_reset_at IS NULL THEN
    RAISE EXCEPTION 'Reset timestamp is required';
  END IF;

  IF COALESCE(p_confirm, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'Global season reset requires explicit confirmation';
  END IF;

  IF NOT pg_try_advisory_xact_lock(hashtext('bsplic_global_season_reset')) THEN
    RAISE EXCEPTION 'Global season reset is already running';
  END IF;

  v_summary := private.global_season_reset_summary(p_reset_at, 'execute');

  UPDATE public.seasons
     SET is_active = FALSE,
         ended_at = COALESCE(ended_at, p_reset_at)
   WHERE is_active = TRUE;

  INSERT INTO public.seasons (name, started_at, is_active)
  VALUES ('Global reset ' || to_char(p_reset_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS "UTC"'), p_reset_at, TRUE)
  RETURNING id INTO v_season_id;

  WITH reset_coupons AS (
    SELECT id, stake
    FROM public.coupons
    WHERE created_at < p_reset_at
      AND status = 'pending'
  ),
  refunded_placed_bets AS (
    UPDATE public.placed_bets pb
       SET result = 'refund',
           payout = ROUND(pb.stake, 2)
      FROM reset_coupons rc
     WHERE pb.coupon_id = rc.id
       AND pb.result = 'pending'
    RETURNING pb.coupon_id
  )
  UPDATE public.coupons c
     SET status = 'refund',
         payout = ROUND(rc.stake, 2),
         settled_at = p_reset_at
    FROM reset_coupons rc
   WHERE c.id = rc.id;

  UPDATE public.profiles
     SET balance = 500,
         last_topup_at = NULL,
         current_streak = 0,
         longest_streak = 0,
         last_bet_date = NULL
   WHERE id IS NOT NULL;

  UPDATE public.bets
     SET is_active = FALSE
   WHERE is_active = TRUE
     AND ends_at <= p_reset_at;

  UPDATE public.daily_jackpot_pools
     SET status = 'cancelled',
         updated_at = p_reset_at
   WHERE status IN ('collecting', 'locked')
     AND (created_at < p_reset_at OR draw_scheduled_at <= p_reset_at);

  UPDATE public.casino_blackjack_games
     SET status = 'push',
         payout = 0,
         settled_at = p_reset_at
   WHERE status IN ('playing', 'insurance')
     AND created_at < p_reset_at;

  UPDATE public.casino_roulette_rounds
     SET phase = 'settled',
         settled_at = COALESCE(settled_at, p_reset_at)
   WHERE phase IN ('waiting', 'spinning')
     AND created_at < p_reset_at;

  RETURN v_summary || jsonb_build_object('season_id', v_season_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.execute_global_season_reset(TIMESTAMPTZ, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_global_season_reset(TIMESTAMPTZ, BOOLEAN) TO service_role;
