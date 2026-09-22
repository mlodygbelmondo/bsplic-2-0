-- Keep hidden agent profiles out of public casino history, matching the profiles RLS policy.

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
  IF private.is_agent_profile(p_user_id)
     AND auth.uid() IS DISTINCT FROM p_user_id
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN;
  END IF;

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
