-- 1. award_badge helper
CREATE OR REPLACE FUNCTION public.award_badge(p_user_id UUID, p_badge_key TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.badges (user_id, badge_key)
  VALUES (p_user_id, p_badge_key)
  ON CONFLICT (user_id, badge_key) DO NOTHING;
END;
$$;

-- 2. update_user_streak
CREATE OR REPLACE FUNCTION public.update_user_streak()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_bet_date  DATE;
  v_current_streak INTEGER;
  v_longest_streak INTEGER;
  v_today          DATE := CURRENT_DATE;
BEGIN
  SELECT last_bet_date, current_streak, longest_streak
    INTO v_last_bet_date, v_current_streak, v_longest_streak
    FROM public.profiles
   WHERE id = NEW.user_id;

  IF v_last_bet_date = v_today THEN
    RETURN NEW;
  END IF;

  IF v_last_bet_date = v_today - 1 THEN
    v_current_streak := v_current_streak + 1;
  ELSE
    v_current_streak := 1;
  END IF;

  v_longest_streak := GREATEST(v_longest_streak, v_current_streak);

  UPDATE public.profiles
     SET current_streak  = v_current_streak,
         longest_streak  = v_longest_streak,
         last_bet_date   = v_today
   WHERE id = NEW.user_id;

  IF v_current_streak >= 7 THEN
    PERFORM public.award_badge(NEW.user_id, 'staly_bywalec');
  END IF;

  IF v_current_streak >= 30 THEN
    PERFORM public.award_badge(NEW.user_id, 'legenda');
  END IF;

  RETURN NEW;
END;
$$;

-- 3. check_badges_on_bet_insert
CREATE OR REPLACE FUNCTION public.check_badges_on_bet_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_bet_count   BIGINT;
  v_coupon_leg_count BIGINT;
  v_distinct_coupons BIGINT;
  v_distinct_cats    BIGINT;
BEGIN
  SELECT count(*) INTO v_user_bet_count
    FROM public.placed_bets
   WHERE user_id = NEW.user_id;

  IF v_user_bet_count = 1 THEN
    PERFORM public.award_badge(NEW.user_id, 'debiutant');
  END IF;

  IF NEW.stake >= 500 THEN
    PERFORM public.award_badge(NEW.user_id, 'wieloryb');
  END IF;

  IF NEW.coupon_id IS NOT NULL THEN
    PERFORM public.award_badge(NEW.user_id, 'kuponista');

    SELECT count(*) INTO v_coupon_leg_count
      FROM public.placed_bets
     WHERE coupon_id = NEW.coupon_id;

    IF v_coupon_leg_count >= 5 THEN
      PERFORM public.award_badge(NEW.user_id, 'ryzykant');
    END IF;
  END IF;

  SELECT count(DISTINCT coupon_id) INTO v_distinct_coupons
    FROM public.placed_bets
   WHERE user_id = NEW.user_id
     AND coupon_id IS NOT NULL;

  IF v_distinct_coupons >= 10 THEN
    PERFORM public.award_badge(NEW.user_id, 'multi_fan');
  END IF;

  SELECT count(DISTINCT b.category_id) INTO v_distinct_cats
    FROM public.placed_bets pb
    JOIN public.bets b ON b.id = pb.bet_id
   WHERE pb.user_id = NEW.user_id
     AND b.category_id IS NOT NULL;

  IF v_distinct_cats >= 4 THEN
    PERFORM public.award_badge(NEW.user_id, 'wszechstronny');
  END IF;

  RETURN NEW;
END;
$$;

-- 4. check_badges_on_bet_result
CREATE OR REPLACE FUNCTION public.check_badges_on_bet_result()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first_win       BOOLEAN;
  v_consec          TEXT[];
  v_resolved_count  BIGINT;
  v_won_count       BIGINT;
  v_total_winnings  NUMERIC;
BEGIN
  IF NEW.result NOT IN ('won', 'lost') THEN
    RETURN NEW;
  END IF;

  IF NEW.result = 'won' THEN
    SELECT NOT EXISTS (
      SELECT 1 FROM public.placed_bets
       WHERE user_id = NEW.user_id
         AND result = 'won'
         AND id <> NEW.id
    ) INTO v_first_win;

    IF v_first_win THEN
      PERFORM public.award_badge(NEW.user_id, 'trafiony');
    END IF;
  END IF;

  SELECT array_agg(result ORDER BY created_at DESC)
    INTO v_consec
    FROM (
      SELECT result, created_at
        FROM public.placed_bets
       WHERE user_id = NEW.user_id
         AND result IN ('won', 'lost')
       ORDER BY created_at DESC
       LIMIT 10
    ) sub;

  IF v_consec IS NOT NULL THEN
    IF array_length(v_consec, 1) >= 3
       AND v_consec[1] = 'won'
       AND v_consec[2] = 'won'
       AND v_consec[3] = 'won' THEN
      PERFORM public.award_badge(NEW.user_id, 'goraca_passa');
    END IF;

    IF array_length(v_consec, 1) >= 5
       AND v_consec[1] = 'won'
       AND v_consec[2] = 'won'
       AND v_consec[3] = 'won'
       AND v_consec[4] = 'won'
       AND v_consec[5] = 'won' THEN
      PERFORM public.award_badge(NEW.user_id, 'nie_do_zatrzymania');
    END IF;

    IF array_length(v_consec, 1) >= 10 THEN
      DECLARE
        v_all_won BOOLEAN := TRUE;
        i INTEGER;
      BEGIN
        FOR i IN 1..10 LOOP
          IF v_consec[i] <> 'won' THEN
            v_all_won := FALSE;
            EXIT;
          END IF;
        END LOOP;
        IF v_all_won THEN
          PERFORM public.award_badge(NEW.user_id, 'mistrz_serii');
        END IF;
      END;
    END IF;
  END IF;

  SELECT COALESCE(SUM(payout), 0) INTO v_total_winnings
    FROM public.placed_bets
   WHERE user_id = NEW.user_id
     AND result = 'won';

  IF v_total_winnings > 1000 THEN
    PERFORM public.award_badge(NEW.user_id, 'pierwszy_tysiac');
  END IF;

  SELECT count(*) FILTER (WHERE result IN ('won', 'lost')),
         count(*) FILTER (WHERE result = 'won')
    INTO v_resolved_count, v_won_count
    FROM public.placed_bets
   WHERE user_id = NEW.user_id;

  IF v_resolved_count >= 20 AND (v_won_count::NUMERIC / v_resolved_count) > 0.60 THEN
    PERFORM public.award_badge(NEW.user_id, 'analityk');
  END IF;

  RETURN NEW;
END;
$$;

-- 5. resolve_coupon_status
CREATE OR REPLACE FUNCTION public.resolve_coupon_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total     BIGINT;
  v_resolved  BIGINT;
  v_lost      BIGINT;
BEGIN
  IF NEW.coupon_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*),
         count(*) FILTER (WHERE result IN ('won', 'lost')),
         count(*) FILTER (WHERE result = 'lost')
    INTO v_total, v_resolved, v_lost
    FROM public.placed_bets
   WHERE coupon_id = NEW.coupon_id;

  IF v_resolved = v_total THEN
    IF v_lost > 0 THEN
      UPDATE public.coupons SET status = 'lost' WHERE id = NEW.coupon_id;
    ELSE
      UPDATE public.coupons SET status = 'won' WHERE id = NEW.coupon_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 6. check_badge_on_proposal_accept
CREATE OR REPLACE FUNCTION public.check_badge_on_proposal_accept()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.award_badge(NEW.user_id, 'pomyslodawca');
  RETURN NEW;
END;
$$;