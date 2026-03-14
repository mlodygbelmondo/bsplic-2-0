-- Migration: Streaks, badges, coupon resolution, and backfill
-- Created: 2026-03-14

-- ============================================================
-- 1. award_badge(p_user_id UUID, p_badge_key TEXT)
--    SECURITY DEFINER to bypass SELECT-only RLS on badges.
-- ============================================================
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

-- ============================================================
-- 2. update_user_streak() — AFTER INSERT ON placed_bets
--    Updates current_streak, longest_streak, last_bet_date.
--    Awards streak badges: staly_bywalec (7), legenda (30).
-- ============================================================
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

  -- Already placed a bet today — nothing to update
  IF v_last_bet_date = v_today THEN
    RETURN NEW;
  END IF;

  -- Consecutive day
  IF v_last_bet_date = v_today - 1 THEN
    v_current_streak := v_current_streak + 1;
  ELSE
    -- Gap or first bet ever
    v_current_streak := 1;
  END IF;

  v_longest_streak := GREATEST(v_longest_streak, v_current_streak);

  UPDATE public.profiles
     SET current_streak  = v_current_streak,
         longest_streak  = v_longest_streak,
         last_bet_date   = v_today
   WHERE id = NEW.user_id;

  -- Streak-based badges
  IF v_current_streak >= 7 THEN
    PERFORM public.award_badge(NEW.user_id, 'staly_bywalec');
  END IF;

  IF v_current_streak >= 30 THEN
    PERFORM public.award_badge(NEW.user_id, 'legenda');
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 3. check_badges_on_bet_insert() — AFTER INSERT ON placed_bets
--    Checks: debiutant, wieloryb, kuponista, ryzykant,
--            multi_fan, wszechstronny.
-- ============================================================
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
  -- debiutant: user's first ever placed bet
  SELECT count(*) INTO v_user_bet_count
    FROM public.placed_bets
   WHERE user_id = NEW.user_id;

  IF v_user_bet_count = 1 THEN
    PERFORM public.award_badge(NEW.user_id, 'debiutant');
  END IF;

  -- wieloryb: stake >= 500
  IF NEW.stake >= 500 THEN
    PERFORM public.award_badge(NEW.user_id, 'wieloryb');
  END IF;

  -- kuponista: bet placed as part of a coupon
  IF NEW.coupon_id IS NOT NULL THEN
    PERFORM public.award_badge(NEW.user_id, 'kuponista');

    -- ryzykant: 5+ legs in the same coupon
    SELECT count(*) INTO v_coupon_leg_count
      FROM public.placed_bets
     WHERE coupon_id = NEW.coupon_id;

    IF v_coupon_leg_count >= 5 THEN
      PERFORM public.award_badge(NEW.user_id, 'ryzykant');
    END IF;
  END IF;

  -- multi_fan: 10+ distinct non-null coupon_ids
  SELECT count(DISTINCT coupon_id) INTO v_distinct_coupons
    FROM public.placed_bets
   WHERE user_id = NEW.user_id
     AND coupon_id IS NOT NULL;

  IF v_distinct_coupons >= 10 THEN
    PERFORM public.award_badge(NEW.user_id, 'multi_fan');
  END IF;

  -- wszechstronny: bets in 4+ distinct categories
  -- category comes from bets.category_id
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

-- ============================================================
-- 4. check_badges_on_bet_result() — AFTER UPDATE ON placed_bets
--    WHEN (NEW.result IS DISTINCT FROM OLD.result)
--    Checks: trafiony, goraca_passa, nie_do_zatrzymania,
--            mistrz_serii, pierwszy_tysiac, analityk.
-- ============================================================
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
  -- Only care about transitions to won or lost
  IF NEW.result NOT IN ('won', 'lost') THEN
    RETURN NEW;
  END IF;

  -- trafiony: first ever win
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

  -- Consecutive wins check (goraca_passa=3, nie_do_zatrzymania=5, mistrz_serii=10)
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
    -- goraca_passa: last 3 resolved all won
    IF array_length(v_consec, 1) >= 3
       AND v_consec[1] = 'won'
       AND v_consec[2] = 'won'
       AND v_consec[3] = 'won' THEN
      PERFORM public.award_badge(NEW.user_id, 'goraca_passa');
    END IF;

    -- nie_do_zatrzymania: last 5 resolved all won
    IF array_length(v_consec, 1) >= 5
       AND v_consec[1] = 'won'
       AND v_consec[2] = 'won'
       AND v_consec[3] = 'won'
       AND v_consec[4] = 'won'
       AND v_consec[5] = 'won' THEN
      PERFORM public.award_badge(NEW.user_id, 'nie_do_zatrzymania');
    END IF;

    -- mistrz_serii: last 10 resolved all won
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

  -- pierwszy_tysiac: total winnings (payout where result='won') > 1000
  SELECT COALESCE(SUM(payout), 0) INTO v_total_winnings
    FROM public.placed_bets
   WHERE user_id = NEW.user_id
     AND result = 'won';

  IF v_total_winnings > 1000 THEN
    PERFORM public.award_badge(NEW.user_id, 'pierwszy_tysiac');
  END IF;

  -- analityk: win rate > 60% with at least 20 resolved bets
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

