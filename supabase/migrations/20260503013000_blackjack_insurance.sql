-- Adds insurance as the dealer-ace decision state for persistent blackjack.

ALTER TABLE public.casino_blackjack_games
ADD COLUMN IF NOT EXISTS insurance_status TEXT NOT NULL DEFAULT 'unavailable',
ADD COLUMN IF NOT EXISTS insurance_stake NUMERIC NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS insurance_payout NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE public.casino_blackjack_games
DROP CONSTRAINT IF EXISTS casino_blackjack_games_status_check;

ALTER TABLE public.casino_blackjack_games
ADD CONSTRAINT casino_blackjack_games_status_check
CHECK (status IN ('playing', 'insurance', 'won', 'lost', 'push'));

ALTER TABLE public.casino_blackjack_games
DROP CONSTRAINT IF EXISTS casino_blackjack_games_insurance_status_check;

ALTER TABLE public.casino_blackjack_games
ADD CONSTRAINT casino_blackjack_games_insurance_status_check
CHECK (insurance_status IN ('unavailable', 'offered', 'declined', 'lost', 'won'));

CREATE INDEX IF NOT EXISTS casino_blackjack_games_user_open_idx
  ON public.casino_blackjack_games (user_id, created_at DESC)
  WHERE status IN ('playing', 'insurance');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_attribute a ON a.attrelid = t.typrelid
    WHERE t.typnamespace = 'public'::regnamespace
      AND t.typname = 'blackjack_game_state'
      AND a.attname = 'insurance_status'
      AND NOT a.attisdropped
  ) THEN
    ALTER TYPE public.blackjack_game_state ADD ATTRIBUTE insurance_status TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_attribute a ON a.attrelid = t.typrelid
    WHERE t.typnamespace = 'public'::regnamespace
      AND t.typname = 'blackjack_game_state'
      AND a.attname = 'insurance_stake'
      AND NOT a.attisdropped
  ) THEN
    ALTER TYPE public.blackjack_game_state ADD ATTRIBUTE insurance_stake NUMERIC;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_attribute a ON a.attrelid = t.typrelid
    WHERE t.typnamespace = 'public'::regnamespace
      AND t.typname = 'blackjack_game_state'
      AND a.attname = 'insurance_payout'
      AND NOT a.attisdropped
  ) THEN
    ALTER TYPE public.blackjack_game_state ADD ATTRIBUTE insurance_payout NUMERIC;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public._blackjack_state(
  p_game public.casino_blackjack_games,
  p_hide_dealer_hole BOOLEAN
)
RETURNS public.blackjack_game_state
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_table public.casino_blackjack_tables%ROWTYPE;
  v_dealer JSONB := COALESCE(p_game.dealer_hand, '[]'::jsonb);
  v_dealer_count INTEGER := jsonb_array_length(COALESCE(p_game.dealer_hand, '[]'::jsonb));
  v_dealer_hidden_count INTEGER := 0;
  v_active_hand JSONB := COALESCE(p_game.player_hands->p_game.active_hand_index, p_game.player_hands->0);
  v_player_hand JSONB := COALESCE(v_active_hand->'cards', p_game.player_hand);
  v_deck_count INTEGER := 2;
  v_cards_remaining INTEGER := 0;
  v_shoe_number INTEGER := COALESCE(p_game.shoe_number, 1);
BEGIN
  IF p_game.table_id IS NOT NULL THEN
    SELECT * INTO v_table
    FROM public.casino_blackjack_tables
    WHERE id = p_game.table_id;

    IF FOUND THEN
      v_deck_count := v_table.deck_count;
      v_cards_remaining := jsonb_array_length(COALESCE(v_table.shoe, '[]'::jsonb));
      v_shoe_number := COALESCE(p_game.shoe_number, v_table.shoe_number, 1);
    END IF;
  END IF;

  IF v_table.id IS NULL THEN
    v_cards_remaining := jsonb_array_length(COALESCE(p_game.deck, '[]'::jsonb));
  END IF;

  IF p_hide_dealer_hole AND v_dealer_count > 1 THEN
    v_dealer_hidden_count := v_dealer_count - 1;
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
    v_deck_count,
    v_cards_remaining,
    v_shoe_number,
    v_dealer_hidden_count,
    p_game.created_at,
    p_game.insurance_status,
    p_game.insurance_stake,
    p_game.insurance_payout
  )::public.blackjack_game_state;
