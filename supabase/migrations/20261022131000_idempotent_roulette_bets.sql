-- Roulette bets placed with a client request id are placed once: repeating
-- the call (after a timeout or a connection dropped while the app was
-- suspended) returns the bet the first call created, without a second
-- charge, so the app can safely retry. The parameter defaults to NULL, so the
-- web client keeps working unchanged.

ALTER TABLE public.casino_roulette_bets ADD COLUMN IF NOT EXISTS request_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS casino_roulette_bets_user_request_id_unique
  ON public.casino_roulette_bets (user_id, request_id)
  WHERE request_id IS NOT NULL;

DROP FUNCTION IF EXISTS public.place_roulette_table_bet(UUID, TEXT, TEXT, NUMERIC, TEXT);

CREATE FUNCTION public.place_roulette_table_bet(
  p_user_id UUID,
  p_bet_type TEXT,
  p_bet_value TEXT,
  p_stake NUMERIC,
  p_table_key TEXT DEFAULT 'main',
  p_request_id UUID DEFAULT NULL
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

  -- A retry of a bet already placed returns it instead of charging again
  -- (checked before the table lock, so a retry never waits for it).
  IF p_request_id IS NOT NULL THEN
    SELECT * INTO v_bet
    FROM public.casino_roulette_bets AS b
    WHERE b.user_id = p_user_id
      AND b.request_id = p_request_id;

    IF FOUND THEN
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
      RETURN;
    END IF;
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
    stake,
    request_id
  )
  VALUES (
    v_round.id,
    p_user_id,
    p_bet_type,
    p_bet_value,
    ROUND(p_stake, 2),
    p_request_id
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

REVOKE EXECUTE ON FUNCTION public.place_roulette_table_bet(UUID, TEXT, TEXT, NUMERIC, TEXT, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_roulette_table_bet(UUID, TEXT, TEXT, NUMERIC, TEXT, UUID)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