-- ============================================================
-- 5. resolve_coupon_status() — AFTER UPDATE ON placed_bets
--    WHEN (NEW.result IS DISTINCT FROM OLD.result)
--    When all legs of a coupon are resolved, set coupon status.
-- ============================================================
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
    -- All legs resolved
    IF v_lost > 0 THEN
      UPDATE public.coupons SET status = 'lost' WHERE id = NEW.coupon_id;
    ELSE
      UPDATE public.coupons SET status = 'won' WHERE id = NEW.coupon_id;
    END IF;
  END IF;
  -- If not all resolved, leave as 'pending'

  RETURN NEW;
END;
$$;

-- ============================================================
-- 6. check_badge_on_proposal_accept() — AFTER UPDATE ON
--    bet_proposals WHEN status becomes 'accepted'.
--    Badge: pomyslodawca
-- ============================================================
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

-- ============================================================
-- 7. Create all triggers
-- ============================================================

CREATE TRIGGER trg_update_streak
  AFTER INSERT ON public.placed_bets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_streak();

CREATE TRIGGER trg_badges_on_insert
  AFTER INSERT ON public.placed_bets
  FOR EACH ROW
  EXECUTE FUNCTION public.check_badges_on_bet_insert();

CREATE TRIGGER trg_badges_on_result
  AFTER UPDATE ON public.placed_bets
  FOR EACH ROW
  WHEN (NEW.result IS DISTINCT FROM OLD.result)
  EXECUTE FUNCTION public.check_badges_on_bet_result();

CREATE TRIGGER trg_resolve_coupon
  AFTER UPDATE ON public.placed_bets
  FOR EACH ROW
  WHEN (NEW.result IS DISTINCT FROM OLD.result)
  EXECUTE FUNCTION public.resolve_coupon_status();

