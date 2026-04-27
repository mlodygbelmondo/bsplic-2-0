CREATE TABLE IF NOT EXISTS public.casino_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_key TEXT NOT NULL DEFAULT 'roulette',
  bet_type TEXT NOT NULL,
  bet_value TEXT NOT NULL,
  stake NUMERIC(12, 2) NOT NULL CHECK (stake > 0),
  winning_number INTEGER NOT NULL CHECK (winning_number >= 0 AND winning_number <= 36),
  winning_color TEXT NOT NULL CHECK (winning_color IN ('red', 'black', 'green')),
  payout NUMERIC(12, 2) NOT NULL DEFAULT 0,
  balance_after NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT casino_rounds_bet_type_check CHECK (
    bet_type IN ('straight', 'color', 'parity', 'range')
  )
);

ALTER TABLE public.casino_rounds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own casino rounds" ON public.casino_rounds;
CREATE POLICY "Users can view own casino rounds"
ON public.casino_rounds
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

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

  SELECT balance INTO v_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono użytkownika';
  END IF;

  IF p_stake > v_balance THEN
    RAISE EXCEPTION 'Saldo jest za małe na taki zakład';
  END IF;

  v_winning_number := FLOOR(random() * 37)::INTEGER;
  v_winning_color := CASE
    WHEN v_winning_number = 0 THEN 'green'
    WHEN v_winning_number IN (1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36) THEN 'red'
    ELSE 'black'
  END;

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

  UPDATE public.profiles
  SET balance = ROUND(balance - p_stake + v_payout, 2)
  WHERE id = p_user_id
  RETURNING balance INTO v_balance_after;

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
