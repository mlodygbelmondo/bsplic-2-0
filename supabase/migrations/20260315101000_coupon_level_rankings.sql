-- Migration: Count AKO coupons as single ranking units
-- Created: 2026-03-15

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
    -- AKO coupons are counted as one ranking unit per coupon.
    -- Result is derived from coupon legs to stay correct even if coupon.status is stale.
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
    GROUP BY c.id, c.user_id
  ),
  ranking_units AS (
    SELECT
      cu.user_id,
      cu.unit_result
    FROM coupon_units cu

    UNION ALL

    -- Singles are still counted per event.
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
  profit_stats AS (
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
    GROUP BY pb.user_id
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
