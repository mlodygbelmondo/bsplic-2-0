-- Global season reset foundation and season-aware economic reads.

CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT seasons_active_ended_check CHECK (
    (is_active = TRUE AND ended_at IS NULL)
    OR is_active = FALSE
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS seasons_one_active_idx
  ON public.seasons (is_active)
  WHERE is_active = TRUE;

ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.seasons FROM anon, authenticated;

CREATE OR REPLACE FUNCTION private.get_active_season_started_at()
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT started_at
      FROM public.seasons
      WHERE is_active = TRUE
      ORDER BY started_at DESC
      LIMIT 1
    ),
    '-infinity'::TIMESTAMPTZ
  );
$$;

REVOKE ALL ON FUNCTION private.get_active_season_started_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.get_active_season_started_at() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.get_active_season_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.seasons
  WHERE is_active = TRUE
  ORDER BY started_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION private.get_active_season_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.get_active_season_id() TO anon, authenticated, service_role;

ALTER TABLE public.badges
  ADD COLUMN IF NOT EXISTS season_id UUID REFERENCES public.seasons(id) ON DELETE SET NULL;

ALTER TABLE public.badges
  DROP CONSTRAINT IF EXISTS badges_user_id_badge_key_key;

CREATE UNIQUE INDEX IF NOT EXISTS badges_user_badge_season_unique
  ON public.badges (user_id, badge_key, season_id)
  WHERE season_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS badges_user_badge_preseason_unique
  ON public.badges (user_id, badge_key)
  WHERE season_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_badges_user_season_unlocked
  ON public.badges (user_id, season_id, unlocked_at DESC);

