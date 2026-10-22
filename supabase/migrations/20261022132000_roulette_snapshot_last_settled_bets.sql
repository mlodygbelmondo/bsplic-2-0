-- The roulette result strip and "Powtórz" never showed: the table snapshot
-- only returned the caller's bets in open rounds, so a settled bet never
-- reached the client. The snapshot now also returns the caller's bets in the
-- newest settled round as `last_settled_bets`. They stay out of
-- `active_bets`, which clients use to announce wins, so entering the table
-- never replays an old win. The function stays read-only (it is polled).

DROP FUNCTION IF EXISTS public.get_roulette_table_snapshot(TEXT, INTEGER, INTEGER);

CREATE FUNCTION public.get_roulette_table_snapshot(
  p_table_key TEXT DEFAULT 'main',
  p_recent_spins_limit INTEGER DEFAULT 10,
  p_recent_wins_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  current_round JSONB,
  recent_spins JSONB,
  recent_wins JSONB,
  active_bets JSONB,
  round_participants JSONB,
  last_settled_bets JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Wymagane uwierzytelnienie';
  END IF;

  RETURN QUERY
  WITH open_round_rows AS MATERIALIZED (
    SELECT
      r.id,
      r.table_key,
      r.round_number,
      r.phase,
      r.betting_opens_at,
      r.betting_closes_at,
      r.spin_started_at,
      r.settled_at,
      r.winning_number,
      r.winning_color,
      r.created_at
    FROM public.casino_roulette_rounds AS r
    WHERE r.table_key = p_table_key
      AND r.phase IN ('waiting', 'spinning')
    ORDER BY r.round_number ASC
  ),
  current_round_row AS MATERIALIZED (
    SELECT *
    FROM open_round_rows
    ORDER BY round_number ASC
    LIMIT 1
  ),
  recent_spin_rows AS (
    SELECT
      r.id,
      r.table_key,
      r.round_number,
      r.phase,
      r.betting_opens_at,
      r.betting_closes_at,
      r.spin_started_at,
      r.settled_at,
      r.winning_number,
      r.winning_color,
      r.created_at
    FROM public.casino_roulette_rounds AS r
    WHERE r.table_key = p_table_key
      AND r.phase = 'settled'
    ORDER BY r.round_number DESC
    LIMIT LEAST(GREATEST(COALESCE(p_recent_spins_limit, 10), 1), 50)
  ),
  recent_win_rows AS (
    SELECT
      b.id,
      b.round_id,
      b.user_id,
      p.username,
      p.avatar_url,
      b.bet_type,
      b.bet_value,
      b.stake,
      b.payout,
      b.is_win,
      b.created_at,
      b.settled_at,
      r.round_number
    FROM public.casino_roulette_bets AS b
    JOIN public.casino_roulette_rounds AS r ON r.id = b.round_id
    JOIN public.profiles AS p ON p.id = b.user_id
    WHERE r.table_key = p_table_key
      AND b.is_win = TRUE
      AND b.payout > 0
    ORDER BY COALESCE(b.settled_at, b.created_at) DESC
    LIMIT LEAST(GREATEST(COALESCE(p_recent_wins_limit, 20), 1), 100)
  ),
  active_bet_rows AS (
    SELECT
      b.id,
      b.round_id,
      b.user_id,
      b.bet_type,
      b.bet_value,
      b.stake,
      b.payout,
      b.is_win,
      b.created_at,
      b.settled_at
    FROM public.casino_roulette_bets AS b
    WHERE b.round_id IN (SELECT o.id FROM open_round_rows AS o)
      AND b.user_id = auth.uid()
    ORDER BY b.created_at DESC
  ),
  -- The caller's bets in the newest settled round, for the result strip and
  -- "Powtórz". Kept apart from active_bets, which announce wins.
  last_settled_bet_rows AS (
    SELECT
      b.id,
      b.round_id,
      b.user_id,
      b.bet_type,
      b.bet_value,
      b.stake,
      b.payout,
      b.is_win,
      b.created_at,
      b.settled_at
    FROM public.casino_roulette_bets AS b
    WHERE b.round_id = (
        SELECT s.id
        FROM recent_spin_rows AS s
        ORDER BY s.round_number DESC
        LIMIT 1
      )
      AND b.user_id = auth.uid()
    ORDER BY b.created_at DESC
  ),
  participant_rows AS (
    SELECT
      b.user_id,
      p.username,
      p.avatar_url,
      SUM(b.stake) AS total_stake,
      COUNT(*)::INTEGER AS bet_count,
      jsonb_agg(
        jsonb_build_object(
          'bet_type', b.bet_type,
          'bet_value', b.bet_value,
          'stake', b.stake
        )
        ORDER BY b.created_at DESC
      ) AS bets
    FROM public.casino_roulette_bets AS b
    JOIN public.profiles AS p ON p.id = b.user_id
    WHERE b.round_id IN (SELECT o.id FROM open_round_rows AS o)
    GROUP BY b.user_id, p.username, p.avatar_url
    ORDER BY SUM(b.stake) DESC, p.username ASC
    LIMIT 20
  )
  SELECT
    COALESCE((SELECT to_jsonb(current_round_row) FROM current_round_row), 'null'::jsonb),
    COALESCE((SELECT jsonb_agg(to_jsonb(recent_spin_rows) ORDER BY recent_spin_rows.round_number DESC) FROM recent_spin_rows), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(to_jsonb(recent_win_rows) ORDER BY COALESCE(recent_win_rows.settled_at, recent_win_rows.created_at) DESC) FROM recent_win_rows), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(to_jsonb(active_bet_rows) ORDER BY active_bet_rows.created_at DESC) FROM active_bet_rows), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(to_jsonb(participant_rows) ORDER BY participant_rows.total_stake DESC, participant_rows.username ASC) FROM participant_rows), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(to_jsonb(last_settled_bet_rows) ORDER BY last_settled_bet_rows.created_at DESC) FROM last_settled_bet_rows), '[]'::jsonb);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_roulette_table_snapshot(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_roulette_table_snapshot(TEXT, INTEGER, INTEGER) TO authenticated;

NOTIFY pgrst, 'reload schema';
