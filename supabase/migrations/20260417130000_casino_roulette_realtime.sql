CREATE OR REPLACE FUNCTION public.get_roulette_color(p_number INTEGER)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_number = 0 THEN 'green'
    WHEN p_number IN (1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36) THEN 'red'
    ELSE 'black'
  END;
$$;

CREATE OR REPLACE FUNCTION public.play_roulette_round(
  p_user_id UUID,
  p_bet_type TEXT,
  p_bet_value TEXT,
  p_stake NUMERIC
)
RETURNS TABLE (
  id UUID,
  bet_type TEXT,
  bet_value TEXT,
  stake NUMERIC,
  winning_number INTEGER,
  winning_color TEXT,
  payout NUMERIC,
  balance_after NUMERIC,
  created_at TIMESTAMPTZ,
  is_win BOOLEAN,
  net_change NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance NUMERIC;
  v_winning_number INTEGER;
  v_winning_color TEXT;
  v_is_win BOOLEAN := FALSE;
  v_payout NUMERIC := 0;
  v_balance_after NUMERIC;
  v_round_id UUID;
  v_created_at TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Wymagane uwierzytelnienie';
  END IF;

  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Brak dostępu do tej rundy';
  END IF;

  IF p_bet_type NOT IN ('straight', 'color', 'parity', 'range') THEN
    RAISE EXCEPTION 'Nieobsługiwany typ zakładu';
  END IF;

  IF p_stake IS NULL OR p_stake <= 0 THEN
    RAISE EXCEPTION 'Stawka musi być większa od 0';
  END IF;

  IF p_stake <> ROUND(p_stake, 2) THEN
    RAISE EXCEPTION 'Stawka może mieć maksymalnie 2 miejsca po przecinku';
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

  v_winning_number := FLOOR(random() * 37)::INTEGER;
  v_winning_color := public.get_roulette_color(v_winning_number);

  v_is_win := CASE
    WHEN p_bet_type = 'straight' THEN v_winning_number = p_bet_value::INTEGER
    WHEN p_bet_type = 'color' THEN v_winning_color = p_bet_value
    WHEN p_bet_type = 'parity' THEN v_winning_number <> 0 AND (
      (p_bet_value = 'even' AND MOD(v_winning_number, 2) = 0) OR
      (p_bet_value = 'odd' AND MOD(v_winning_number, 2) = 1)
    )
    WHEN p_bet_type = 'range' THEN (
      (p_bet_value = 'low' AND v_winning_number BETWEEN 1 AND 18) OR
      (p_bet_value = 'high' AND v_winning_number BETWEEN 19 AND 36)
    )
    ELSE FALSE
  END;

  v_payout := CASE
    WHEN NOT v_is_win THEN 0
    WHEN p_bet_type = 'straight' THEN ROUND(p_stake * 36, 2)
    ELSE ROUND(p_stake * 2, 2)
  END;

  UPDATE public.profiles AS p
  SET balance = ROUND(p.balance - p_stake + v_payout, 2)
  WHERE p.id = p_user_id
  RETURNING p.balance INTO v_balance_after;

  INSERT INTO public.casino_rounds (
    user_id,
    game_key,
    bet_type,
    bet_value,
    stake,
    winning_number,
    winning_color,
    payout,
    balance_after
  )
  VALUES (
    p_user_id,
    'roulette',
    p_bet_type,
    p_bet_value,
    ROUND(p_stake, 2),
    v_winning_number,
    v_winning_color,
    v_payout,
    v_balance_after
  )
  RETURNING casino_rounds.id, casino_rounds.created_at INTO v_round_id, v_created_at;

  RETURN QUERY
  SELECT
    v_round_id,
    p_bet_type,
    p_bet_value,
    ROUND(p_stake, 2),
    v_winning_number,
    v_winning_color,
    v_payout,
    v_balance_after,
    v_created_at,
    v_is_win,
    ROUND(v_payout - p_stake, 2);
END;
$$;

CREATE TABLE IF NOT EXISTS public.casino_roulette_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_key TEXT NOT NULL DEFAULT 'main',
  round_number BIGINT NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('waiting', 'spinning', 'settled')),
  betting_opens_at TIMESTAMPTZ NOT NULL,
  betting_closes_at TIMESTAMPTZ NOT NULL,
  spin_started_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ,
  winning_number INTEGER CHECK (winning_number BETWEEN 0 AND 36),
  winning_color TEXT CHECK (winning_color IN ('red', 'black', 'green')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT casino_roulette_rounds_sequence_unique UNIQUE (table_key, round_number)
);

