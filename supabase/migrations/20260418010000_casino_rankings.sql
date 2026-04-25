-- Migration: Add casino rankings
-- Created: 2026-04-18

CREATE OR REPLACE FUNCTION public.get_casino_rankings()
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
  WITH casino_units AS (
    -- Multiplayer Roulette
    SELECT
      cb.user_id,
      CASE
        WHEN cb.is_win = true THEN 'won'
        WHEN cb.is_win = false THEN 'lost'
        ELSE 'pending'
      END AS unit_result,
      cb.stake,
      cb.payout
    FROM public.casino_roulette_bets cb
    WHERE cb.settled_at IS NOT NULL

    UNION ALL

    -- Single Player Casino
    SELECT
      cr.user_id,
      CASE
        WHEN cr.payout > 0 THEN 'won'
        ELSE 'lost'
      END AS unit_result,
      cr.stake,
      cr.payout
    FROM public.casino_rounds cr
  ),
  ranking_stats AS (
    SELECT
      cu.user_id,
      COUNT(*)                                             AS total_bets,
      COUNT(*) FILTER (WHERE cu.unit_result = 'won')       AS won_bets,
      COUNT(*) FILTER (WHERE cu.unit_result = 'lost')      AS lost_bets,
      COUNT(*) FILTER (WHERE cu.unit_result IN ('won', 'lost')) AS resolved_bets
    FROM casino_units cu
    GROUP BY cu.user_id
  ),
  profit_stats AS (
    SELECT
      cu.user_id,
      ROUND(
        SUM(
          CASE
            WHEN cu.unit_result = 'won' THEN cu.payout - cu.stake
            WHEN cu.unit_result = 'lost' THEN -cu.stake
            ELSE 0
          END
        ),
        2
      ) AS total_profit
    FROM casino_units cu
    GROUP BY cu.user_id
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
