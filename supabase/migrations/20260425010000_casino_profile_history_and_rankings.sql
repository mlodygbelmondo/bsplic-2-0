-- Casino profile history and rankings.

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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
SET search_path = public
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
  ORDER BY COALESCE(s.total_profit, 0) DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_casino_history(UUID, INTEGER, INTEGER) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_casino_rankings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_casino_history(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_casino_rankings() TO authenticated;