CREATE OR REPLACE FUNCTION private.global_season_reset_summary(
  p_reset_at TIMESTAMPTZ,
  p_mode TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_profiles_reset BIGINT;
  v_pending_coupons_refunded BIGINT;
  v_expired_events_deactivated BIGINT;
  v_sportsbook_records_archived BIGINT;
  v_casino_records_archived BIGINT;
  v_jackpot_records_isolated BIGINT;
  v_economic_social_items_hidden BIGINT;
  v_badges_archived BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_profiles_reset
  FROM public.profiles;

  SELECT COUNT(*) INTO v_pending_coupons_refunded
  FROM public.coupons
  WHERE status = 'pending'
    AND created_at < p_reset_at;

  SELECT COUNT(*) INTO v_expired_events_deactivated
  FROM public.bets
  WHERE is_active = TRUE
    AND ends_at <= p_reset_at;

  SELECT COUNT(*) INTO v_sportsbook_records_archived
  FROM (
    SELECT id FROM public.coupons WHERE created_at < p_reset_at
    UNION ALL
    SELECT id FROM public.placed_bets WHERE created_at < p_reset_at
  ) sportsbook_archive;

  SELECT COUNT(*) INTO v_casino_records_archived
  FROM (
    SELECT id FROM public.casino_roulette_bets WHERE created_at < p_reset_at
    UNION ALL
    SELECT id FROM public.casino_blackjack_games WHERE created_at < p_reset_at
  ) casino_archive;

  SELECT COUNT(*) INTO v_jackpot_records_isolated
  FROM (
    SELECT id FROM public.daily_jackpot_pools
    WHERE created_at < p_reset_at
       OR draw_scheduled_at <= p_reset_at
    UNION ALL
    SELECT t.id
    FROM public.daily_jackpot_tickets t
    JOIN public.daily_jackpot_pools p ON p.id = t.pool_id
    WHERE p.created_at < p_reset_at
       OR p.draw_scheduled_at <= p_reset_at
  ) jackpot_archive;

  SELECT COUNT(*) INTO v_economic_social_items_hidden
  FROM (
    SELECT id FROM public.coupons WHERE created_at < p_reset_at
    UNION ALL
    SELECT id FROM public.casino_social_shares WHERE created_at < p_reset_at
  ) social_archive;

  SELECT COUNT(*) INTO v_badges_archived
  FROM public.badges
  WHERE unlocked_at < p_reset_at;

  RETURN jsonb_build_object(
    'mode', p_mode,
    'reset_at', p_reset_at,
    'profiles_reset', v_profiles_reset,
    'pending_coupons_refunded', v_pending_coupons_refunded,
    'expired_events_deactivated', v_expired_events_deactivated,
    'sportsbook_records_archived', v_sportsbook_records_archived,
    'casino_records_archived', v_casino_records_archived,
    'jackpot_records_isolated', v_jackpot_records_isolated,
    'economic_social_items_hidden', v_economic_social_items_hidden,
    'badges_archived', v_badges_archived
  );
END;
$$;

REVOKE ALL ON FUNCTION private.global_season_reset_summary(TIMESTAMPTZ, TEXT) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.preview_global_season_reset(
  p_reset_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF p_reset_at IS NULL THEN
    RAISE EXCEPTION 'Reset timestamp is required';
  END IF;

  RETURN private.global_season_reset_summary(p_reset_at, 'dry-run');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.preview_global_season_reset(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.preview_global_season_reset(TIMESTAMPTZ) TO service_role;

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
         last_bet_date = NULL;

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

CREATE OR REPLACE FUNCTION public.award_badge(p_user_id UUID, p_badge_key TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_season_id UUID := private.get_active_season_id();
  v_season_started_at TIMESTAMPTZ := private.get_active_season_started_at();
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.badges
    WHERE user_id = p_user_id
      AND badge_key = p_badge_key
      AND unlocked_at >= v_season_started_at
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.badges (user_id, badge_key, season_id)
  VALUES (p_user_id, p_badge_key, v_season_id)
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.award_badge(UUID, TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.check_badges_on_bet_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_season_started_at TIMESTAMPTZ := private.get_active_season_started_at();
  v_user_bet_count   BIGINT;
  v_coupon_leg_count BIGINT;
  v_distinct_coupons BIGINT;
  v_distinct_cats    BIGINT;
BEGIN
  SELECT count(*) INTO v_user_bet_count
    FROM public.placed_bets
   WHERE user_id = NEW.user_id
     AND created_at >= v_season_started_at;

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
     WHERE coupon_id = NEW.coupon_id
       AND created_at >= v_season_started_at;

    IF v_coupon_leg_count >= 5 THEN
      PERFORM public.award_badge(NEW.user_id, 'ryzykant');
    END IF;
  END IF;

  SELECT count(DISTINCT coupon_id) INTO v_distinct_coupons
    FROM public.placed_bets
   WHERE user_id = NEW.user_id
     AND coupon_id IS NOT NULL
     AND created_at >= v_season_started_at;

  IF v_distinct_coupons >= 10 THEN
    PERFORM public.award_badge(NEW.user_id, 'multi_fan');
  END IF;

  SELECT count(DISTINCT b.category_id) INTO v_distinct_cats
    FROM public.placed_bets pb
    JOIN public.bets b ON b.id = pb.bet_id
   WHERE pb.user_id = NEW.user_id
     AND b.category_id IS NOT NULL
     AND pb.created_at >= v_season_started_at;

  IF v_distinct_cats >= 4 THEN
    PERFORM public.award_badge(NEW.user_id, 'wszechstronny');
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_badges_on_bet_result()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_season_started_at TIMESTAMPTZ := private.get_active_season_started_at();
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
         AND created_at >= v_season_started_at
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
         AND created_at >= v_season_started_at
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
     AND result = 'won'
     AND created_at >= v_season_started_at;

  IF v_total_winnings > 1000 THEN
    PERFORM public.award_badge(NEW.user_id, 'pierwszy_tysiac');
  END IF;

  SELECT count(*) FILTER (WHERE result IN ('won', 'lost')),
         count(*) FILTER (WHERE result = 'won')
    INTO v_resolved_count, v_won_count
    FROM public.placed_bets
   WHERE user_id = NEW.user_id
     AND created_at >= v_season_started_at;

  IF v_resolved_count >= 20 AND (v_won_count::NUMERIC / v_resolved_count) > 0.60 THEN
    PERFORM public.award_badge(NEW.user_id, 'analityk');
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.backfill_streaks_and_badges()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_season_started_at TIMESTAMPTZ := private.get_active_season_started_at();
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
  v_has_win           BOOLEAN;
  v_consec            TEXT[];
  v_total_winnings    NUMERIC;
  v_resolved_count    BIGINT;
  v_won_count         BIGINT;
  v_has_accepted_prop BOOLEAN;
BEGIN
  FOR v_user IN
    SELECT DISTINCT user_id
    FROM public.placed_bets
    WHERE created_at >= v_season_started_at
  LOOP
    v_current  := 0;
    v_longest  := 0;
    v_last_date := NULL;
    v_prev_date := NULL;

    FOR v_date IN
      SELECT DISTINCT created_at::DATE AS bet_date
        FROM public.placed_bets
       WHERE user_id = v_user.user_id
         AND created_at >= v_season_started_at
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

    IF v_current >= 7 THEN
      PERFORM public.award_badge(v_user.user_id, 'staly_bywalec');
    END IF;
    IF v_current >= 30 THEN
      PERFORM public.award_badge(v_user.user_id, 'legenda');
    END IF;

    SELECT count(*) INTO v_user_bet_count
      FROM public.placed_bets
     WHERE user_id = v_user.user_id
       AND created_at >= v_season_started_at;

    IF v_user_bet_count >= 1 THEN
      PERFORM public.award_badge(v_user.user_id, 'debiutant');
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.placed_bets
       WHERE user_id = v_user.user_id
         AND stake >= 500
         AND created_at >= v_season_started_at
    ) INTO v_has_big_stake;

    IF v_has_big_stake THEN
      PERFORM public.award_badge(v_user.user_id, 'wieloryb');
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.placed_bets
       WHERE user_id = v_user.user_id
         AND coupon_id IS NOT NULL
         AND created_at >= v_season_started_at
    ) INTO v_has_coupon_bet;

    IF v_has_coupon_bet THEN
      PERFORM public.award_badge(v_user.user_id, 'kuponista');
    END IF;

    SELECT COALESCE(max(cnt), 0) INTO v_max_coupon_legs
      FROM (
        SELECT count(*) AS cnt
          FROM public.placed_bets
         WHERE user_id = v_user.user_id
           AND coupon_id IS NOT NULL
           AND created_at >= v_season_started_at
         GROUP BY coupon_id
      ) sub;

    IF v_max_coupon_legs >= 5 THEN
      PERFORM public.award_badge(v_user.user_id, 'ryzykant');
    END IF;

    SELECT count(DISTINCT coupon_id) INTO v_distinct_coupons
      FROM public.placed_bets
     WHERE user_id = v_user.user_id
       AND coupon_id IS NOT NULL
       AND created_at >= v_season_started_at;

    IF v_distinct_coupons >= 10 THEN
      PERFORM public.award_badge(v_user.user_id, 'multi_fan');
    END IF;

    SELECT count(DISTINCT b.category_id) INTO v_distinct_cats
      FROM public.placed_bets pb
      JOIN public.bets b ON b.id = pb.bet_id
     WHERE pb.user_id = v_user.user_id
       AND b.category_id IS NOT NULL
       AND pb.created_at >= v_season_started_at;

    IF v_distinct_cats >= 4 THEN
      PERFORM public.award_badge(v_user.user_id, 'wszechstronny');
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.placed_bets
       WHERE user_id = v_user.user_id
         AND result = 'won'
         AND created_at >= v_season_started_at
    ) INTO v_has_win;

    IF v_has_win THEN
      PERFORM public.award_badge(v_user.user_id, 'trafiony');
    END IF;

    SELECT array_agg(result ORDER BY created_at DESC)
      INTO v_consec
      FROM (
        SELECT result, created_at
          FROM public.placed_bets
         WHERE user_id = v_user.user_id
           AND result IN ('won', 'lost')
           AND created_at >= v_season_started_at
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

    SELECT COALESCE(SUM(payout), 0) INTO v_total_winnings
      FROM public.placed_bets
     WHERE user_id = v_user.user_id
       AND result = 'won'
       AND created_at >= v_season_started_at;

    IF v_total_winnings > 1000 THEN
      PERFORM public.award_badge(v_user.user_id, 'pierwszy_tysiac');
    END IF;

    SELECT count(*) FILTER (WHERE result IN ('won', 'lost')),
           count(*) FILTER (WHERE result = 'won')
      INTO v_resolved_count, v_won_count
      FROM public.placed_bets
     WHERE user_id = v_user.user_id
       AND created_at >= v_season_started_at;

    IF v_resolved_count >= 20 AND (v_won_count::NUMERIC / v_resolved_count) > 0.60 THEN
      PERFORM public.award_badge(v_user.user_id, 'analityk');
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.bet_proposals
       WHERE user_id = v_user.user_id
         AND status = 'accepted'
         AND created_at >= v_season_started_at
    ) INTO v_has_accepted_prop;

    IF v_has_accepted_prop THEN
      PERFORM public.award_badge(v_user.user_id, 'pomyslodawca');
    END IF;
  END LOOP;

  FOR v_user IN
    SELECT DISTINCT user_id
    FROM public.bet_proposals
    WHERE status = 'accepted'
      AND created_at >= v_season_started_at
      AND user_id NOT IN (
        SELECT DISTINCT user_id
        FROM public.placed_bets
        WHERE created_at >= v_season_started_at
      )
  LOOP
    PERFORM public.award_badge(v_user.user_id, 'pomyslodawca');
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.backfill_streaks_and_badges() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_streaks_and_badges() TO service_role;

CREATE OR REPLACE FUNCTION private.sportsbook_ranking_units(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  user_id UUID,
  unit_result TEXT,
  profit NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  WITH coupon_units AS (
    SELECT
      c.id AS coupon_id,
      c.user_id,
      CASE
        WHEN COUNT(*) FILTER (WHERE pb.result = 'lost') > 0 THEN 'lost'
        WHEN COUNT(*) FILTER (WHERE pb.result = 'refund') = COUNT(*) THEN 'refund'
        WHEN COUNT(*) > 0
          AND COUNT(*) FILTER (WHERE pb.result IN ('won', 'lost', 'refund')) = COUNT(*)
          THEN 'won'
        ELSE 'pending'
      END AS unit_result,
      ROUND(
        CASE
          WHEN COUNT(*) FILTER (WHERE pb.result = 'lost') > 0 THEN -c.stake
          WHEN COUNT(*) FILTER (WHERE pb.result = 'refund') = COUNT(*) THEN 0
          WHEN COUNT(*) > 0
            AND COUNT(*) FILTER (WHERE pb.result IN ('won', 'lost', 'refund')) = COUNT(*)
            THEN COALESCE(NULLIF(c.payout, 0), ROUND(c.stake * c.total_odds, 2)) - c.stake
          ELSE 0
        END,
        2
      ) AS profit
    FROM public.coupons AS c
    JOIN public.placed_bets AS pb ON pb.coupon_id = c.id
    WHERE c.total_odds > 1
      AND c.created_at >= private.get_active_season_started_at()
      AND (p_user_id IS NULL OR c.user_id = p_user_id)
    GROUP BY c.id, c.user_id, c.stake, c.total_odds, c.payout
  )
  SELECT
    cu.user_id,
    cu.unit_result,
    cu.profit
  FROM coupon_units AS cu

  UNION ALL

  SELECT
    pb.user_id,
    pb.result AS unit_result,
    ROUND(
      CASE
        WHEN pb.result = 'won' THEN COALESCE(pb.payout, 0) - pb.stake
        WHEN pb.result = 'lost' THEN -pb.stake
        ELSE 0
      END,
      2
    ) AS profit
  FROM public.placed_bets AS pb
  LEFT JOIN public.coupons AS c ON c.id = pb.coupon_id
  WHERE (pb.coupon_id IS NULL OR COALESCE(c.total_odds, 1) <= 1)
    AND pb.created_at >= private.get_active_season_started_at()
    AND (p_user_id IS NULL OR pb.user_id = p_user_id);
$$;

REVOKE ALL ON FUNCTION private.sportsbook_ranking_units(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.sportsbook_ranking_units(UUID) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.get_user_stats_for_rpc(p_user_id UUID)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  WITH season AS (
    SELECT private.get_active_season_started_at() AS started_at
  )
  SELECT json_build_object(
    'total_bets', COALESCE(s.total_bets, 0),
    'won_bets', COALESCE(s.won_bets, 0),
    'lost_bets', COALESCE(s.lost_bets, 0),
    'win_rate', COALESCE(s.win_rate, 0),
    'total_profit', COALESCE(s.total_profit, 0)
  )
  FROM season
  CROSS JOIN (
    SELECT
      0::BIGINT AS total_bets,
      0::BIGINT AS won_bets,
      0::BIGINT AS lost_bets,
      0::NUMERIC AS win_rate,
      0::NUMERIC AS total_profit
  ) AS defaults
  LEFT JOIN LATERAL (
    SELECT
      stats.total_bets,
      stats.won_bets,
      stats.lost_bets,
      stats.win_rate,
      stats.total_profit
    FROM private.get_sportsbook_stats(p_user_id) AS stats
    LIMIT 1
  ) AS s ON TRUE;
$$;

REVOKE ALL ON FUNCTION private.get_user_stats_for_rpc(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.get_user_stats_for_rpc(UUID) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_user_coupon_history(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, private
AS $$
DECLARE
  v_result JSON;
  v_season_started_at TIMESTAMPTZ := private.get_active_season_started_at();
BEGIN
  IF NOT public.check_profile_access(p_user_id) THEN
    RETURN '[]'::JSON;
  END IF;

  SELECT json_agg(row_to_json(c_row))
    INTO v_result
    FROM (
      SELECT
        c.id,
        c.total_odds,
        c.stake,
        c.payout,
        c.status,
        c.created_at,
        (
          SELECT json_agg(
                   json_build_object(
                     'id', pb.id,
                     'bet_id', pb.bet_id,
                     'selected_option', pb.selected_option,
                     'odds_at_time', pb.odds_at_time,
                     'leg_stake', pb.stake,
                     'leg_payout', pb.payout,
                     'result', pb.result,
                     'bet_title', b.title
                   )
                   ORDER BY pb.created_at
                 )
          FROM public.placed_bets pb
          LEFT JOIN public.bets b ON b.id = pb.bet_id
          WHERE pb.coupon_id = c.id
        ) AS legs
      FROM public.coupons c
      WHERE c.user_id = p_user_id
        AND c.created_at >= v_season_started_at
      ORDER BY c.created_at DESC
      LIMIT GREATEST(COALESCE(p_limit, 50), 1)
      OFFSET GREATEST(COALESCE(p_offset, 0), 0)
    ) c_row;

  RETURN COALESCE(v_result, '[]'::JSON);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_profile(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, private
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_stats JSON;
  v_season_started_at TIMESTAMPTZ := private.get_active_season_started_at();
BEGIN
  IF NOT public.check_profile_access(p_user_id) THEN
    RETURN '{}'::JSON;
  END IF;

  SELECT *
    INTO v_profile
    FROM public.profiles
   WHERE id = p_user_id;

  IF v_profile.id IS NULL THEN
    RETURN '{}'::JSON;
  END IF;

  v_stats := private.get_user_stats_for_rpc(p_user_id);

  RETURN json_build_object(
    'id', v_profile.id,
    'username', v_profile.username,
    'avatar_url', v_profile.avatar_url,
    'current_streak', v_profile.current_streak,
    'longest_streak', v_profile.longest_streak,
    'created_at', v_profile.created_at,
    'season_started_at', v_season_started_at,
    'total_bets', (v_stats->>'total_bets')::BIGINT,
    'won_bets', (v_stats->>'won_bets')::BIGINT,
    'lost_bets', (v_stats->>'lost_bets')::BIGINT,
    'win_rate', (v_stats->>'win_rate')::NUMERIC,
    'total_profit', (v_stats->>'total_profit')::NUMERIC
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_casino_history(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id TEXT,
  game_type TEXT,
  bet_label TEXT,
  stake NUMERIC,
  payout NUMERIC,
  status TEXT,
  round_label TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_season_started_at TIMESTAMPTZ := private.get_active_season_started_at();
BEGIN
  RETURN QUERY
  WITH roulette_history AS (
    SELECT
      ('roulette-' || b.id::TEXT) AS id,
      'Ruletka'::TEXT AS game_type,
      CASE b.bet_type
        WHEN 'straight' THEN 'Numer: ' || b.bet_value
        WHEN 'color' THEN 'Kolor: ' || CASE b.bet_value WHEN 'red' THEN 'czerwone' WHEN 'black' THEN 'czarne' WHEN 'green' THEN 'zielone' ELSE b.bet_value END
        WHEN 'parity' THEN 'Parzystość: ' || CASE b.bet_value WHEN 'even' THEN 'parzyste' WHEN 'odd' THEN 'nieparzyste' ELSE b.bet_value END
        WHEN 'range' THEN 'Zakres: ' || CASE b.bet_value WHEN 'low' THEN '1-18' WHEN 'high' THEN '19-36' ELSE b.bet_value END
        ELSE b.bet_type || ': ' || b.bet_value
      END AS bet_label,
      b.stake,
      b.payout,
      CASE
        WHEN b.is_win = TRUE THEN 'won'
        WHEN b.is_win = FALSE THEN 'lost'
        ELSE 'pending'
      END AS status,
      ('#' || r.round_number::TEXT) AS round_label,
      b.created_at
    FROM public.casino_roulette_bets b
    JOIN public.casino_roulette_rounds r ON r.id = b.round_id
    WHERE b.user_id = p_user_id
      AND b.created_at >= v_season_started_at
  ),
  blackjack_history AS (
    SELECT
      ('blackjack-' || g.id::TEXT) AS id,
      'Blackjack'::TEXT AS game_type,
      'Rozdanie'::TEXT AS bet_label,
      g.stake,
      g.payout,
      CASE WHEN g.status = 'playing' THEN 'pending' ELSE g.status END AS status,
      NULL::TEXT AS round_label,
      g.created_at
    FROM public.casino_blackjack_games g
    WHERE g.user_id = p_user_id
      AND g.created_at >= v_season_started_at
  )
  SELECT *
  FROM (
    SELECT * FROM roulette_history
    UNION ALL
    SELECT * FROM blackjack_history
  ) history
  ORDER BY history.created_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 100), 1)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_casino_rankings()
RETURNS TABLE (
  id UUID,
  username TEXT,
  total_bets BIGINT,
  won_bets BIGINT,
  lost_bets BIGINT,
  win_rate NUMERIC,
  total_profit NUMERIC,
  balance NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_season_started_at TIMESTAMPTZ := private.get_active_season_started_at();
BEGIN
  RETURN QUERY
  WITH casino_units AS (
    SELECT
      b.user_id,
      CASE
        WHEN b.is_win = TRUE THEN 'won'
        WHEN b.is_win = FALSE THEN 'lost'
        ELSE 'pending'
      END AS result,
      ROUND(CASE
        WHEN b.is_win = TRUE THEN b.payout - b.stake
        WHEN b.is_win = FALSE THEN -b.stake
        ELSE 0
      END, 2) AS profit
    FROM public.casino_roulette_bets b
    WHERE b.created_at >= v_season_started_at

    UNION ALL

    SELECT
      g.user_id,
      CASE
        WHEN g.status = 'won' THEN 'won'
        WHEN g.status = 'lost' THEN 'lost'
        WHEN g.status = 'push' THEN 'push'
        ELSE 'pending'
      END AS result,
      ROUND(CASE
        WHEN g.status = 'won' THEN g.payout - g.stake
        WHEN g.status = 'lost' THEN -g.stake
        ELSE 0
      END, 2) AS profit
    FROM public.casino_blackjack_games g
    WHERE g.created_at >= v_season_started_at
  ),
  stats AS (
    SELECT
      user_id,
      COUNT(*) AS total_bets,
      COUNT(*) FILTER (WHERE result = 'won') AS won_bets,
      COUNT(*) FILTER (WHERE result = 'lost') AS lost_bets,
      COUNT(*) FILTER (WHERE result IN ('won', 'lost')) AS resolved_bets,
      ROUND(SUM(profit), 2) AS total_profit
    FROM casino_units
    GROUP BY user_id
  )
  SELECT
    p.id,
    p.username,
    COALESCE(s.total_bets, 0)::BIGINT AS total_bets,
    COALESCE(s.won_bets, 0)::BIGINT AS won_bets,
    COALESCE(s.lost_bets, 0)::BIGINT AS lost_bets,
    CASE
      WHEN COALESCE(s.resolved_bets, 0) > 0 THEN ROUND((COALESCE(s.won_bets, 0)::NUMERIC / s.resolved_bets) * 100, 1)
      ELSE 0
    END AS win_rate,
    COALESCE(s.total_profit, 0) AS total_profit,
    p.balance
  FROM public.profiles p
  JOIN stats s ON s.user_id = p.id
  WHERE COALESCE(s.total_bets, 0) > 0
    AND NOT private.is_agent_profile(p.id)
  ORDER BY COALESCE(s.total_profit, 0) DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_social_feed(
  p_limit INTEGER DEFAULT 30,
  p_offset INTEGER DEFAULT 0,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_result JSON;
  v_season_started_at TIMESTAMPTZ := private.get_active_season_started_at();
BEGIN
  WITH feed_items AS (
    SELECT
      sp.id,
      'post'::TEXT AS item_type,
      sp.user_id,
      pr.username,
      pr.avatar_url,
      sp.content,
      NULL::NUMERIC AS total_odds,
      NULL::NUMERIC AS stake,
      NULL::NUMERIC AS payout,
      NULL::TEXT AS status,
      NULL::JSON AS legs,
      NULL::TEXT AS casino_bet_type,
      NULL::TEXT AS casino_bet_value,
      NULL::NUMERIC AS casino_stake,
      NULL::NUMERIC AS casino_payout,
      NULL::INTEGER AS casino_round_number,
      NULL::INTEGER AS casino_winning_number,
      NULL::TEXT AS casino_winning_color,
      sp.created_at
    FROM public.social_posts sp
    JOIN public.profiles pr ON pr.id = sp.user_id

    UNION ALL

    SELECT
      c.id,
      'coupon'::TEXT AS item_type,
      c.user_id,
      pr.username,
      pr.avatar_url,
      NULL::TEXT AS content,
      c.total_odds,
      c.stake,
      c.payout,
      c.status::TEXT,
      (
        SELECT json_agg(
          json_build_object(
            'id', pb.id,
            'bet_id', pb.bet_id,
            'selected_option', pb.selected_option,
            'odds_at_time', pb.odds_at_time,
            'result', pb.result,
            'bet_title', b.title
          ) ORDER BY pb.created_at
        )
        FROM public.placed_bets pb
        LEFT JOIN public.bets b ON b.id = pb.bet_id
        WHERE pb.coupon_id = c.id
      ) AS legs,
      NULL::TEXT AS casino_bet_type,
      NULL::TEXT AS casino_bet_value,
      NULL::NUMERIC AS casino_stake,
      NULL::NUMERIC AS casino_payout,
      NULL::INTEGER AS casino_round_number,
      NULL::INTEGER AS casino_winning_number,
      NULL::TEXT AS casino_winning_color,
      c.created_at
    FROM public.coupons c
    JOIN public.profiles pr ON pr.id = c.user_id
    WHERE c.created_at >= v_season_started_at

    UNION ALL

    SELECT
      cs.id,
      'casino'::TEXT AS item_type,
      cs.user_id,
      pr.username,
      pr.avatar_url,
      cs.content,
      NULL::NUMERIC AS total_odds,
      cs.casino_stake AS stake,
      cs.casino_payout AS payout,
      'won'::TEXT AS status,
      NULL::JSON AS legs,
      cs.casino_bet_type,
      cs.casino_bet_value,
      cs.casino_stake,
      cs.casino_payout,
      cs.casino_round_number,
      cs.casino_winning_number,
      cs.casino_winning_color,
      cs.created_at
    FROM public.casino_social_shares cs
    JOIN public.profiles pr ON pr.id = cs.user_id
    WHERE cs.created_at >= v_season_started_at
  ),
  ordered_feed AS (
    SELECT * FROM feed_items
    ORDER BY created_at DESC
    LIMIT GREATEST(COALESCE(p_limit, 30), 1)
    OFFSET GREATEST(COALESCE(p_offset, 0), 0)
  ),
  with_counts AS (
    SELECT
      f.*,
      (
        SELECT json_object_agg(r.emoji, r.cnt)
        FROM (
          SELECT sr.emoji::TEXT, COUNT(*) AS cnt
          FROM public.social_reactions sr
          WHERE (f.item_type = 'post' AND sr.post_id = f.id)
             OR (f.item_type = 'coupon' AND sr.coupon_id = f.id)
             OR (f.item_type = 'casino' AND sr.casino_share_id = f.id)
          GROUP BY sr.emoji
        ) r
      ) AS reactions,
      (
        SELECT COUNT(*)
        FROM public.social_comments sc
        WHERE (f.item_type = 'post' AND sc.post_id = f.id)
           OR (f.item_type = 'coupon' AND sc.coupon_id = f.id)
           OR (f.item_type = 'casino' AND sc.casino_share_id = f.id)
      ) AS comment_count,
      (
        SELECT sr.emoji::TEXT
        FROM public.social_reactions sr
        WHERE sr.user_id = p_user_id
          AND ((f.item_type = 'post' AND sr.post_id = f.id)
            OR (f.item_type = 'coupon' AND sr.coupon_id = f.id)
            OR (f.item_type = 'casino' AND sr.casino_share_id = f.id))
        LIMIT 1
      ) AS my_reaction
    FROM ordered_feed f
  )
  SELECT json_agg(row_to_json(wc) ORDER BY wc.created_at DESC)
    INTO v_result
  FROM with_counts wc;

  RETURN COALESCE(v_result, '[]'::JSON);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_social_feed_item(
  p_item_type TEXT,
  p_item_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_result JSON;
  v_season_started_at TIMESTAMPTZ := private.get_active_season_started_at();
BEGIN
  IF p_item_type NOT IN ('post', 'coupon', 'casino') THEN
    RAISE EXCEPTION 'Nieprawidłowy typ elementu social';
  END IF;

  WITH item_data AS (
    SELECT
      sp.id,
      'post'::TEXT AS item_type,
      sp.user_id,
      pr.username,
      pr.avatar_url,
      sp.content,
      NULL::NUMERIC AS total_odds,
      NULL::NUMERIC AS stake,
      NULL::NUMERIC AS payout,
      NULL::TEXT AS status,
      NULL::JSON AS legs,
      NULL::TEXT AS casino_bet_type,
      NULL::TEXT AS casino_bet_value,
      NULL::NUMERIC AS casino_stake,
      NULL::NUMERIC AS casino_payout,
      NULL::INTEGER AS casino_round_number,
      NULL::INTEGER AS casino_winning_number,
      NULL::TEXT AS casino_winning_color,
      sp.created_at
    FROM public.social_posts sp
    JOIN public.profiles pr ON pr.id = sp.user_id
    WHERE p_item_type = 'post'
      AND sp.id = p_item_id

    UNION ALL

    SELECT
      c.id,
      'coupon'::TEXT AS item_type,
      c.user_id,
      pr.username,
      pr.avatar_url,
      NULL::TEXT AS content,
      c.total_odds,
      c.stake,
      c.payout,
      c.status::TEXT,
      (
        SELECT json_agg(
          json_build_object(
            'id', pb.id,
            'bet_id', pb.bet_id,
            'selected_option', pb.selected_option,
            'odds_at_time', pb.odds_at_time,
            'result', pb.result,
            'bet_title', b.title
          ) ORDER BY pb.created_at
        )
        FROM public.placed_bets pb
        LEFT JOIN public.bets b ON b.id = pb.bet_id
        WHERE pb.coupon_id = c.id
      ) AS legs,
      NULL::TEXT AS casino_bet_type,
      NULL::TEXT AS casino_bet_value,
      NULL::NUMERIC AS casino_stake,
      NULL::NUMERIC AS casino_payout,
      NULL::INTEGER AS casino_round_number,
      NULL::INTEGER AS casino_winning_number,
      NULL::TEXT AS casino_winning_color,
      c.created_at
    FROM public.coupons c
    JOIN public.profiles pr ON pr.id = c.user_id
    WHERE p_item_type = 'coupon'
      AND c.id = p_item_id
      AND c.created_at >= v_season_started_at

    UNION ALL

    SELECT
      cs.id,
      'casino'::TEXT AS item_type,
      cs.user_id,
      pr.username,
      pr.avatar_url,
      cs.content,
      NULL::NUMERIC AS total_odds,
      cs.casino_stake AS stake,
      cs.casino_payout AS payout,
      'won'::TEXT AS status,
      NULL::JSON AS legs,
      cs.casino_bet_type,
      cs.casino_bet_value,
      cs.casino_stake,
      cs.casino_payout,
      cs.casino_round_number,
      cs.casino_winning_number,
      cs.casino_winning_color,
      cs.created_at
    FROM public.casino_social_shares cs
    JOIN public.profiles pr ON pr.id = cs.user_id
    WHERE p_item_type = 'casino'
      AND cs.id = p_item_id
      AND cs.created_at >= v_season_started_at
  ),
  with_counts AS (
    SELECT
      i.*,
      (
        SELECT json_object_agg(r.emoji, r.cnt)
        FROM (
          SELECT sr.emoji::TEXT, COUNT(*) AS cnt
          FROM public.social_reactions sr
          WHERE (i.item_type = 'post' AND sr.post_id = i.id)
             OR (i.item_type = 'coupon' AND sr.coupon_id = i.id)
             OR (i.item_type = 'casino' AND sr.casino_share_id = i.id)
          GROUP BY sr.emoji
        ) r
      ) AS reactions,
      (
        SELECT COUNT(*)
        FROM public.social_comments sc
        WHERE (i.item_type = 'post' AND sc.post_id = i.id)
           OR (i.item_type = 'coupon' AND sc.coupon_id = i.id)
           OR (i.item_type = 'casino' AND sc.casino_share_id = i.id)
      ) AS comment_count,
      (
        SELECT sr.emoji::TEXT
        FROM public.social_reactions sr
        WHERE sr.user_id = p_user_id
          AND ((i.item_type = 'post' AND sr.post_id = i.id)
            OR (i.item_type = 'coupon' AND sr.coupon_id = i.id)
            OR (i.item_type = 'casino' AND sr.casino_share_id = i.id))
        LIMIT 1
      ) AS my_reaction
    FROM item_data i
  )
  SELECT row_to_json(wc)
    INTO v_result
  FROM with_counts wc
  LIMIT 1;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION private.get_public_badges_for_rpc(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_result JSON;
  v_season_started_at TIMESTAMPTZ := private.get_active_season_started_at();
BEGIN
  SELECT json_agg(
           json_build_object(
             'id', b.id,
             'user_id', b.user_id,
             'badge_key', b.badge_key,
             'unlocked_at', b.unlocked_at
           )
           ORDER BY b.unlocked_at DESC
         )
    INTO v_result
  FROM public.badges b
  WHERE b.user_id = p_user_id
    AND b.unlocked_at >= v_season_started_at;

  RETURN COALESCE(v_result, '[]'::JSON);
END;
$$;

REVOKE ALL ON FUNCTION private.get_public_badges_for_rpc(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.get_public_badges_for_rpc(UUID) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_public_badges(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, private
AS $$
BEGIN
  IF NOT public.check_profile_access(p_user_id) THEN
    RETURN '[]'::JSON;
  END IF;

  RETURN private.get_public_badges_for_rpc(p_user_id);
END;
$$;
