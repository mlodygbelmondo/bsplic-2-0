-- Hide token-backed agent profiles from public player surfaces.

CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

-- If an earlier local copy created this as a non-unique index, replace it.
DROP INDEX IF EXISTS public.idx_bet_proposals_agent_duplicate_key_pending;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bet_proposals_agent_duplicate_key_pending
  ON public.bet_proposals (agent_duplicate_key)
  WHERE status = 'pending' AND agent_duplicate_key IS NOT NULL;

CREATE OR REPLACE FUNCTION private.is_agent_profile(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = private
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM private.agent_api_tokens
    WHERE agent_user_id = p_user_id
  );
$$;

GRANT EXECUTE ON FUNCTION private.is_agent_profile(UUID) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Profiles are viewable by everyone"
ON public.profiles
FOR SELECT
USING (
  NOT private.is_agent_profile(id)
  OR auth.uid() = id
  OR public.has_role(auth.uid(), 'admin')
);

CREATE OR REPLACE FUNCTION public.check_profile_access(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_user_id
  );
$$;

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
SECURITY INVOKER
SET search_path = public, private
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
  CROSS JOIN LATERAL (
    SELECT private.get_user_stats_for_rpc(p.id) AS stats
  ) AS s
  WHERE (s.stats->>'total_bets')::BIGINT > 0
    AND NOT private.is_agent_profile(p.id)
  ORDER BY (s.stats->>'total_profit')::NUMERIC DESC;
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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
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
$$;
