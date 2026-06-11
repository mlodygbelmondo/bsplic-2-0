-- Make shared roulette rounds feel instant again.
--
-- 1. Clients may call advance_roulette_round_if_due when a phase is overdue,
--    so transitions happen the moment the countdown ends. pg_cron stays as a
--    backup for tables nobody is watching.
-- 2. The "current" round is the EARLIEST unsettled round (a spinning round
--    keeps priority over a queued waiting round).
-- 3. Betting while the wheel spins queues the bet into the next round whose
--    betting window closes 15 seconds after the spin settles, instead of
--    raising an error.

CREATE OR REPLACE FUNCTION public.get_current_roulette_round(p_table_key TEXT DEFAULT 'main')
RETURNS TABLE (
  id UUID,
  table_key TEXT,
  round_number BIGINT,
  phase TEXT,
  betting_opens_at TIMESTAMPTZ,
  betting_closes_at TIMESTAMPTZ,
  spin_started_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ,
  winning_number INTEGER,
  winning_color TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
  WHERE auth.uid() IS NOT NULL
    AND r.table_key = p_table_key
    AND r.phase IN ('waiting', 'spinning')
  ORDER BY r.round_number ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_roulette_table_snapshot(
  p_table_key TEXT DEFAULT 'main',
  p_recent_spins_limit INTEGER DEFAULT 10,
  p_recent_wins_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  current_round JSONB,
  recent_spins JSONB,
  recent_wins JSONB,
  active_bets JSONB,
  round_participants JSONB
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
    COALESCE((SELECT jsonb_agg(to_jsonb(participant_rows) ORDER BY participant_rows.total_stake DESC, participant_rows.username ASC) FROM participant_rows), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.advance_roulette_round_if_due(p_table_key TEXT DEFAULT 'main')
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_round public.casino_roulette_rounds%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_winning_number INTEGER;
  v_winning_color TEXT;
  v_reveal_duration INTERVAL := INTERVAL '6 seconds';
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('roulette:' || COALESCE(p_table_key, 'main'))) THEN
    RETURN;
  END IF;

  -- The earliest unsettled round is the one being played; a queued waiting
  -- round must not advance before the spinning round in front of it settles.
  SELECT * INTO v_round
  FROM public.casino_roulette_rounds AS r
  WHERE r.table_key = p_table_key
    AND r.phase IN ('waiting', 'spinning')
  ORDER BY r.round_number ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_round.phase = 'waiting' AND v_now >= v_round.betting_closes_at THEN
    v_winning_number := FLOOR(random() * 37)::INTEGER;
    v_winning_color := public.get_roulette_color(v_winning_number);

    UPDATE public.casino_roulette_rounds AS r
    SET phase = 'spinning',
        spin_started_at = v_now,
        winning_number = v_winning_number,
        winning_color = v_winning_color
    WHERE r.id = v_round.id;

    RETURN;
  END IF;

  IF v_round.phase = 'spinning'
     AND v_round.spin_started_at IS NOT NULL
     AND v_now >= v_round.spin_started_at + v_reveal_duration THEN
    UPDATE public.casino_roulette_bets AS b
    SET
      is_win = CASE
        WHEN b.bet_type = 'straight' THEN v_round.winning_number = b.bet_value::INTEGER
        WHEN b.bet_type = 'color' THEN v_round.winning_color = b.bet_value
        WHEN b.bet_type = 'parity' THEN v_round.winning_number <> 0 AND (
          (b.bet_value = 'even' AND MOD(v_round.winning_number, 2) = 0) OR
          (b.bet_value = 'odd' AND MOD(v_round.winning_number, 2) = 1)
        )
        WHEN b.bet_type = 'range' THEN (
          (b.bet_value = 'low' AND v_round.winning_number BETWEEN 1 AND 18) OR
          (b.bet_value = 'high' AND v_round.winning_number BETWEEN 19 AND 36)
        )
        ELSE FALSE
      END,
      payout = CASE
        WHEN b.bet_type = 'straight' AND v_round.winning_number = b.bet_value::INTEGER THEN ROUND(b.stake * 36, 2)
        WHEN b.bet_type = 'color' AND v_round.winning_color = b.bet_value THEN ROUND(b.stake * 2, 2)
        WHEN b.bet_type = 'parity' AND v_round.winning_number <> 0 AND (
          (b.bet_value = 'even' AND MOD(v_round.winning_number, 2) = 0) OR
          (b.bet_value = 'odd' AND MOD(v_round.winning_number, 2) = 1)
        ) THEN ROUND(b.stake * 2, 2)
        WHEN b.bet_type = 'range' AND (
          (b.bet_value = 'low' AND v_round.winning_number BETWEEN 1 AND 18) OR
          (b.bet_value = 'high' AND v_round.winning_number BETWEEN 19 AND 36)
        ) THEN ROUND(b.stake * 2, 2)
        ELSE 0
      END,
      settled_at = v_now
    WHERE b.round_id = v_round.id;

    UPDATE public.profiles AS p
    SET balance = ROUND(p.balance + payouts.total_payout, 2)
    FROM (
      SELECT b.user_id, COALESCE(SUM(b.payout), 0) AS total_payout
      FROM public.casino_roulette_bets AS b
      WHERE b.round_id = v_round.id
      GROUP BY b.user_id
    ) AS payouts
    WHERE p.id = payouts.user_id;

    UPDATE public.casino_roulette_rounds AS r
    SET phase = 'settled',
        settled_at = v_now
    WHERE r.id = v_round.id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.place_roulette_table_bet(
  p_user_id UUID,
  p_bet_type TEXT,
  p_bet_value TEXT,
  p_stake NUMERIC,
  p_table_key TEXT DEFAULT 'main'
)
RETURNS TABLE (
  id UUID,
  round_id UUID,
  user_id UUID,
  bet_type TEXT,
  bet_value TEXT,
  stake NUMERIC,
  payout NUMERIC,
  is_win BOOLEAN,
  created_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table_key TEXT := COALESCE(NULLIF(BTRIM(p_table_key), ''), 'main');
  v_round public.casino_roulette_rounds%ROWTYPE;
  v_spinning_round public.casino_roulette_rounds%ROWTYPE;
  v_balance NUMERIC;
  v_bet public.casino_roulette_bets%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_next_round_number BIGINT;
  v_betting_closes_at TIMESTAMPTZ;
  v_reveal_duration INTERVAL := INTERVAL '6 seconds';
  v_betting_window INTERVAL := INTERVAL '15 seconds';
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Wymagane uwierzytelnienie';
  END IF;

  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Brak dostępu do zakładu';
  END IF;

  IF p_bet_type NOT IN ('straight', 'color', 'parity', 'range') THEN
    RAISE EXCEPTION 'Nieobsługiwany typ zakładu';
  END IF;

  IF p_stake IS NULL OR p_stake <= 0 OR p_stake <> ROUND(p_stake, 2) THEN
    RAISE EXCEPTION 'Stawka musi być większa od 0 i mieć maksymalnie 2 miejsca po przecinku';
  END IF;

  IF p_bet_type = 'straight' AND (
    p_bet_value !~ '^([0-9]|[1-2][0-9]|3[0-6])$'
  ) THEN
    RAISE EXCEPTION 'Niepoprawna wartość zakładu';
  END IF;

  IF p_bet_type = 'color' AND p_bet_value NOT IN ('red', 'black') THEN
    RAISE EXCEPTION 'Niepoprawna wartość zakładu';
  END IF;

  IF p_bet_type = 'parity' AND p_bet_value NOT IN ('even', 'odd') THEN
    RAISE EXCEPTION 'Niepoprawna wartość zakładu';
  END IF;

  IF p_bet_type = 'range' AND p_bet_value NOT IN ('low', 'high') THEN
    RAISE EXCEPTION 'Niepoprawna wartość zakładu';
  END IF;

  IF NOT pg_try_advisory_xact_lock(hashtext('roulette:' || v_table_key)) THEN
    RAISE EXCEPTION 'Stół ruletki jest teraz synchronizowany. Spróbuj ponownie za chwilę.';
  END IF;

  PERFORM public.advance_roulette_round_if_due(v_table_key);

  SELECT * INTO v_round
  FROM public.casino_roulette_rounds AS r
  WHERE r.table_key = v_table_key
    AND r.phase = 'waiting'
    AND v_now < r.betting_closes_at
  ORDER BY r.round_number ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    SELECT * INTO v_spinning_round
    FROM public.casino_roulette_rounds AS r
    WHERE r.table_key = v_table_key
      AND r.phase = 'spinning'
    ORDER BY r.round_number ASC
    LIMIT 1;

    IF FOUND THEN
      -- Queue the bet into the next round; betting stays open for a full
      -- window after the current spin settles.
      v_betting_closes_at :=
        GREATEST(v_spinning_round.spin_started_at + v_reveal_duration, v_now)
        + v_betting_window;
    ELSE
      v_betting_closes_at := v_now + v_betting_window;
    END IF;

    SELECT COALESCE(MAX(r.round_number), 0) + 1
    INTO v_next_round_number
    FROM public.casino_roulette_rounds AS r
    WHERE r.table_key = v_table_key;

    INSERT INTO public.casino_roulette_rounds (
      table_key,
      round_number,
      phase,
      betting_opens_at,
      betting_closes_at
    )
    VALUES (
      v_table_key,
      v_next_round_number,
      'waiting',
      v_now,
      v_betting_closes_at
    )
    RETURNING * INTO v_round;
  END IF;

  SELECT p.balance INTO v_balance
  FROM public.profiles AS p
  WHERE p.id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono użytkownika';
  END IF;

  IF p_stake > v_balance THEN
    RAISE EXCEPTION 'Saldo jest za małe na taki zakład';
  END IF;

  UPDATE public.profiles AS p
  SET balance = ROUND(p.balance - p_stake, 2)
  WHERE p.id = p_user_id;

  INSERT INTO public.casino_roulette_bets (
    round_id,
    user_id,
    bet_type,
    bet_value,
    stake
  )
  VALUES (
    v_round.id,
    p_user_id,
    p_bet_type,
    p_bet_value,
    ROUND(p_stake, 2)
  )
  RETURNING * INTO v_bet;

  RETURN QUERY
  SELECT
    v_bet.id,
    v_bet.round_id,
    v_bet.user_id,
    v_bet.bet_type,
    v_bet.bet_value,
    v_bet.stake,
    v_bet.payout,
    v_bet.is_win,
    v_bet.created_at,
    v_bet.settled_at;
END;
$$;

-- Clients may nudge an overdue round forward; the advisory lock and the due
-- checks make the call idempotent and race-safe. pg_cron remains the backup
-- driver for rounds nobody is watching.
GRANT EXECUTE ON FUNCTION public.advance_roulette_round_if_due(TEXT) TO authenticated;
