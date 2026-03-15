-- Migration: Fix coupon-aware profit in ranking RPCs
-- Created: 2026-03-15

-- ============================================================
-- 1. get_user_rankings()
--    Profit must be calculated per coupon unit for AKO,
--    not per leg. A lost AKO should always contribute -stake.
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
    GROUP BY c.id, c.user_id
  ),
  ranking_units AS (
    SELECT
      cu.user_id,
      cu.unit_result
    FROM coupon_units cu

    UNION ALL

    -- Singles are counted per event.
    -- Includes legacy rows without coupon_id and coupons with total_odds <= 1.
    SELECT
      pb.user_id,
      pb.result AS unit_result
    FROM public.placed_bets pb
    LEFT JOIN public.coupons c ON c.id = pb.coupon_id
    WHERE pb.coupon_id IS NULL OR COALESCE(c.total_odds, 1) <= 1
  ),
  ranking_stats AS (
    SELECT
      ru.user_id,
      COUNT(*)                                             AS total_bets,
      COUNT(*) FILTER (WHERE ru.unit_result = 'won')       AS won_bets,
      COUNT(*) FILTER (WHERE ru.unit_result = 'lost')      AS lost_bets,
      COUNT(*) FILTER (WHERE ru.unit_result IN ('won', 'lost')) AS resolved_bets
    FROM ranking_units ru
    GROUP BY ru.user_id
  ),
  coupon_profit AS (
    SELECT
      cu.user_id,
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
    GROUP BY cu.user_id
  ),
  single_profit AS (
    SELECT
      pb.user_id,
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
    WHERE pb.coupon_id IS NULL OR COALESCE(c.total_odds, 1) <= 1
    GROUP BY pb.user_id
  ),
  profit_stats AS (
    SELECT
      users.user_id,
      ROUND(COALESCE(cp.total_profit, 0) + COALESCE(sp.total_profit, 0), 2) AS total_profit
    FROM (
      SELECT user_id FROM coupon_profit
      UNION
      SELECT user_id FROM single_profit
    ) users
    LEFT JOIN coupon_profit cp ON cp.user_id = users.user_id
    LEFT JOIN single_profit sp ON sp.user_id = users.user_id
  )
  SELECT
    p.id,
    p.username,
    COALESCE(rs.total_bets, 0)::BIGINT AS total_bets,
    COALESCE(rs.won_bets, 0)::BIGINT AS won_bets,
    COALESCE(rs.lost_bets, 0)::BIGINT AS lost_bets,
    CASE
      WHEN COALESCE(rs.resolved_bets, 0) > 0
      THEN ROUND((COALESCE(rs.won_bets, 0)::NUMERIC / rs.resolved_bets) * 100, 1)
      ELSE 0
    END AS win_rate,
    COALESCE(ps.total_profit, 0) AS total_profit,
    p.balance
  FROM public.profiles p
  LEFT JOIN ranking_stats rs ON rs.user_id = p.id
  LEFT JOIN profit_stats ps ON ps.user_id = p.id
  WHERE COALESCE(rs.total_bets, 0) > 0
  ORDER BY COALESCE(ps.total_profit, 0) DESC;
END;
$$;

-- ============================================================
-- 2. get_public_profile(p_user_id)
--    Keep public profile stats consistent with get_user_rankings().
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
  SELECT row_to_json(t) INTO v_result
  FROM (
    SELECT
      p.id,
      p.username,
      p.current_streak,
      p.longest_streak,
      p.created_at,
      COALESCE(rs.total_bets, 0) AS total_bets,
      COALESCE(rs.won_bets, 0) AS won_bets,
      COALESCE(rs.lost_bets, 0) AS lost_bets,
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