END;
$$;

CREATE OR REPLACE FUNCTION public._blackjack_settle_all_hands(
  p_game_id UUID,
  p_user_id UUID,
  p_dealer JSONB,
  p_shoe JSONB,
  p_shoe_number INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game public.casino_blackjack_games%ROWTYPE;
  v_table public.casino_blackjack_tables%ROWTYPE;
  v_dealer JSONB := p_dealer;
  v_shoe JSONB := p_shoe;
  v_shoe_number INTEGER := p_shoe_number;
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
  v_hand_total_payout NUMERIC := 0;
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

  v_table := public._blackjack_table_for_game(v_game, p_user_id);
  v_shoe := COALESCE(v_shoe, v_table.shoe);
  v_shoe_number := COALESCE(v_shoe_number, v_table.shoe_number);
  v_total_stake := ROUND(COALESCE(v_game.insurance_stake, 0), 2);
  v_total_payout := ROUND(COALESCE(v_game.insurance_payout, 0), 2);

  FOR v_hand IN SELECT value FROM jsonb_array_elements(v_game.player_hands) LOOP
    v_cards := COALESCE(v_hand->'cards', '[]'::jsonb);
    IF v_hand->>'status' IN ('playing', 'stand') AND public._blackjack_hand_value(v_cards) <= 21 THEN
      v_play_dealer := TRUE;
      EXIT;
    END IF;
  END LOOP;

  IF v_play_dealer THEN
    SELECT dealer_draw.new_dealer, dealer_draw.new_shoe, dealer_draw.new_shoe_number
    INTO v_dealer, v_shoe, v_shoe_number
    FROM public._blackjack_play_dealer_from_shoe(
      v_dealer,
      v_shoe,
      v_table.deck_count,
      v_shoe_number
    ) AS dealer_draw;
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
    v_hand_total_payout := ROUND(v_hand_total_payout + v_hand_payout, 2);
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

  IF v_hand_total_payout > 0 THEN
    UPDATE public.profiles
    SET balance = ROUND(balance + v_hand_total_payout, 2)
    WHERE id = p_user_id;
  END IF;

  UPDATE public.casino_blackjack_tables
  SET shoe = v_shoe,
      shoe_number = v_shoe_number,
      last_shuffled_at = CASE
        WHEN v_shoe_number <> v_table.shoe_number THEN NOW()
        ELSE last_shuffled_at
      END,
      updated_at = NOW()
  WHERE id = v_table.id;

  UPDATE public.casino_blackjack_games
  SET status = v_game_status,
      stake = v_total_stake,
      payout = v_total_payout,
      player_hands = v_hands,
      player_hand = COALESCE((v_hands->0)->'cards', '[]'::jsonb),
      dealer_hand = v_dealer,
      deck = '[]'::jsonb,
      active_hand_index = 0,
      shoe_number = v_shoe_number,
      settled_at = NOW()
  WHERE id = p_game_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_current_blackjack_game(p_user_id UUID)
RETURNS SETOF public.blackjack_game_state
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

  PERFORM public._blackjack_ensure_table(p_user_id);

  SELECT * INTO v_game
  FROM public.casino_blackjack_games
  WHERE user_id = p_user_id
    AND status IN ('playing', 'insurance')
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN NEXT public._blackjack_state(v_game, TRUE);
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
  v_table public.casino_blackjack_tables%ROWTYPE;
  v_existing_game public.casino_blackjack_games%ROWTYPE;
  v_shoe JSONB;
  v_shoe_number INTEGER;
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
  v_reshuffled BOOLEAN;
  v_hand_number BIGINT;
  v_dealer_upcard_rank TEXT;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Brak dostępu do gry';
  END IF;

  IF p_stake IS NULL OR p_stake <= 0 OR p_stake <> ROUND(p_stake, 2) THEN
    RAISE EXCEPTION 'Nieprawidłowa stawka';
  END IF;

  v_table := public._blackjack_ensure_table(p_user_id);

  SELECT * INTO v_existing_game
  FROM public.casino_blackjack_games
  WHERE user_id = p_user_id AND status IN ('playing', 'insurance')
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN public._blackjack_state(v_existing_game, TRUE);
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

  v_shoe := v_table.shoe;
  v_shoe_number := v_table.shoe_number;

  IF jsonb_array_length(COALESCE(v_shoe, '[]'::jsonb)) < 26 THEN
    v_shoe := public._blackjack_new_shoe(v_table.deck_count);
    v_shoe_number := v_shoe_number + 1;
    v_reshuffled := TRUE;
  ELSE
    v_reshuffled := FALSE;
  END IF;

  UPDATE public.profiles
  SET balance = ROUND(balance - p_stake, 2)
  WHERE id = p_user_id;

  v_player := '[]'::jsonb;
  v_dealer := '[]'::jsonb;

  SELECT d.card, d.remaining, d.new_shoe_number, d.reshuffled
  INTO v_card, v_shoe, v_shoe_number, v_reshuffled
  FROM public._blackjack_draw_from_shoe(v_shoe, v_table.deck_count, v_shoe_number) AS d;
  v_player := v_player || jsonb_build_array(v_card);

  SELECT d.card, d.remaining, d.new_shoe_number, d.reshuffled
  INTO v_card, v_shoe, v_shoe_number, v_reshuffled
  FROM public._blackjack_draw_from_shoe(v_shoe, v_table.deck_count, v_shoe_number) AS d;
  v_dealer := v_dealer || jsonb_build_array(v_card);

  SELECT d.card, d.remaining, d.new_shoe_number, d.reshuffled
  INTO v_card, v_shoe, v_shoe_number, v_reshuffled
  FROM public._blackjack_draw_from_shoe(v_shoe, v_table.deck_count, v_shoe_number) AS d;
  v_player := v_player || jsonb_build_array(v_card);

  SELECT d.card, d.remaining, d.new_shoe_number, d.reshuffled
  INTO v_card, v_shoe, v_shoe_number, v_reshuffled
  FROM public._blackjack_draw_from_shoe(v_shoe, v_table.deck_count, v_shoe_number) AS d;
  v_dealer := v_dealer || jsonb_build_array(v_card);

  v_hand := public._blackjack_hand_object('hand-1', v_player, p_stake);
  v_hands := jsonb_build_array(v_hand);
  v_hand_number := v_table.hands_played + 1;

  UPDATE public.casino_blackjack_tables
  SET shoe = v_shoe,
      shoe_number = v_shoe_number,
      hands_played = hands_played + 1,
      last_shuffled_at = CASE
        WHEN v_reshuffled OR v_shoe_number <> v_table.shoe_number THEN NOW()
        ELSE last_shuffled_at
      END,
      updated_at = NOW()
  WHERE id = v_table.id
  RETURNING * INTO v_table;

  INSERT INTO public.casino_blackjack_games (
    user_id,
    table_id,
    hand_number,
    shoe_number,
    stake,
    initial_stake,
    status,
    player_hand,
    player_hands,
    active_hand_index,
    dealer_hand,
    deck,
    insurance_status
  )
  VALUES (
    p_user_id,
    v_table.id,
    v_hand_number,
    v_shoe_number,
    ROUND(p_stake, 2),
    ROUND(p_stake, 2),
    'playing',
    v_player,
    v_hands,
    0,
    v_dealer,
    '[]'::jsonb,
    'unavailable'
  )
  RETURNING * INTO v_game;

  v_dealer_upcard_rank := v_dealer->0->>'rank';

  IF v_dealer_upcard_rank = 'A' THEN
    UPDATE public.casino_blackjack_games
    SET status = 'insurance',
        insurance_status = 'offered'
    WHERE id = v_game.id
    RETURNING * INTO v_game;

    RETURN public._blackjack_state(v_game, TRUE);
  END IF;

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
        deck = '[]'::jsonb,
        shoe_number = v_shoe_number,
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

CREATE OR REPLACE FUNCTION public._blackjack_resolve_insurance(
  p_game_id UUID,
  p_user_id UUID,
  p_take BOOLEAN
)
RETURNS public.blackjack_game_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game public.casino_blackjack_games%ROWTYPE;
  v_balance NUMERIC;
  v_insurance_stake NUMERIC;
  v_insurance_payout NUMERIC := 0;
  v_insurance_status TEXT;
  v_main_status TEXT;
  v_main_payout NUMERIC := 0;
  v_total_stake NUMERIC;
  v_total_payout NUMERIC;
  v_game_status TEXT;
  v_player_blackjack BOOLEAN;
  v_dealer_blackjack BOOLEAN;
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

  IF v_game.status <> 'insurance' OR v_game.insurance_status <> 'offered' THEN
    RAISE EXCEPTION 'Insurance nie jest dostępne dla tej gry';
  END IF;

  v_insurance_stake := CASE WHEN p_take THEN ROUND(v_game.initial_stake / 2, 2) ELSE 0 END;
  v_insurance_status := CASE WHEN p_take THEN 'lost' ELSE 'declined' END;

  IF p_take THEN
    SELECT balance INTO v_balance
    FROM public.profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Nie znaleziono użytkownika';
    END IF;

    IF v_insurance_stake > v_balance THEN
      RAISE EXCEPTION 'Saldo jest za małe na insurance';
    END IF;

    UPDATE public.profiles
    SET balance = ROUND(balance - v_insurance_stake, 2)
    WHERE id = p_user_id;
  END IF;

  v_player_blackjack := jsonb_array_length(COALESCE(v_game.player_hand, '[]'::jsonb)) = 2
    AND public._blackjack_hand_value(v_game.player_hand) = 21;
  v_dealer_blackjack := jsonb_array_length(COALESCE(v_game.dealer_hand, '[]'::jsonb)) = 2
    AND public._blackjack_hand_value(v_game.dealer_hand) = 21;

  IF p_take AND v_dealer_blackjack THEN
    v_insurance_status := 'won';
    v_insurance_payout := ROUND(v_insurance_stake * 3, 2);
  END IF;

  IF v_dealer_blackjack OR v_player_blackjack THEN
    IF v_player_blackjack AND v_dealer_blackjack THEN
      v_main_status := 'push';
      v_main_payout := ROUND(v_game.initial_stake, 2);
    ELSIF v_player_blackjack THEN
      v_main_status := 'won';
      v_main_payout := ROUND(v_game.initial_stake * 2.5, 2);
    ELSE
      v_main_status := 'lost';
      v_main_payout := 0;
    END IF;

    v_total_stake := ROUND(v_game.initial_stake + v_insurance_stake, 2);
    v_total_payout := ROUND(v_main_payout + v_insurance_payout, 2);

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

    v_hands := jsonb_build_array(
      public._blackjack_hand_object(
        'hand-1',
        v_game.player_hand,
        v_game.initial_stake,
        v_main_status,
        FALSE,
        FALSE,
        v_main_payout
      )
    );

    UPDATE public.casino_blackjack_games
    SET status = v_game_status,
        stake = v_total_stake,
        payout = v_total_payout,
        player_hands = v_hands,
        player_hand = v_game.player_hand,
        active_hand_index = 0,
        dealer_hand = v_game.dealer_hand,
        insurance_status = v_insurance_status,
        insurance_stake = v_insurance_stake,
        insurance_payout = v_insurance_payout,
        settled_at = NOW()
    WHERE id = v_game.id
    RETURNING * INTO v_game;

    RETURN public._blackjack_state(v_game, FALSE);
  END IF;

  v_total_stake := ROUND(v_game.initial_stake + v_insurance_stake, 2);

  UPDATE public.casino_blackjack_games
  SET status = 'playing',
      stake = v_total_stake,
      insurance_status = v_insurance_status,
      insurance_stake = v_insurance_stake,
      insurance_payout = v_insurance_payout
  WHERE id = v_game.id
  RETURNING * INTO v_game;

  RETURN public._blackjack_state(v_game, TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION public.blackjack_take_insurance(
  p_game_id UUID,
  p_user_id UUID
)
RETURNS public.blackjack_game_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public._blackjack_resolve_insurance(p_game_id, p_user_id, TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION public.blackjack_decline_insurance(
  p_game_id UUID,
  p_user_id UUID
)
RETURNS public.blackjack_game_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public._blackjack_resolve_insurance(p_game_id, p_user_id, FALSE);
END;
$$;

REVOKE EXECUTE ON FUNCTION public._blackjack_state(public.casino_blackjack_games, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._blackjack_settle_all_hands(UUID, UUID, JSONB, JSONB, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._blackjack_resolve_insurance(UUID, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.get_current_blackjack_game(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.place_blackjack_bet(UUID, NUMERIC) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.blackjack_take_insurance(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.blackjack_decline_insurance(UUID, UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_current_blackjack_game(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.place_blackjack_bet(UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.blackjack_take_insurance(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.blackjack_decline_insurance(UUID, UUID) TO authenticated;