CREATE TABLE IF NOT EXISTS public.casino_roulette_bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES public.casino_roulette_rounds(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bet_type TEXT NOT NULL CHECK (bet_type IN ('straight', 'color', 'parity', 'range')),
  bet_value TEXT NOT NULL,
  stake NUMERIC(12, 2) NOT NULL CHECK (stake > 0),
  payout NUMERIC(12, 2) NOT NULL DEFAULT 0,
  is_win BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS casino_roulette_rounds_table_phase_close_idx
  ON public.casino_roulette_rounds (table_key, phase, betting_closes_at DESC);

CREATE INDEX IF NOT EXISTS casino_roulette_bets_round_idx
  ON public.casino_roulette_bets (round_id);

CREATE INDEX IF NOT EXISTS casino_roulette_bets_user_created_idx
  ON public.casino_roulette_bets (user_id, created_at DESC);

ALTER TABLE public.casino_roulette_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.casino_roulette_bets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read roulette rounds" ON public.casino_roulette_rounds;
CREATE POLICY "Authenticated users can read roulette rounds"
ON public.casino_roulette_rounds
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Users can read own roulette bets" ON public.casino_roulette_bets;
CREATE POLICY "Users can read own roulette bets"
ON public.casino_roulette_bets
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'casino_roulette_rounds'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.casino_roulette_rounds;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'casino_roulette_bets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.casino_roulette_bets;
  END IF;
END $$;

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
  ORDER BY r.round_number DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_recent_roulette_spins(
  p_table_key TEXT DEFAULT 'main',
  p_limit INTEGER DEFAULT 10
)
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
    AND r.phase = 'settled'
  ORDER BY r.round_number DESC
  LIMIT GREATEST(COALESCE(p_limit, 10), 1);
$$;

CREATE OR REPLACE FUNCTION public.get_recent_roulette_wins(
  p_table_key TEXT DEFAULT 'main',
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  round_id UUID,
  user_id UUID,
  username TEXT,
  avatar_url TEXT,
  bet_type TEXT,
  bet_value TEXT,
  stake NUMERIC,
  payout NUMERIC,
  is_win BOOLEAN,
  created_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ,
  round_number BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
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
  WHERE auth.uid() IS NOT NULL
    AND r.table_key = p_table_key
    AND b.is_win = TRUE
    AND b.payout > 0
  ORDER BY COALESCE(b.settled_at, b.created_at) DESC
  LIMIT GREATEST(COALESCE(p_limit, 20), 1);
$$;

CREATE OR REPLACE FUNCTION public.get_my_current_roulette_bets(p_round_id UUID)
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
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
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
  WHERE b.round_id = p_round_id
    AND b.user_id = auth.uid()
  ORDER BY b.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.place_roulette_bet(
  p_round_id UUID,
  p_user_id UUID,
  p_bet_type TEXT,
  p_bet_value TEXT,
  p_stake NUMERIC
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
  v_round public.casino_roulette_rounds%ROWTYPE;
  v_balance NUMERIC;
  v_bet public.casino_roulette_bets%ROWTYPE;
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

  SELECT * INTO v_round
  FROM public.casino_roulette_rounds AS r
  WHERE r.id = p_round_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono aktywnej rundy';
  END IF;

  IF v_round.phase <> 'waiting' OR NOW() >= v_round.betting_closes_at THEN
    RAISE EXCEPTION 'Przyjmowanie zakładów do tej rundy zostało zakończone';
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
    p_round_id,
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

CREATE OR REPLACE FUNCTION public.advance_roulette_round_if_due(p_table_key TEXT DEFAULT 'main')
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_round public.casino_roulette_rounds%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_next_round_number BIGINT;
  v_winning_number INTEGER;
  v_winning_color TEXT;
  v_reveal_duration INTERVAL := INTERVAL '6 seconds';
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Wymagane uwierzytelnienie';
  END IF;

  SELECT * INTO v_round
  FROM public.casino_roulette_rounds AS r
  WHERE r.table_key = p_table_key
  ORDER BY r.round_number DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.casino_roulette_rounds (
      table_key,
      round_number,
      phase,
      betting_opens_at,
      betting_closes_at
    )
    VALUES (
      p_table_key,
      1,
      'waiting',
      v_now,
      v_now + INTERVAL '15 seconds'
    );
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

    SELECT COALESCE(MAX(r.round_number), 0) + 1
    INTO v_next_round_number
    FROM public.casino_roulette_rounds AS r
    WHERE r.table_key = p_table_key;

    INSERT INTO public.casino_roulette_rounds (
      table_key,
      round_number,
      phase,
      betting_opens_at,
      betting_closes_at
    )
    VALUES (
      p_table_key,
      v_next_round_number,
      'waiting',
      v_now,
      v_now + INTERVAL '15 seconds'
    );
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_current_roulette_round(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_recent_roulette_spins(TEXT, INTEGER) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_recent_roulette_wins(TEXT, INTEGER) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_current_roulette_bets(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.place_roulette_bet(UUID, UUID, TEXT, TEXT, NUMERIC) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.advance_roulette_round_if_due(TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_current_roulette_round(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_recent_roulette_spins(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_recent_roulette_wins(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_current_roulette_bets(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.place_roulette_bet(UUID, UUID, TEXT, TEXT, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.advance_roulette_round_if_due(TEXT) TO authenticated;
