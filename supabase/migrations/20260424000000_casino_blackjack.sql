CREATE TABLE IF NOT EXISTS public.casino_blackjack_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stake NUMERIC(12, 2) NOT NULL CHECK (stake > 0),
  payout NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('playing', 'won', 'lost', 'push')),
  player_hand JSONB NOT NULL DEFAULT '[]'::jsonb,
  dealer_hand JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ
);

ALTER TABLE public.casino_blackjack_games ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own blackjack games" ON public.casino_blackjack_games;
CREATE POLICY "Users can view own blackjack games"
ON public.casino_blackjack_games
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.place_blackjack_bet(
  p_user_id UUID,
  p_stake NUMERIC
)
RETURNS TABLE (
  id UUID,
  stake NUMERIC,
  status TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance NUMERIC;
  v_game_id UUID;
  v_created_at TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Brak dostępu do gry';
  END IF;

  IF p_stake IS NULL OR p_stake <= 0 THEN
    RAISE EXCEPTION 'Stawka musi być większa od 0';
  END IF;

  IF p_stake <> ROUND(p_stake, 2) THEN
    RAISE EXCEPTION 'Stawka może mieć maksymalnie 2 miejsca po przecinku';
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

  UPDATE public.profiles
  SET balance = ROUND(balance - p_stake, 2)
  WHERE id = p_user_id;

  INSERT INTO public.casino_blackjack_games (
    user_id,
    stake,
    status
  )
  VALUES (
    p_user_id,
    ROUND(p_stake, 2),
    'playing'
  )
  RETURNING casino_blackjack_games.id, casino_blackjack_games.created_at INTO v_game_id, v_created_at;

  RETURN QUERY
  SELECT
    v_game_id,
    ROUND(p_stake, 2),
    'playing'::TEXT,
    v_created_at;
END;
$$;


CREATE OR REPLACE FUNCTION public.settle_blackjack_game(
  p_game_id UUID,
  p_user_id UUID,
  p_status TEXT,
  p_payout NUMERIC,
  p_player_hand JSONB,
  p_dealer_hand JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game public.casino_blackjack_games%ROWTYPE;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Brak dostępu do gry';
  END IF;

  IF p_status NOT IN ('won', 'lost', 'push') THEN
    RAISE EXCEPTION 'Nieprawidłowy status gry';
  END IF;

  IF p_payout < 0 OR p_payout <> ROUND(p_payout, 2) THEN
    RAISE EXCEPTION 'Nieprawidłowa kwota wypłaty';
  END IF;

  SELECT * INTO v_game
  FROM public.casino_blackjack_games
  WHERE id = p_game_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono gry';
  END IF;

  IF v_game.status <> 'playing' THEN
    RAISE EXCEPTION 'Gra została już zakończona';
  END IF;

  -- Security validation: The maximum possible payout in standard Blackjack is 2.5x the stake (Blackjack 3:2 payout).
  IF p_payout > ROUND(v_game.stake * 2.5, 2) THEN
    RAISE EXCEPTION 'Próba oszustwa: wypłata przekracza dozwolony limit';
  END IF;

  IF p_payout > 0 THEN
    UPDATE public.profiles
    SET balance = ROUND(balance + p_payout, 2)
    WHERE id = p_user_id;
  END IF;

  UPDATE public.casino_blackjack_games
  SET status = p_status,
      payout = p_payout,
      player_hand = p_player_hand,
      dealer_hand = p_dealer_hand,
      settled_at = NOW()
  WHERE id = p_game_id;
END;
$$;


CREATE OR REPLACE FUNCTION public.add_blackjack_stake(
  p_game_id UUID,
  p_user_id UUID,
  p_additional_stake NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance NUMERIC;
  v_game public.casino_blackjack_games%ROWTYPE;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Brak dostępu do gry';
  END IF;

  IF p_additional_stake IS NULL OR p_additional_stake <= 0 OR p_additional_stake <> ROUND(p_additional_stake, 2) THEN
    RAISE EXCEPTION 'Nieprawidłowa kwota dodatkowej stawki';
  END IF;

  SELECT * INTO v_game
  FROM public.casino_blackjack_games
  WHERE id = p_game_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono gry';
  END IF;

  IF v_game.status <> 'playing' THEN
    RAISE EXCEPTION 'Gra została już zakończona';
  END IF;

  -- Security validation: additional stake must match the original stake (Double Down rule)
  IF ROUND(p_additional_stake, 2) <> v_game.stake THEN
    RAISE EXCEPTION 'Dodatkowa stawka musi być równa początkowej stawce (Double Down)';
  END IF;

  SELECT balance INTO v_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono użytkownika';
  END IF;

  IF p_additional_stake > v_balance THEN
    RAISE EXCEPTION 'Saldo jest za małe na dodatkowy zakład';
  END IF;

  UPDATE public.profiles
  SET balance = ROUND(balance - p_additional_stake, 2)
  WHERE id = p_user_id;

  UPDATE public.casino_blackjack_games
  SET stake = stake + ROUND(p_additional_stake, 2)
  WHERE id = p_game_id;

  RETURN ROUND(p_additional_stake, 2);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.place_blackjack_bet(UUID, NUMERIC) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.settle_blackjack_game(UUID, UUID, TEXT, NUMERIC, JSONB, JSONB) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.add_blackjack_stake(UUID, UUID, NUMERIC) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.place_blackjack_bet(UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.settle_blackjack_game(UUID, UUID, TEXT, NUMERIC, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_blackjack_stake(UUID, UUID, NUMERIC) TO authenticated;
