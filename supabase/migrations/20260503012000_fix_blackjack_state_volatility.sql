-- _blackjack_state reads the private table shoe after action RPCs update it.
-- It must be VOLATILE so returned shoe metadata reflects writes made earlier
-- in the same RPC call.

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
    p_game.created_at
  )::public.blackjack_game_state;
END;
$$;

REVOKE EXECUTE ON FUNCTION public._blackjack_state(public.casino_blackjack_games, BOOLEAN) FROM PUBLIC, anon, authenticated;
