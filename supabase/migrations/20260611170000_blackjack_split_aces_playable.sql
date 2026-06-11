-- House rule: hands created by splitting aces stay playable (hit/stand/double)
-- instead of receiving one card and auto-standing. The isSplitAces flag is kept
-- so the UI can still mark these hands. Ace+10 after a split remains a regular
-- 21 paying 1:1 — only the auto-stand is removed.

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
  v_table public.casino_blackjack_tables%ROWTYPE;
  v_balance NUMERIC;
  v_idx INTEGER;
  v_next_idx INTEGER;
  v_hand JSONB;
  v_cards JSONB;
  v_first_card JSONB;
  v_second_card JSONB;
  v_drawn_card JSONB;
  v_shoe JSONB;
  v_shoe_number INTEGER;
  v_hand_stake NUMERIC;
  v_split_aces BOOLEAN;
  v_first_hand JSONB;
  v_second_hand JSONB;
  v_new_hands JSONB := '[]'::jsonb;
  v_existing_hand JSONB;
  v_ord INTEGER;
  v_reshuffled BOOLEAN;
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

  v_table := public._blackjack_table_for_game(v_game, p_user_id);
  v_shoe := v_table.shoe;
  v_shoe_number := v_table.shoe_number;
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

  SELECT d.card, d.remaining, d.new_shoe_number, d.reshuffled
  INTO v_drawn_card, v_shoe, v_shoe_number, v_reshuffled
  FROM public._blackjack_draw_from_shoe(v_shoe, v_table.deck_count, v_shoe_number) AS d;
  v_first_hand := public._blackjack_hand_object(
    CONCAT(v_hand->>'id', '-a'),
    jsonb_build_array(v_first_card, v_drawn_card),
    v_hand_stake,
    'playing',
    FALSE,
    v_split_aces
  );

  SELECT d.card, d.remaining, d.new_shoe_number, d.reshuffled
  INTO v_drawn_card, v_shoe, v_shoe_number, v_reshuffled
  FROM public._blackjack_draw_from_shoe(v_shoe, v_table.deck_count, v_shoe_number) AS d;
  v_second_hand := public._blackjack_hand_object(
    CONCAT(v_hand->>'id', '-b'),
    jsonb_build_array(v_second_card, v_drawn_card),
    v_hand_stake,
    'playing',
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
      deck = '[]'::jsonb,
      active_hand_index = GREATEST(v_next_idx, 0),
      shoe_number = v_shoe_number
  WHERE id = v_game.id;

  IF v_next_idx = -1 THEN
    PERFORM public._blackjack_settle_all_hands(
      v_game.id,
      p_user_id,
      v_game.dealer_hand,
      v_shoe,
      v_shoe_number
    );
  ELSE
    UPDATE public.casino_blackjack_tables
    SET shoe = v_shoe,
        shoe_number = v_shoe_number,
        last_shuffled_at = CASE
          WHEN v_shoe_number <> v_table.shoe_number THEN NOW()
          ELSE last_shuffled_at
        END,
        updated_at = NOW()
    WHERE id = v_table.id;
  END IF;

  SELECT * INTO v_game
  FROM public.casino_blackjack_games
  WHERE id = p_game_id;

  RETURN public._blackjack_state(v_game, v_game.status = 'playing');
END;
$$;
