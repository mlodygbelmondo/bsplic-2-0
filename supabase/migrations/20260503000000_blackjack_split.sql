-- Blackjack split support.
--
-- Extends the server-authoritative blackjack game from one player hand to up
-- to four concurrently tracked hands. The client still sends only actions; the
-- server owns the deck, stakes, settlement, and balance mutations.

ALTER TABLE public.casino_blackjack_games
ADD COLUMN IF NOT EXISTS player_hands JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS active_hand_index INTEGER NOT NULL DEFAULT 0;

UPDATE public.casino_blackjack_games
SET player_hands = jsonb_build_array(
      jsonb_build_object(
        'id', 'hand-1',
        'cards', player_hand,
        'stake', stake,
        'payout', payout,
        'status', CASE
          WHEN status = 'playing' THEN 'playing'
          ELSE status
        END,
        'doubleDownUsed', double_down_used,
        'isSplitAces', FALSE
      )
    ),
    active_hand_index = 0
WHERE player_hands = '[]'::jsonb;

CREATE OR REPLACE FUNCTION public._blackjack_hand_object(
  p_id TEXT,
  p_cards JSONB,
  p_stake NUMERIC,
  p_status TEXT DEFAULT 'playing',
  p_double_down_used BOOLEAN DEFAULT FALSE,
  p_is_split_aces BOOLEAN DEFAULT FALSE,
  p_payout NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'id', p_id,
    'cards', p_cards,
    'stake', ROUND(p_stake, 2),
    'payout', ROUND(p_payout, 2),
    'status', p_status,
    'doubleDownUsed', p_double_down_used,
    'isSplitAces', p_is_split_aces
  );
$$;