CREATE TRIGGER trg_badge_proposal
  AFTER UPDATE ON public.bet_proposals
  FOR EACH ROW
  WHEN (NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted')
  EXECUTE FUNCTION public.check_badge_on_proposal_accept();

-- ============================================================
-- 8. backfill_streaks_and_badges() — one-time backfill
--    Recalculates streaks and awards all earned badges.
-- ============================================================
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

  -- badge check vars
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
  -- Process each user who has at least one placed bet
  FOR v_user IN
    SELECT DISTINCT user_id FROM public.placed_bets
  LOOP
    -- --------------------------------------------------------
    -- Streak recalculation
    -- --------------------------------------------------------
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
        -- First (most recent) date
        v_last_date := v_date.bet_date;
        v_current := 1;
      ELSIF v_prev_date - v_date.bet_date = 1 THEN
        -- Consecutive day
        v_current := v_current + 1;
      ELSE
        -- Gap: the current streak ended, check longest, reset
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

    -- Streak badges
    IF v_current >= 7 THEN
      PERFORM public.award_badge(v_user.user_id, 'staly_bywalec');
    END IF;
    IF v_current >= 30 THEN
      PERFORM public.award_badge(v_user.user_id, 'legenda');
    END IF;

    -- --------------------------------------------------------
    -- Insert-time badges
    -- --------------------------------------------------------

    -- debiutant: has at least 1 bet
    SELECT count(*) INTO v_user_bet_count
      FROM public.placed_bets
     WHERE user_id = v_user.user_id;

    IF v_user_bet_count >= 1 THEN
      PERFORM public.award_badge(v_user.user_id, 'debiutant');
    END IF;

    -- wieloryb: any bet with stake >= 500
    SELECT EXISTS (
      SELECT 1 FROM public.placed_bets
       WHERE user_id = v_user.user_id AND stake >= 500
    ) INTO v_has_big_stake;

    IF v_has_big_stake THEN
      PERFORM public.award_badge(v_user.user_id, 'wieloryb');
    END IF;

    -- kuponista: any bet with coupon_id IS NOT NULL
    SELECT EXISTS (
      SELECT 1 FROM public.placed_bets
       WHERE user_id = v_user.user_id AND coupon_id IS NOT NULL
    ) INTO v_has_coupon_bet;

    IF v_has_coupon_bet THEN
      PERFORM public.award_badge(v_user.user_id, 'kuponista');
    END IF;

    -- ryzykant: any coupon with 5+ legs
    SELECT COALESCE(max(cnt), 0) INTO v_max_coupon_legs
      FROM (
        SELECT count(*) AS cnt
          FROM public.placed_bets
         WHERE user_id = v_user.user_id
           AND coupon_id IS NOT NULL
         GROUP BY coupon_id
      ) sub;

    IF v_max_coupon_legs >= 5 THEN
      PERFORM public.award_badge(v_user.user_id, 'ryzykant');
    END IF;

    -- multi_fan: 10+ distinct coupons
    SELECT count(DISTINCT coupon_id) INTO v_distinct_coupons
      FROM public.placed_bets
     WHERE user_id = v_user.user_id
       AND coupon_id IS NOT NULL;

    IF v_distinct_coupons >= 10 THEN
      PERFORM public.award_badge(v_user.user_id, 'multi_fan');
    END IF;

    -- wszechstronny: 4+ distinct categories
    SELECT count(DISTINCT b.category_id) INTO v_distinct_cats
      FROM public.placed_bets pb
      JOIN public.bets b ON b.id = pb.bet_id
     WHERE pb.user_id = v_user.user_id
       AND b.category_id IS NOT NULL;

    IF v_distinct_cats >= 4 THEN
      PERFORM public.award_badge(v_user.user_id, 'wszechstronny');
    END IF;

    -- --------------------------------------------------------
    -- Result-time badges
    -- --------------------------------------------------------

    -- trafiony: at least one win
    SELECT EXISTS (
      SELECT 1 FROM public.placed_bets
       WHERE user_id = v_user.user_id AND result = 'won'
    ) INTO v_first_win;

    IF v_first_win THEN
      PERFORM public.award_badge(v_user.user_id, 'trafiony');
    END IF;

    -- Consecutive wins
    SELECT array_agg(result ORDER BY created_at DESC)
      INTO v_consec
      FROM (
        SELECT result, created_at
          FROM public.placed_bets
         WHERE user_id = v_user.user_id
           AND result IN ('won', 'lost')
         ORDER BY created_at DESC
         LIMIT 10
      ) sub;

    IF v_consec IS NOT NULL THEN
      IF array_length(v_consec, 1) >= 3
         AND v_consec[1] = 'won'
         AND v_consec[2] = 'won'
         AND v_consec[3] = 'won' THEN
        PERFORM public.award_badge(v_user.user_id, 'goraca_passa');
      END IF;

      IF array_length(v_consec, 1) >= 5
         AND v_consec[1] = 'won'
         AND v_consec[2] = 'won'
         AND v_consec[3] = 'won'
         AND v_consec[4] = 'won'
         AND v_consec[5] = 'won' THEN
        PERFORM public.award_badge(v_user.user_id, 'nie_do_zatrzymania');
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
            PERFORM public.award_badge(v_user.user_id, 'mistrz_serii');
          END IF;
        END;
      END IF;
    END IF;

    -- pierwszy_tysiac: total payout from wins > 1000
    SELECT COALESCE(SUM(payout), 0) INTO v_total_winnings
      FROM public.placed_bets
     WHERE user_id = v_user.user_id
       AND result = 'won';

    IF v_total_winnings > 1000 THEN
      PERFORM public.award_badge(v_user.user_id, 'pierwszy_tysiac');
    END IF;

    -- analityk: >60% win rate with 20+ resolved bets
    SELECT count(*) FILTER (WHERE result IN ('won', 'lost')),
           count(*) FILTER (WHERE result = 'won')
      INTO v_resolved_count, v_won_count
      FROM public.placed_bets
     WHERE user_id = v_user.user_id;

    IF v_resolved_count >= 20 AND (v_won_count::NUMERIC / v_resolved_count) > 0.60 THEN
      PERFORM public.award_badge(v_user.user_id, 'analityk');
    END IF;

    -- pomyslodawca: has an accepted proposal
    SELECT EXISTS (
      SELECT 1 FROM public.bet_proposals
       WHERE user_id = v_user.user_id AND status = 'accepted'
    ) INTO v_has_accepted_prop;

    IF v_has_accepted_prop THEN
      PERFORM public.award_badge(v_user.user_id, 'pomyslodawca');
    END IF;

  END LOOP;

  -- Also check pomyslodawca for users who have accepted proposals
  -- but may not have placed bets (not covered by the loop above)
  FOR v_user IN
    SELECT DISTINCT user_id FROM public.bet_proposals
     WHERE status = 'accepted'
       AND user_id NOT IN (SELECT DISTINCT user_id FROM public.placed_bets)
  LOOP
    PERFORM public.award_badge(v_user.user_id, 'pomyslodawca');
  END LOOP;

END;
$$;

-- Run the backfill
SELECT public.backfill_streaks_and_badges();
