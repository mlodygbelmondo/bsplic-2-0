-- Migration: Social feed RPCs, coupon history, and payout fix
-- Created: 2026-03-15

-- ============================================================
-- 1. Fix resolve_coupon_status() to set payout on won/lost
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
  v_stake     NUMERIC;
  v_odds      NUMERIC;
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
    SELECT stake, total_odds
      INTO v_stake, v_odds
      FROM public.coupons
     WHERE id = NEW.coupon_id;

    IF v_lost > 0 THEN
      UPDATE public.coupons
         SET status = 'lost',
             payout = 0
       WHERE id = NEW.coupon_id;
    ELSE
      UPDATE public.coupons
         SET status = 'won',
             payout = ROUND(v_stake * v_odds, 2)
       WHERE id = NEW.coupon_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. Backfill payout for existing resolved coupons
-- ============================================================
UPDATE public.coupons
   SET payout = ROUND(stake * total_odds, 2)
 WHERE status = 'won'
   AND (payout IS NULL OR payout = 0);

UPDATE public.coupons
   SET payout = 0
 WHERE status = 'lost'
   AND payout IS NULL;

-- ============================================================
-- 3. get_user_coupon_history(p_user_id, p_limit, p_offset)
--    Returns coupons with their legs for a given user.
--    SECURITY DEFINER to allow public profile viewing.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_coupon_history(
  p_user_id UUID,
  p_limit   INTEGER DEFAULT 50,
  p_offset  INTEGER DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
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
          SELECT json_agg(row_to_json(leg) ORDER BY leg.created_at)
            FROM (
              SELECT
                pb.id,
                pb.selected_option,
                pb.odds_at_time,
                pb.stake   AS leg_stake,
                pb.payout  AS leg_payout,
                pb.result,
                b.title    AS bet_title
              FROM public.placed_bets pb
              LEFT JOIN public.bets b ON b.id = pb.bet_id
              WHERE pb.coupon_id = c.id
            ) leg
        ) AS legs
      FROM public.coupons c
      WHERE c.user_id = p_user_id
      ORDER BY c.created_at DESC
      LIMIT p_limit
      OFFSET p_offset
    ) c_row;

  RETURN COALESCE(v_result, '[]'::JSON);
END;
$$;

-- ============================================================
-- 4. get_social_coupon_feed(p_limit, p_offset)
--    Global feed of all users' coupons with username.
--    SECURITY DEFINER to bypass RLS.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_social_coupon_feed(
  p_limit   INTEGER DEFAULT 30,
  p_offset  INTEGER DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(row_to_json(c_row))
    INTO v_result
    FROM (
      SELECT
        c.id,
        c.user_id,
        p.username,
        c.total_odds,
        c.stake,
        c.payout,
        c.status,
        c.created_at,
        (
          SELECT json_agg(row_to_json(leg) ORDER BY leg.created_at)
            FROM (
              SELECT
                pb.id,
                pb.selected_option,
                pb.odds_at_time,
                pb.result,
                b.title    AS bet_title
              FROM public.placed_bets pb
              LEFT JOIN public.bets b ON b.id = pb.bet_id
              WHERE pb.coupon_id = c.id
            ) leg
        ) AS legs
      FROM public.coupons c
      JOIN public.profiles p ON p.id = c.user_id
      ORDER BY c.created_at DESC
      LIMIT p_limit
      OFFSET p_offset
    ) c_row;

  RETURN COALESCE(v_result, '[]'::JSON);
END;
$$;

-- ============================================================
-- 5. get_public_profile(p_user_id)
--    Returns profile info + ranking stats for a single user.
--    SECURITY DEFINER to bypass RLS on profiles.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_public_profile(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  WITH coupon_units AS (
    SELECT
      c.user_id,
      CASE
        WHEN COUNT(*) FILTER (WHERE pb.result = 'lost') > 0 THEN 'lost'
        WHEN COUNT(*) > 0
          AND COUNT(*) FILTER (WHERE pb.result IN ('won', 'lost')) = COUNT(*)
          THEN 'won'
        ELSE 'pending'
      END AS unit_result
    FROM public.coupons c
    JOIN public.placed_bets pb ON pb.coupon_id = c.id
    WHERE c.total_odds > 1
      AND c.user_id = p_user_id
    GROUP BY c.id, c.user_id
  ),
  ranking_units AS (
    SELECT cu.unit_result FROM coupon_units cu
    UNION ALL
    SELECT pb.result AS unit_result
    FROM public.placed_bets pb
    LEFT JOIN public.coupons c ON c.id = pb.coupon_id
    WHERE pb.user_id = p_user_id
      AND (pb.coupon_id IS NULL OR COALESCE(c.total_odds, 1) <= 1)
  ),
  ranking_stats AS (
    SELECT
      COUNT(*)                                             AS total_bets,
      COUNT(*) FILTER (WHERE unit_result = 'won')          AS won_bets,
      COUNT(*) FILTER (WHERE unit_result = 'lost')         AS lost_bets,
      COUNT(*) FILTER (WHERE unit_result IN ('won','lost')) AS resolved_bets
    FROM ranking_units
  ),
  profit_stats AS (
    SELECT
      ROUND(
        SUM(
          CASE
            WHEN pb.result = 'won' THEN COALESCE(pb.payout, 0) - pb.stake
            WHEN pb.result = 'lost' THEN -pb.stake
            ELSE 0
          END
        ),
        2
      ) AS total_profit
    FROM public.placed_bets pb
    WHERE pb.user_id = p_user_id
  )
  SELECT row_to_json(t) INTO v_result
  FROM (
    SELECT
      p.id,
      p.username,
      p.current_streak,
      p.longest_streak,
      p.created_at,
      COALESCE(rs.total_bets, 0)  AS total_bets,
      COALESCE(rs.won_bets, 0)    AS won_bets,
      COALESCE(rs.lost_bets, 0)   AS lost_bets,
      CASE
        WHEN COALESCE(rs.resolved_bets, 0) > 0
        THEN ROUND((COALESCE(rs.won_bets, 0)::NUMERIC / rs.resolved_bets) * 100, 1)
        ELSE 0
      END AS win_rate,
      COALESCE(ps.total_profit, 0) AS total_profit
    FROM public.profiles p
    CROSS JOIN ranking_stats rs
    CROSS JOIN profit_stats ps
    WHERE p.id = p_user_id
  ) t;

  RETURN v_result;
END;
$$;
