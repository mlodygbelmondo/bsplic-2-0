-- Performance indexes for sportsbook, profile, social feed, and admin access paths.
-- Validate with EXPLAIN ANALYZE in the Supabase SQL editor after applying.

CREATE INDEX IF NOT EXISTS idx_categories_sort_order_id
  ON public.categories (sort_order, id);

CREATE INDEX IF NOT EXISTS idx_bets_active_created
  ON public.bets (created_at DESC)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_bets_active_category_created
  ON public.bets (category_id, created_at DESC)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_bets_created_desc
  ON public.bets (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bet_proposals_status_created
  ON public.bet_proposals (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coupons_user_created
  ON public.coupons (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coupons_created_desc
  ON public.coupons (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_placed_bets_coupon_created
  ON public.placed_bets (coupon_id, created_at)
  WHERE coupon_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_placed_bets_user_created
  ON public.placed_bets (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_placed_bets_bet_created
  ON public.placed_bets (bet_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_badges_user_unlocked
  ON public.badges (user_id, unlocked_at DESC);

CREATE OR REPLACE FUNCTION private.sportsbook_ranking_units(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  user_id     UUID,
  unit_result TEXT,
  profit      NUMERIC
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
        WHEN COUNT(*) > 0
          AND COUNT(*) FILTER (WHERE pb.result IN ('won', 'lost')) = COUNT(*)
          THEN 'won'
        ELSE 'pending'
      END AS unit_result,
      ROUND(
        CASE
          WHEN COUNT(*) FILTER (WHERE pb.result = 'lost') > 0 THEN -c.stake
          WHEN COUNT(*) > 0
            AND COUNT(*) FILTER (WHERE pb.result IN ('won', 'lost')) = COUNT(*)
            THEN COALESCE(NULLIF(c.payout, 0), ROUND(c.stake * c.total_odds, 2)) - c.stake
          ELSE 0
        END,
        2
      ) AS profit
    FROM public.coupons AS c
    JOIN public.placed_bets AS pb ON pb.coupon_id = c.id
    WHERE c.total_odds > 1
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
    AND (p_user_id IS NULL OR pb.user_id = p_user_id);
$$;

REVOKE ALL ON FUNCTION private.sportsbook_ranking_units(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.sportsbook_ranking_units(UUID) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.get_sportsbook_stats(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  user_id      UUID,
  total_bets   BIGINT,
  won_bets     BIGINT,
  lost_bets    BIGINT,
  resolved_bets BIGINT,
  win_rate     NUMERIC,
  total_profit NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT
    ru.user_id,
    COUNT(*)::BIGINT AS total_bets,
    COUNT(*) FILTER (WHERE ru.unit_result = 'won')::BIGINT AS won_bets,
    COUNT(*) FILTER (WHERE ru.unit_result = 'lost')::BIGINT AS lost_bets,
    COUNT(*) FILTER (WHERE ru.unit_result IN ('won', 'lost'))::BIGINT AS resolved_bets,
    CASE
      WHEN COUNT(*) FILTER (WHERE ru.unit_result IN ('won', 'lost')) > 0
        THEN ROUND(
          (
            COUNT(*) FILTER (WHERE ru.unit_result = 'won')::NUMERIC
            / COUNT(*) FILTER (WHERE ru.unit_result IN ('won', 'lost'))
          ) * 100,
          1
        )
      ELSE 0
    END AS win_rate,
    ROUND(COALESCE(SUM(ru.profit), 0), 2) AS total_profit
  FROM private.sportsbook_ranking_units(p_user_id) AS ru
  GROUP BY ru.user_id;
$$;

REVOKE ALL ON FUNCTION private.get_sportsbook_stats(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.get_sportsbook_stats(UUID) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.get_user_stats_for_rpc(p_user_id UUID)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT json_build_object(
    'total_bets', COALESCE(s.total_bets, 0),
    'won_bets', COALESCE(s.won_bets, 0),
    'lost_bets', COALESCE(s.lost_bets, 0),
    'win_rate', COALESCE(s.win_rate, 0),
    'total_profit', COALESCE(s.total_profit, 0)
  )
  FROM (
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

CREATE OR REPLACE FUNCTION public.get_user_stats(p_user_id UUID)
RETURNS TABLE (
  total_bets   BIGINT,
  won_bets     BIGINT,
  lost_bets    BIGINT,
  win_rate     NUMERIC,
  total_profit NUMERIC
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, private
AS $$
  SELECT
    (s.stats->>'total_bets')::BIGINT AS total_bets,
    (s.stats->>'won_bets')::BIGINT AS won_bets,
    (s.stats->>'lost_bets')::BIGINT AS lost_bets,
    (s.stats->>'win_rate')::NUMERIC AS win_rate,
    (s.stats->>'total_profit')::NUMERIC AS total_profit
  FROM (
    SELECT private.get_user_stats_for_rpc(p_user_id) AS stats
  ) AS s
  WHERE public.check_profile_access(p_user_id);
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_stats(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_stats(UUID) TO anon, authenticated;

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
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, private
AS $$
  SELECT
    p.id,
    p.username,
    s.total_bets,
    s.won_bets,
    s.lost_bets,
    s.win_rate,
    s.total_profit,
    p.balance
  FROM public.profiles AS p
  JOIN private.get_sportsbook_stats(NULL::UUID) AS s ON s.user_id = p.id
  WHERE s.total_bets > 0
    AND NOT private.is_agent_profile(p.id)
  ORDER BY s.total_profit DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_rankings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_rankings() TO anon, authenticated;
