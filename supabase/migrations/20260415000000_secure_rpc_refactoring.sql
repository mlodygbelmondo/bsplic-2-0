-- Migration: Refactor RPCs to respect RLS and follow security best practices.
-- This migration hardens functions that were previously bypassing RLS without explicit checks.

-- ============================================================
-- 0. Gatekeeper function (SECURITY INVOKER)
--    Uses the caller's context to check if a profile is visible.
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_profile_access(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_user_id
  );
$$;

-- ============================================================
-- 1. Internal helper for stats (SECURITY DEFINER)
--    Returns only aggregated, non-sensitive data.
-- ============================================================
CREATE OR REPLACE FUNCTION public._get_user_stats_internal(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stats JSON;
BEGIN
  WITH coupon_units AS (
    SELECT
      c.id AS coupon_id,
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
      COUNT(*)                                              AS total_bets,
      COUNT(*) FILTER (WHERE unit_result = 'won')           AS won_bets,
      COUNT(*) FILTER (WHERE unit_result = 'lost')          AS lost_bets,
      COUNT(*) FILTER (WHERE unit_result IN ('won', 'lost')) AS resolved_bets
    FROM ranking_units
  ),
  coupon_profit AS (
    SELECT
      ROUND(
        SUM(
          CASE
            WHEN cu.unit_result = 'won'
              THEN COALESCE(NULLIF(c.payout, 0), ROUND(c.stake * c.total_odds, 2)) - c.stake
            WHEN cu.unit_result = 'lost' THEN -c.stake
            ELSE 0
          END
        ),
        2
      ) AS total_profit
    FROM coupon_units cu
    JOIN public.coupons c ON c.id = cu.coupon_id
  ),
  single_profit AS (
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
    LEFT JOIN public.coupons c ON c.id = pb.coupon_id
    WHERE pb.user_id = p_user_id
      AND (pb.coupon_id IS NULL OR COALESCE(c.total_odds, 1) <= 1)
  ),
  profit_stats AS (
    SELECT ROUND(
      COALESCE((SELECT total_profit FROM coupon_profit), 0)
      + COALESCE((SELECT total_profit FROM single_profit), 0),
      2
    ) AS total_profit
  )
  SELECT json_build_object(
    'total_bets', COALESCE(rs.total_bets, 0),
    'won_bets', COALESCE(rs.won_bets, 0),
    'lost_bets', COALESCE(rs.lost_bets, 0),
    'win_rate', CASE
      WHEN COALESCE(rs.resolved_bets, 0) > 0
      THEN ROUND((COALESCE(rs.won_bets, 0)::NUMERIC / rs.resolved_bets) * 100, 1)
      ELSE 0
    END,
    'total_profit', COALESCE(ps.total_profit, 0)
  ) INTO v_stats
  FROM ranking_stats rs
  CROSS JOIN profit_stats ps;

  RETURN v_stats;
END;
$$;

-- Restrict direct execution to prevent RPC abuse
REVOKE EXECUTE ON FUNCTION public._get_user_stats_internal(UUID) FROM PUBLIC;

-- ============================================================
-- 2. get_public_profile (SECURITY DEFINER + gatekeeper)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_public_profile(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
  v_stats   JSON;
BEGIN
  -- Gatekeeper check: Uses SECURITY INVOKER logic to check visibility
  IF NOT public.check_profile_access(p_user_id) THEN
    RETURN '{}'::JSON;
  END IF;

  SELECT id, username, avatar_url, current_streak, longest_streak, created_at
  INTO v_profile
  FROM public.profiles
  WHERE id = p_user_id;

  v_stats := public._get_user_stats_internal(p_user_id);

  RETURN json_build_object(
    'id', v_profile.id,
    'username', v_profile.username,
    'avatar_url', v_profile.avatar_url,
    'current_streak', v_profile.current_streak,
    'longest_streak', v_profile.longest_streak,
    'created_at', v_profile.created_at,
    'total_bets', (v_stats->>'total_bets')::BIGINT,
    'won_bets', (v_stats->>'won_bets')::BIGINT,
    'lost_bets', (v_stats->>'lost_bets')::BIGINT,
    'win_rate', (v_stats->>'win_rate')::NUMERIC,
    'total_profit', (v_stats->>'total_profit')::NUMERIC
  );
END;
$$;

-- ============================================================
-- 3. get_user_coupon_history (SECURITY DEFINER + gatekeeper)
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
  -- Gatekeeper check
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
      ORDER BY c.created_at DESC
      LIMIT p_limit
      OFFSET p_offset
    ) c_row;

  RETURN COALESCE(v_result, '[]'::JSON);
END;
$$;

-- ============================================================
-- 4. get_social_coupon_feed (SECURITY DEFINER + gatekeeper filter)
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
          SELECT json_agg(
                   json_build_object(
                     'id', pb.id,
                     'bet_id', pb.bet_id,
                     'selected_option', pb.selected_option,
                     'odds_at_time', pb.odds_at_time,
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
      -- Join with gatekeeper: ensure we only show coupons from visible profiles
      JOIN public.profiles p ON p.id = c.user_id
      WHERE public.check_profile_access(c.user_id)
      ORDER BY c.created_at DESC
      LIMIT p_limit
      OFFSET p_offset
    ) c_row;

  RETURN COALESCE(v_result, '[]'::JSON);
END;
$$;

-- ============================================================
-- 5. get_user_rankings (SECURITY DEFINER + gatekeeper filter)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_rankings()
RETURNS TABLE (
  id           UUID,
  username     TEXT,
  total_bets   BIGINT,
  won_bets     BIGINT,
  lost_bets    BIGINT,
  win_rate     NUMERIC,
  total_profit NUMERIC,
  balance      NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.username,
    (s.stats->>'total_bets')::BIGINT AS total_bets,
    (s.stats->>'won_bets')::BIGINT AS won_bets,
    (s.stats->>'lost_bets')::BIGINT AS lost_bets,
    (s.stats->>'win_rate')::NUMERIC AS win_rate,
    (s.stats->>'total_profit')::NUMERIC AS total_profit,
    p.balance
  FROM public.profiles p
  CROSS JOIN LATERAL public._get_user_stats_internal(p.id) AS s(stats)
  WHERE public.check_profile_access(p.id)
    AND (s.stats->>'total_bets')::BIGINT > 0
  ORDER BY (s.stats->>'total_profit')::NUMERIC DESC;
END;
$$;