CREATE OR REPLACE FUNCTION public._blackjack_replace_hand(
  p_hands JSONB,
  p_index INTEGER,
  p_hand JSONB
)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    jsonb_agg(
      CASE WHEN ord - 1 = p_index THEN p_hand ELSE elem END
      ORDER BY ord
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements(p_hands) WITH ORDINALITY AS t(elem, ord);
$$;

CREATE OR REPLACE FUNCTION public._blackjack_next_active_index(
  p_hands JSONB,
  p_start_index INTEGER DEFAULT 0
)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_hand JSONB;
  v_ord INTEGER;
BEGIN
  FOR v_hand, v_ord IN
    SELECT elem, ord::INTEGER - 1
    FROM jsonb_array_elements(p_hands) WITH ORDINALITY AS t(elem, ord)
    ORDER BY ord
  LOOP
    IF v_ord >= p_start_index AND v_hand->>'status' = 'playing' THEN
      RETURN v_ord;
    END IF;
  END LOOP;

  RETURN -1;
END;
$$;

DROP TYPE IF EXISTS public.blackjack_game_state CASCADE;
CREATE TYPE public.blackjack_game_state AS (
  id UUID,
  stake NUMERIC,
  initial_stake NUMERIC,
  status TEXT,
  player_hand JSONB,
  player_hands JSONB,
  active_hand_index INTEGER,
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
  v_active_hand JSONB := COALESCE(p_game.player_hands->p_game.active_hand_index, p_game.player_hands->0);
  v_player_hand JSONB := COALESCE(v_active_hand->'cards', p_game.player_hand);
BEGIN
  IF p_hide_dealer_hole AND jsonb_array_length(v_dealer) > 1 THEN
    v_dealer := jsonb_build_array(v_dealer->0);
  END IF;

  RETURN ROW(
    p_game.id,
    p_game.stake,
    p_game.initial_stake,
    p_game.status,
    v_player_hand,
    p_game.player_hands,
    p_game.active_hand_index,
    v_dealer,
    p_game.payout,
    p_game.double_down_used,
    p_game.created_at
  )::public.blackjack_game_state;
END;
$$;

CREATE OR REPLACE FUNCTION public._blackjack_settle_all_hands(
  p_game_id UUID,
  p_user_id UUID,
  p_dealer JSONB,
  p_deck JSONB
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_game public.casino_blackjack_games%ROWTYPE;
  v_dealer JSONB := p_dealer;
  v_deck JSONB := p_deck;
  v_hand JSONB;
  v_cards JSONB;
  v_hands JSONB := '[]'::jsonb;
  v_player_value INTEGER;
  v_dealer_value INTEGER;
  v_hand_stake NUMERIC;
  v_hand_payout NUMERIC;
  v_hand_status TEXT;
  v_total_stake NUMERIC := 0;
  v_total_payout NUMERIC := 0;
  v_game_status TEXT;
  v_play_dealer BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_game
  FROM public.casino_blackjack_games
  WHERE id = p_game_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono gry';
  END IF;

  FOR v_hand IN SELECT value FROM jsonb_array_elements(v_game.player_hands) LOOP
    v_cards := COALESCE(v_hand->'cards', '[]'::jsonb);
    IF v_hand->>'status' IN ('playing', 'stand') AND public._blackjack_hand_value(v_cards) <= 21 THEN
      v_play_dealer := TRUE;
      EXIT;
    END IF;
  END LOOP;

  IF v_play_dealer THEN
    SELECT new_dealer, new_deck INTO v_dealer, v_deck
    FROM public._blackjack_play_dealer(v_dealer, v_deck);
  END IF;

  v_dealer_value := public._blackjack_hand_value(v_dealer);

  FOR v_hand IN SELECT value FROM jsonb_array_elements(v_game.player_hands) LOOP
    v_cards := COALESCE(v_hand->'cards', '[]'::jsonb);
    v_player_value := public._blackjack_hand_value(v_cards);
    v_hand_stake := ROUND((v_hand->>'stake')::NUMERIC, 2);
    v_total_stake := ROUND(v_total_stake + v_hand_stake, 2);

    IF v_player_value > 21 OR v_hand->>'status' = 'busted' THEN
      v_hand_status := 'lost';
      v_hand_payout := 0;
    ELSIF v_dealer_value > 21 OR v_player_value > v_dealer_value THEN
      v_hand_status := 'won';
      v_hand_payout := ROUND(v_hand_stake * 2, 2);
    ELSIF v_player_value < v_dealer_value THEN
      v_hand_status := 'lost';
      v_hand_payout := 0;
    ELSE
      v_hand_status := 'push';
      v_hand_payout := v_hand_stake;
    END IF;

    v_total_payout := ROUND(v_total_payout + v_hand_payout, 2);
    v_hands := v_hands || jsonb_build_array(
      v_hand || jsonb_build_object('status', v_hand_status, 'payout', v_hand_payout)
    );
  END LOOP;

  IF v_total_payout > v_total_stake THEN
    v_game_status := 'won';
  ELSIF v_total_payout < v_total_stake THEN
    v_game_status := 'lost';
  ELSE
    v_game_status := 'push';
  END IF;

  IF v_total_payout > 0 THEN
    UPDATE public.profiles
    SET balance = ROUND(balance + v_total_payout, 2)
    WHERE id = p_user_id;
  END IF;

  UPDATE public.casino_blackjack_games
  SET status = v_game_status,
      stake = v_total_stake,
      payout = v_total_payout,
      player_hands = v_hands,
      player_hand = COALESCE((v_hands->0)->'cards', '[]'::jsonb),
      dealer_hand = v_dealer,
      deck = v_deck,
      active_hand_index = 0,
      settled_at = NOW()
  WHERE id = p_game_id;
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
  v_hand JSONB;
  v_hands JSONB;
  v_game public.casino_blackjack_games%ROWTYPE;
  v_player_blackjack BOOLEAN;
  v_dealer_blackjack BOOLEAN;
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

  v_hand := public._blackjack_hand_object('hand-1', v_player, p_stake);
  v_hands := jsonb_build_array(v_hand);

  INSERT INTO public.casino_blackjack_games (
    user_id, stake, initial_stake, status, player_hand, player_hands, active_hand_index, dealer_hand, deck
  )
  VALUES (
    p_user_id,
    ROUND(p_stake, 2),
    ROUND(p_stake, 2),
    'playing',
    v_player,
    v_hands,
    0,
    v_dealer,
    v_deck
  )
  RETURNING * INTO v_game;

  v_player_blackjack := public._blackjack_hand_value(v_player) = 21;
  v_dealer_blackjack := public._blackjack_hand_value(v_dealer) = 21;

  IF v_player_blackjack OR v_dealer_blackjack THEN
    IF v_player_blackjack AND v_dealer_blackjack THEN
      v_status := 'push';
      v_payout := ROUND(p_stake, 2);
    ELSIF v_player_blackjack THEN
      v_status := 'won';
      v_payout := ROUND(p_stake * 2.5, 2);
    ELSE
      v_status := 'lost';
      v_payout := 0;
    END IF;

    IF v_payout > 0 THEN
      UPDATE public.profiles
      SET balance = ROUND(balance + v_payout, 2)
      WHERE id = p_user_id;
    END IF;

    v_hands := jsonb_build_array(
      public._blackjack_hand_object('hand-1', v_player, p_stake, v_status, FALSE, FALSE, v_payout)
    );

    UPDATE public.casino_blackjack_games
    SET status = v_status,
        payout = v_payout,
        player_hands = v_hands,
        dealer_hand = v_dealer,
        deck = v_deck,
        settled_at = NOW()
    WHERE id = v_game.id;

    SELECT * INTO v_game
    FROM public.casino_blackjack_games
    WHERE id = v_game.id;

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
  v_idx INTEGER;
  v_next_idx INTEGER;
  v_hand JSONB;
  v_cards JSONB;
  v_card JSONB;
  v_deck JSONB;
  v_hands JSONB;
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

  v_idx := v_game.active_hand_index;
  v_hand := v_game.player_hands->v_idx;

  IF v_hand IS NULL OR v_hand->>'status' <> 'playing' THEN
    RAISE EXCEPTION 'Ta ręka nie jest aktywna';
  END IF;

  SELECT card, remaining INTO v_card, v_deck FROM public._blackjack_draw(v_game.deck);
  v_cards := COALESCE(v_hand->'cards', '[]'::jsonb) || jsonb_build_array(v_card);

  IF public._blackjack_hand_value(v_cards) > 21 THEN
    v_hand := v_hand || jsonb_build_object('cards', v_cards, 'status', 'busted');
    v_next_idx := public._blackjack_next_active_index(
      public._blackjack_replace_hand(v_game.player_hands, v_idx, v_hand),
      v_idx + 1
    );
  ELSE
    v_hand := v_hand || jsonb_build_object('cards', v_cards);
    v_next_idx := v_idx;
  END IF;

  v_hands := public._blackjack_replace_hand(v_game.player_hands, v_idx, v_hand);

  UPDATE public.casino_blackjack_games
  SET player_hands = v_hands,
      player_hand = v_cards,
      deck = v_deck,
      active_hand_index = GREATEST(v_next_idx, 0)
  WHERE id = v_game.id;

  IF v_next_idx = -1 THEN
    PERFORM public._blackjack_settle_all_hands(v_game.id, p_user_id, v_game.dealer_hand, v_deck);
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
  v_idx INTEGER;
  v_next_idx INTEGER;
  v_hand JSONB;
  v_hands JSONB;
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

  v_idx := v_game.active_hand_index;
  v_hand := v_game.player_hands->v_idx;

  IF v_hand IS NULL OR v_hand->>'status' <> 'playing' THEN
    RAISE EXCEPTION 'Ta ręka nie jest aktywna';
  END IF;

  v_hand := v_hand || jsonb_build_object('status', 'stand');
  v_hands := public._blackjack_replace_hand(v_game.player_hands, v_idx, v_hand);
  v_next_idx := public._blackjack_next_active_index(v_hands, v_idx + 1);

  UPDATE public.casino_blackjack_games
  SET player_hands = v_hands,
      player_hand = COALESCE((v_hands->GREATEST(v_next_idx, 0))->'cards', v_game.player_hand),
      active_hand_index = GREATEST(v_next_idx, 0)
  WHERE id = v_game.id;

  IF v_next_idx = -1 THEN
    PERFORM public._blackjack_settle_all_hands(v_game.id, p_user_id, v_game.dealer_hand, v_game.deck);
  END IF;

  SELECT * INTO v_game
  FROM public.casino_blackjack_games
  WHERE id = p_game_id;

  RETURN public._blackjack_state(v_game, v_game.status = 'playing');
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
  v_idx INTEGER;
  v_next_idx INTEGER;
  v_hand JSONB;
  v_cards JSONB;
  v_card JSONB;
  v_deck JSONB;
  v_hands JSONB;
  v_hand_stake NUMERIC;
  v_new_hand_stake NUMERIC;
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

  v_idx := v_game.active_hand_index;
  v_hand := v_game.player_hands->v_idx;

  IF v_hand IS NULL OR v_hand->>'status' <> 'playing' THEN
    RAISE EXCEPTION 'Ta ręka nie jest aktywna';
  END IF;

  IF COALESCE((v_hand->>'doubleDownUsed')::BOOLEAN, FALSE) THEN
    RAISE EXCEPTION 'Podwojenie stawki zostało już wykorzystane';
  END IF;

  IF jsonb_array_length(COALESCE(v_hand->'cards', '[]'::jsonb)) <> 2 THEN
    RAISE EXCEPTION 'Podwojenie możliwe tylko na dwukartowej ręce';
  END IF;

  v_hand_stake := ROUND((v_hand->>'stake')::NUMERIC, 2);

  SELECT balance INTO v_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono użytkownika';
  END IF;

  IF v_hand_stake > v_balance THEN
    RAISE EXCEPTION 'Saldo jest za małe na podwojenie stawki';
  END IF;

  UPDATE public.profiles
  SET balance = ROUND(balance - v_hand_stake, 2)
  WHERE id = p_user_id;

  SELECT card, remaining INTO v_card, v_deck FROM public._blackjack_draw(v_game.deck);
  v_cards := COALESCE(v_hand->'cards', '[]'::jsonb) || jsonb_build_array(v_card);
  v_new_hand_stake := ROUND(v_hand_stake * 2, 2);
  v_hand := v_hand || jsonb_build_object(
    'cards', v_cards,
    'stake', v_new_hand_stake,
    'doubleDownUsed', TRUE,
    'status', CASE WHEN public._blackjack_hand_value(v_cards) > 21 THEN 'busted' ELSE 'stand' END
  );

  v_hands := public._blackjack_replace_hand(v_game.player_hands, v_idx, v_hand);
  v_next_idx := public._blackjack_next_active_index(v_hands, v_idx + 1);

  UPDATE public.casino_blackjack_games
  SET stake = ROUND(v_game.stake + v_hand_stake, 2),
      player_hands = v_hands,
      player_hand = COALESCE((v_hands->GREATEST(v_next_idx, 0))->'cards', v_cards),
      deck = v_deck,
      double_down_used = TRUE,
      active_hand_index = GREATEST(v_next_idx, 0)
  WHERE id = v_game.id;

  IF v_next_idx = -1 THEN
    PERFORM public._blackjack_settle_all_hands(v_game.id, p_user_id, v_game.dealer_hand, v_deck);
  END IF;

  SELECT * INTO v_game
  FROM public.casino_blackjack_games
  WHERE id = p_game_id;

  RETURN public._blackjack_state(v_game, v_game.status = 'playing');
END;
$$;

CREATE OR REPLACE FUNCTION public.blackjack_split(
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
  v_idx INTEGER;
  v_next_idx INTEGER;
  v_hand JSONB;
  v_cards JSONB;
  v_first_card JSONB;
  v_second_card JSONB;
  v_drawn_card JSONB;
  v_deck JSONB;
  v_hand_stake NUMERIC;
  v_split_aces BOOLEAN;
  v_first_hand JSONB;
  v_second_hand JSONB;
  v_new_hands JSONB := '[]'::jsonb;
  v_existing_hand JSONB;
  v_ord INTEGER;
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

  IF jsonb_array_length(v_game.player_hands) >= 4 THEN
    RAISE EXCEPTION 'Osiągnięto limit 4 rąk po splicie';
  END IF;

  v_idx := v_game.active_hand_index;
  v_hand := v_game.player_hands->v_idx;

  IF v_hand IS NULL OR v_hand->>'status' <> 'playing' THEN
    RAISE EXCEPTION 'Ta ręka nie jest aktywna';
  END IF;

  v_cards := COALESCE(v_hand->'cards', '[]'::jsonb);

  IF jsonb_array_length(v_cards) <> 2 THEN
    RAISE EXCEPTION 'Split możliwy tylko na dwóch kartach';
  END IF;

  v_first_card := v_cards->0;
  v_second_card := v_cards->1;

  IF (v_first_card->>'value')::INTEGER <> (v_second_card->>'value')::INTEGER THEN
    RAISE EXCEPTION 'Split wymaga dwóch kart o tej samej wartości';
  END IF;

  v_hand_stake := ROUND((v_hand->>'stake')::NUMERIC, 2);

  SELECT balance INTO v_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono użytkownika';
  END IF;

  IF v_hand_stake > v_balance THEN
    RAISE EXCEPTION 'Saldo jest za małe na split';
  END IF;

  UPDATE public.profiles
  SET balance = ROUND(balance - v_hand_stake, 2)
  WHERE id = p_user_id;

  v_split_aces := (v_first_card->>'rank' = 'A') AND (v_second_card->>'rank' = 'A');

  SELECT card, remaining INTO v_drawn_card, v_deck FROM public._blackjack_draw(v_game.deck);
  v_first_hand := public._blackjack_hand_object(
    CONCAT(v_hand->>'id', '-a'),
    jsonb_build_array(v_first_card, v_drawn_card),
    v_hand_stake,
    CASE WHEN v_split_aces THEN 'stand' ELSE 'playing' END,
    FALSE,
    v_split_aces
  );

  SELECT card, remaining INTO v_drawn_card, v_deck FROM public._blackjack_draw(v_deck);
  v_second_hand := public._blackjack_hand_object(
    CONCAT(v_hand->>'id', '-b'),
    jsonb_build_array(v_second_card, v_drawn_card),
    v_hand_stake,
    CASE WHEN v_split_aces THEN 'stand' ELSE 'playing' END,
    FALSE,
    v_split_aces
  );

  FOR v_existing_hand, v_ord IN
    SELECT elem, ord::INTEGER - 1
    FROM jsonb_array_elements(v_game.player_hands) WITH ORDINALITY AS t(elem, ord)
    ORDER BY ord
  LOOP
    IF v_ord = v_idx THEN
      v_new_hands := v_new_hands || jsonb_build_array(v_first_hand, v_second_hand);
    ELSE
      v_new_hands := v_new_hands || jsonb_build_array(v_existing_hand);
    END IF;
  END LOOP;

  v_next_idx := public._blackjack_next_active_index(v_new_hands, v_idx);

  UPDATE public.casino_blackjack_games
  SET stake = ROUND(v_game.stake + v_hand_stake, 2),
      player_hands = v_new_hands,
      player_hand = COALESCE((v_new_hands->GREATEST(v_next_idx, 0))->'cards', (v_new_hands->0)->'cards'),
      deck = v_deck,
      active_hand_index = GREATEST(v_next_idx, 0)
  WHERE id = v_game.id;

  IF v_next_idx = -1 THEN
    PERFORM public._blackjack_settle_all_hands(v_game.id, p_user_id, v_game.dealer_hand, v_deck);
  END IF;

  SELECT * INTO v_game
  FROM public.casino_blackjack_games
  WHERE id = p_game_id;

  RETURN public._blackjack_state(v_game, v_game.status = 'playing');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.blackjack_split(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.blackjack_split(UUID, UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.place_blackjack_bet(UUID, NUMERIC) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.blackjack_hit(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.blackjack_stand(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.blackjack_double_down(UUID, UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.place_blackjack_bet(UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.blackjack_hit(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.blackjack_stand(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.blackjack_double_down(UUID, UUID) TO authenticated;
