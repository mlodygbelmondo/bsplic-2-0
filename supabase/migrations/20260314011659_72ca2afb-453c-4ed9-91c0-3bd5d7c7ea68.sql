-- Backfill function
CREATE OR REPLACE FUNCTION public.backfill_streaks_and_badges()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user         RECORD;
  v_date         RECORD;
  v_current      INTEGER;
  v_longest      INTEGER;
  v_last_date    DATE;
  v_prev_date    DATE;
  v_user_bet_count    BIGINT;
  v_has_big_stake     BOOLEAN;
  v_has_coupon_bet    BOOLEAN;
  v_max_coupon_legs   BIGINT;
  v_distinct_coupons  BIGINT;
  v_distinct_cats     BIGINT;
  v_first_win         BOOLEAN;
  v_consec            TEXT[];
  v_total_winnings    NUMERIC;
  v_resolved_count    BIGINT;
  v_won_count         BIGINT;
  v_has_accepted_prop BOOLEAN;
BEGIN
  FOR v_user IN SELECT DISTINCT user_id FROM public.placed_bets
  LOOP
    v_current  := 0;
    v_longest  := 0;
    v_last_date := NULL;
    v_prev_date := NULL;

    FOR v_date IN
      SELECT DISTINCT created_at::DATE AS bet_date
        FROM public.placed_bets
       WHERE user_id = v_user.user_id
       ORDER BY bet_date DESC
    LOOP
      IF v_last_date IS NULL THEN
        v_last_date := v_date.bet_date;
        v_current := 1;
      ELSIF v_prev_date - v_date.bet_date = 1 THEN
        v_current := v_current + 1;
      ELSE
        v_longest := GREATEST(v_longest, v_current);
        v_current := 1;
      END IF;
      v_prev_date := v_date.bet_date;
    END LOOP;

    v_longest := GREATEST(v_longest, v_current);

    UPDATE public.profiles
       SET current_streak = v_current,
           longest_streak = v_longest,
           last_bet_date  = v_last_date
     WHERE id = v_user.user_id;

    IF v_current >= 7 THEN PERFORM public.award_badge(v_user.user_id, 'staly_bywalec'); END IF;
    IF v_current >= 30 THEN PERFORM public.award_badge(v_user.user_id, 'legenda'); END IF;

    SELECT count(*) INTO v_user_bet_count FROM public.placed_bets WHERE user_id = v_user.user_id;
    IF v_user_bet_count >= 1 THEN PERFORM public.award_badge(v_user.user_id, 'debiutant'); END IF;

    SELECT EXISTS (SELECT 1 FROM public.placed_bets WHERE user_id = v_user.user_id AND stake >= 500) INTO v_has_big_stake;
    IF v_has_big_stake THEN PERFORM public.award_badge(v_user.user_id, 'wieloryb'); END IF;

    SELECT EXISTS (SELECT 1 FROM public.placed_bets WHERE user_id = v_user.user_id AND coupon_id IS NOT NULL) INTO v_has_coupon_bet;
    IF v_has_coupon_bet THEN PERFORM public.award_badge(v_user.user_id, 'kuponista'); END IF;

    SELECT COALESCE(max(cnt), 0) INTO v_max_coupon_legs FROM (SELECT count(*) AS cnt FROM public.placed_bets WHERE user_id = v_user.user_id AND coupon_id IS NOT NULL GROUP BY coupon_id) sub;
    IF v_max_coupon_legs >= 5 THEN PERFORM public.award_badge(v_user.user_id, 'ryzykant'); END IF;

    SELECT count(DISTINCT coupon_id) INTO v_distinct_coupons FROM public.placed_bets WHERE user_id = v_user.user_id AND coupon_id IS NOT NULL;
    IF v_distinct_coupons >= 10 THEN PERFORM public.award_badge(v_user.user_id, 'multi_fan'); END IF;

    SELECT count(DISTINCT b.category_id) INTO v_distinct_cats FROM public.placed_bets pb JOIN public.bets b ON b.id = pb.bet_id WHERE pb.user_id = v_user.user_id AND b.category_id IS NOT NULL;
    IF v_distinct_cats >= 4 THEN PERFORM public.award_badge(v_user.user_id, 'wszechstronny'); END IF;

    SELECT EXISTS (SELECT 1 FROM public.placed_bets WHERE user_id = v_user.user_id AND result = 'won') INTO v_first_win;
    IF v_first_win THEN PERFORM public.award_badge(v_user.user_id, 'trafiony'); END IF;

    SELECT array_agg(result ORDER BY created_at DESC) INTO v_consec FROM (SELECT result, created_at FROM public.placed_bets WHERE user_id = v_user.user_id AND result IN ('won', 'lost') ORDER BY created_at DESC LIMIT 10) sub;
    IF v_consec IS NOT NULL THEN
      IF array_length(v_consec, 1) >= 3 AND v_consec[1] = 'won' AND v_consec[2] = 'won' AND v_consec[3] = 'won' THEN
        PERFORM public.award_badge(v_user.user_id, 'goraca_passa');
      END IF;
      IF array_length(v_consec, 1) >= 5 AND v_consec[1] = 'won' AND v_consec[2] = 'won' AND v_consec[3] = 'won' AND v_consec[4] = 'won' AND v_consec[5] = 'won' THEN
        PERFORM public.award_badge(v_user.user_id, 'nie_do_zatrzymania');
      END IF;
    END IF;

    SELECT COALESCE(SUM(payout), 0) INTO v_total_winnings FROM public.placed_bets WHERE user_id = v_user.user_id AND result = 'won';
    IF v_total_winnings > 1000 THEN PERFORM public.award_badge(v_user.user_id, 'pierwszy_tysiac'); END IF;

    SELECT count(*) FILTER (WHERE result IN ('won', 'lost')), count(*) FILTER (WHERE result = 'won') INTO v_resolved_count, v_won_count FROM public.placed_bets WHERE user_id = v_user.user_id;
    IF v_resolved_count >= 20 AND (v_won_count::NUMERIC / v_resolved_count) > 0.60 THEN PERFORM public.award_badge(v_user.user_id, 'analityk'); END IF;

    SELECT EXISTS (SELECT 1 FROM public.bet_proposals WHERE user_id = v_user.user_id AND status = 'accepted') INTO v_has_accepted_prop;
    IF v_has_accepted_prop THEN PERFORM public.award_badge(v_user.user_id, 'pomyslodawca'); END IF;
  END LOOP;

  FOR v_user IN SELECT DISTINCT user_id FROM public.bet_proposals WHERE status = 'accepted' AND user_id NOT IN (SELECT DISTINCT user_id FROM public.placed_bets)
  LOOP
    PERFORM public.award_badge(v_user.user_id, 'pomyslodawca');
  END LOOP;
END;
$$;

-- Run backfill
SELECT public.backfill_streaks_and_badges();