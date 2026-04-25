-- Casino Blackjack: server-authoritative game logic.
--
-- The server owns the deck, deals cards, plays the dealer hand, decides the
-- outcome, and updates the balance. Clients only send actions (hit / stand /
-- double-down) and never supply hands, status, or payout amounts.

CREATE TABLE IF NOT EXISTS public.casino_blackjack_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stake NUMERIC(12, 2) NOT NULL CHECK (stake > 0),
  initial_stake NUMERIC(12, 2) NOT NULL CHECK (initial_stake > 0),
  payout NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('playing', 'won', 'lost', 'push')),
  player_hand JSONB NOT NULL DEFAULT '[]'::jsonb,
  dealer_hand JSONB NOT NULL DEFAULT '[]'::jsonb,
  deck JSONB NOT NULL DEFAULT '[]'::jsonb,
  double_down_used BOOLEAN NOT NULL DEFAULT FALSE,
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

-- ---------------------------------------------------------------------------
-- Internal helpers (prefixed with _, not granted to clients)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._blackjack_hand_value(p_hand JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_total INT := 0;
  v_aces INT := 0;
  v_card JSONB;
BEGIN
  FOR v_card IN SELECT value FROM jsonb_array_elements(p_hand) LOOP
    v_total := v_total + (v_card->>'value')::INT;
    IF (v_card->>'rank') = 'A' THEN
      v_aces := v_aces + 1;
    END IF;
  END LOOP;

  WHILE v_total > 21 AND v_aces > 0 LOOP
    v_total := v_total - 10;
    v_aces := v_aces - 1;
  END LOOP;

  RETURN v_total;
END;
$$;

CREATE OR REPLACE FUNCTION public._blackjack_new_deck()
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_suits TEXT[] := ARRAY['hearts', 'diamonds', 'clubs', 'spades'];
  v_ranks TEXT[] := ARRAY['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  v_values INT[] := ARRAY[2,3,4,5,6,7,8,9,10,10,10,10,11];
  v_cards JSONB[] := ARRAY[]::JSONB[];
  v_suit TEXT;
  v_idx INT;
  v_deck_idx INT;
BEGIN
  -- Two-deck shoe.
  FOR v_deck_idx IN 1..2 LOOP
    FOREACH v_suit IN ARRAY v_suits LOOP
      FOR v_idx IN 1..array_length(v_ranks, 1) LOOP
        v_cards := v_cards || jsonb_build_object(
          'suit', v_suit,
          'rank', v_ranks[v_idx],
          'value', v_values[v_idx]
        );
      END LOOP;
    END LOOP;
  END LOOP;

  RETURN (
    SELECT jsonb_agg(elem ORDER BY random())
    FROM unnest(v_cards) AS elem
  );
END;
$$;

-- Pop the top card off a deck. If the deck would run out, reshuffle a fresh
-- two-deck shoe before drawing.
CREATE OR REPLACE FUNCTION public._blackjack_draw(
  p_deck JSONB,
  OUT card JSONB,
  OUT remaining JSONB
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_deck JSONB := p_deck;
BEGIN
  IF v_deck IS NULL OR jsonb_array_length(v_deck) = 0 THEN
    v_deck := public._blackjack_new_deck();
  END IF;

  card := v_deck->0;
  remaining := COALESCE(
    (
      SELECT jsonb_agg(elem)
      FROM jsonb_array_elements(v_deck) WITH ORDINALITY AS t(elem, ord)
      WHERE ord > 1
    ),
    '[]'::jsonb
  );
END;
$$;

-- Play the dealer to a hard 17. Dealer hits on soft 17 is intentionally NOT
-- implemented (most common house rule for casual play here is dealer stands
-- on all 17s).
CREATE OR REPLACE FUNCTION public._blackjack_play_dealer(
  p_dealer JSONB,
  p_deck JSONB,
  OUT new_dealer JSONB,
  OUT new_deck JSONB
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_card JSONB;
BEGIN
  new_dealer := p_dealer;
  new_deck := p_deck;

  WHILE public._blackjack_hand_value(new_dealer) < 17 LOOP
    SELECT card, remaining INTO v_card, new_deck
    FROM public._blackjack_draw(new_deck);
    new_dealer := new_dealer || jsonb_build_array(v_card);
  END LOOP;
END;
$$;

-- Resolve a finished hand: writes status, payout, hands, deck and credits
-- the user's balance for any winnings. Caller must already hold a row lock
-- on the game row.
CREATE OR REPLACE FUNCTION public._blackjack_resolve(
  p_game_id UUID,
  p_user_id UUID,
  p_player JSONB,
  p_dealer JSONB,
  p_deck JSONB,
  p_stake NUMERIC,
  p_natural_blackjack BOOLEAN,
  OUT result_status TEXT,
  OUT result_payout NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_player_value INT := public._blackjack_hand_value(p_player);
  v_dealer_value INT := public._blackjack_hand_value(p_dealer);
BEGIN
  IF v_player_value > 21 THEN
    result_status := 'lost';
    result_payout := 0;
  ELSIF v_dealer_value > 21 OR v_player_value > v_dealer_value THEN
    result_status := 'won';
    IF p_natural_blackjack THEN
      -- Natural 3:2 payout (stake returned + 1.5x stake winnings).
      result_payout := ROUND(p_stake * 2.5, 2);
    ELSE
      result_payout := ROUND(p_stake * 2, 2);
    END IF;
  ELSIF v_player_value < v_dealer_value THEN
    result_status := 'lost';
    result_payout := 0;
  ELSE
    result_status := 'push';
    result_payout := ROUND(p_stake, 2);
  END IF;

  IF result_payout > 0 THEN
    UPDATE public.profiles
    SET balance = ROUND(balance + result_payout, 2)
    WHERE id = p_user_id;
  END IF;

  UPDATE public.casino_blackjack_games
  SET status = result_status,
      payout = result_payout,
      player_hand = p_player,
      dealer_hand = p_dealer,
      deck = p_deck,
      settled_at = NOW()
  WHERE id = p_game_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Public RPCs
-- ---------------------------------------------------------------------------

-- Composite return type used by all action RPCs.
DROP TYPE IF EXISTS public.blackjack_game_state CASCADE;
CREATE TYPE public.blackjack_game_state AS (
  id UUID,
  stake NUMERIC,
  initial_stake NUMERIC,
  status TEXT,
  player_hand JSONB,
  dealer_hand JSONB,
  payout NUMERIC,
  double_down_used BOOLEAN,
  created_at TIMESTAMPTZ
);

CREATE OR REPLACE FUNCTION public._blackjack_state(
  p_game public.casino_blackjack_games,
  p_hide_dealer_hole BOOLEAN
)
RETURNS public.blackjack_game_state
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_dealer JSONB := p_game.dealer_hand;
BEGIN
  -- Hide the dealer's hole card while the hand is still in progress so the
  -- client can't peek at it before standing.
  IF p_hide_dealer_hole AND jsonb_array_length(v_dealer) > 1 THEN
    v_dealer := jsonb_build_array(v_dealer->0);
  END IF;

  RETURN ROW(
    p_game.id,
    p_game.stake,
    p_game.initial_stake,
    p_game.status,
    p_game.player_hand,
    v_dealer,
    p_game.payout,
    p_game.double_down_used,
    p_game.created_at
  )::public.blackjack_game_state;
END;
$$;

CREATE OR REPLACE FUNCTION public.place_blackjack_bet(
  p_user_id UUID,
  p_stake NUMERIC
)
RETURNS public.blackjack_game_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance NUMERIC;
  v_deck JSONB;
  v_player JSONB;
  v_dealer JSONB;
  v_card JSONB;
  v_game public.casino_blackjack_games%ROWTYPE;
  v_natural BOOLEAN;
  v_status TEXT;
  v_payout NUMERIC;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Brak dostępu do gry';
  END IF;

  IF p_stake IS NULL OR p_stake <= 0 OR p_stake <> ROUND(p_stake, 2) THEN
    RAISE EXCEPTION 'Nieprawidłowa stawka';
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

  -- Deal: player, dealer, player, dealer.
  v_deck := public._blackjack_new_deck();
  v_player := '[]'::jsonb;
  v_dealer := '[]'::jsonb;

  SELECT card, remaining INTO v_card, v_deck FROM public._blackjack_draw(v_deck);
  v_player := v_player || jsonb_build_array(v_card);
  SELECT card, remaining INTO v_card, v_deck FROM public._blackjack_draw(v_deck);
  v_dealer := v_dealer || jsonb_build_array(v_card);
  SELECT card, remaining INTO v_card, v_deck FROM public._blackjack_draw(v_deck);
  v_player := v_player || jsonb_build_array(v_card);
  SELECT card, remaining INTO v_card, v_deck FROM public._blackjack_draw(v_deck);
  v_dealer := v_dealer || jsonb_build_array(v_card);

  INSERT INTO public.casino_blackjack_games (
    user_id, stake, initial_stake, status, player_hand, dealer_hand, deck
  )
  VALUES (
    p_user_id,
    ROUND(p_stake, 2),
    ROUND(p_stake, 2),
    'playing',
    v_player,
    v_dealer,
    v_deck
  )
  RETURNING * INTO v_game;

  -- Natural blackjack: settle immediately. If both have 21 it's a push,
  -- otherwise the player wins at 3:2.
  IF public._blackjack_hand_value(v_player) = 21 THEN
    v_natural := public._blackjack_hand_value(v_dealer) <> 21;
    SELECT result_status, result_payout INTO v_status, v_payout
    FROM public._blackjack_resolve(
      v_game.id, p_user_id, v_player, v_dealer, v_deck,
      v_game.stake, v_natural
    );

    SELECT * INTO v_game
    FROM public.casino_blackjack_games
    WHERE id = v_game.id;

    -- Reveal both dealer cards on a settled hand.
    RETURN public._blackjack_state(v_game, FALSE);
  END IF;

  RETURN public._blackjack_state(v_game, TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION public.blackjack_hit(
  p_game_id UUID,
  p_user_id UUID
)
RETURNS public.blackjack_game_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game public.casino_blackjack_games%ROWTYPE;
  v_card JSONB;
  v_deck JSONB;
  v_player JSONB;
  v_status TEXT;
  v_payout NUMERIC;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Brak dostępu do gry';
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

  SELECT card, remaining INTO v_card, v_deck FROM public._blackjack_draw(v_game.deck);
  v_player := v_game.player_hand || jsonb_build_array(v_card);

  IF public._blackjack_hand_value(v_player) > 21 THEN
    SELECT result_status, result_payout INTO v_status, v_payout
    FROM public._blackjack_resolve(
      v_game.id, p_user_id, v_player, v_game.dealer_hand, v_deck,
      v_game.stake, FALSE
    );
  ELSE
    UPDATE public.casino_blackjack_games
    SET player_hand = v_player,
        deck = v_deck
    WHERE id = v_game.id;
  END IF;

  SELECT * INTO v_game
  FROM public.casino_blackjack_games
  WHERE id = p_game_id;

  RETURN public._blackjack_state(v_game, v_game.status = 'playing');
END;
$$;

CREATE OR REPLACE FUNCTION public.blackjack_stand(
  p_game_id UUID,
  p_user_id UUID
)
RETURNS public.blackjack_game_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game public.casino_blackjack_games%ROWTYPE;
  v_dealer JSONB;
  v_deck JSONB;
  v_status TEXT;
  v_payout NUMERIC;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Brak dostępu do gry';
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

  SELECT new_dealer, new_deck INTO v_dealer, v_deck
  FROM public._blackjack_play_dealer(v_game.dealer_hand, v_game.deck);

  SELECT result_status, result_payout INTO v_status, v_payout
  FROM public._blackjack_resolve(
    v_game.id, p_user_id, v_game.player_hand, v_dealer, v_deck,
    v_game.stake, FALSE
  );

  SELECT * INTO v_game
  FROM public.casino_blackjack_games
  WHERE id = p_game_id;

  RETURN public._blackjack_state(v_game, FALSE);
END;
$$;

CREATE OR REPLACE FUNCTION public.blackjack_double_down(
  p_game_id UUID,
  p_user_id UUID
)
RETURNS public.blackjack_game_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game public.casino_blackjack_games%ROWTYPE;
  v_balance NUMERIC;
  v_card JSONB;
  v_deck JSONB;
  v_player JSONB;
  v_dealer JSONB;
  v_dealer_after JSONB;
  v_deck_after JSONB;
  v_status TEXT;
  v_payout NUMERIC;
  v_new_stake NUMERIC;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Brak dostępu do gry';
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

  IF v_game.double_down_used THEN
    RAISE EXCEPTION 'Podwojenie stawki zostało już wykorzystane';
  END IF;

  IF jsonb_array_length(v_game.player_hand) <> 2 THEN
    RAISE EXCEPTION 'Podwojenie możliwe tylko po pierwszym rozdaniu';
  END IF;

  -- Charge an additional initial-stake amount and lock the new total.
  SELECT balance INTO v_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono użytkownika';
  END IF;

  IF v_game.initial_stake > v_balance THEN
    RAISE EXCEPTION 'Saldo jest za małe na podwojenie stawki';
  END IF;

  UPDATE public.profiles
  SET balance = ROUND(balance - v_game.initial_stake, 2)
  WHERE id = p_user_id;

  v_new_stake := ROUND(v_game.stake + v_game.initial_stake, 2);

  -- Draw exactly one card, then play the dealer and settle.
  SELECT card, remaining INTO v_card, v_deck FROM public._blackjack_draw(v_game.deck);
  v_player := v_game.player_hand || jsonb_build_array(v_card);
  v_dealer := v_game.dealer_hand;

  IF public._blackjack_hand_value(v_player) <= 21 THEN
    SELECT new_dealer, new_deck INTO v_dealer_after, v_deck_after
    FROM public._blackjack_play_dealer(v_dealer, v_deck);
    v_dealer := v_dealer_after;
    v_deck := v_deck_after;
  END IF;

  UPDATE public.casino_blackjack_games
  SET stake = v_new_stake,
      double_down_used = TRUE
  WHERE id = v_game.id;

  SELECT result_status, result_payout INTO v_status, v_payout
  FROM public._blackjack_resolve(
    v_game.id, p_user_id, v_player, v_dealer, v_deck,
    v_new_stake, FALSE
  );

  SELECT * INTO v_game
  FROM public.casino_blackjack_games
  WHERE id = p_game_id;

  RETURN public._blackjack_state(v_game, FALSE);
END;
$$;

-- ---------------------------------------------------------------------------
-- Permissions: drop the old client-trusting RPCs and expose only the new
-- server-authoritative ones.
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.settle_blackjack_game(UUID, UUID, TEXT, NUMERIC, JSONB, JSONB);
DROP FUNCTION IF EXISTS public.add_blackjack_stake(UUID, UUID, NUMERIC);

REVOKE EXECUTE ON FUNCTION public.place_blackjack_bet(UUID, NUMERIC) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.blackjack_hit(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.blackjack_stand(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.blackjack_double_down(UUID, UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.place_blackjack_bet(UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.blackjack_hit(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.blackjack_stand(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.blackjack_double_down(UUID, UUID) TO authenticated;
