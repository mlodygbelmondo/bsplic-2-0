-- Persistent private blackjack tables.
--
-- Each user gets a private two-deck shoe that survives across hands. Public
-- clients keep using action RPCs; future cards and dealer hole cards are only
-- exposed through safe, redacted state.

CREATE OR REPLACE FUNCTION public._blackjack_new_shoe(p_deck_count INTEGER DEFAULT 2)
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
  v_safe_deck_count INTEGER := GREATEST(COALESCE(p_deck_count, 2), 1);
BEGIN
  FOR v_deck_idx IN 1..v_safe_deck_count LOOP
    FOREACH v_suit IN ARRAY v_suits LOOP
      FOR v_idx IN 1..array_length(v_ranks, 1) LOOP
        v_cards := v_cards || jsonb_build_object(
          'id', gen_random_uuid()::TEXT,
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

CREATE OR REPLACE FUNCTION public._blackjack_new_deck()
RETURNS JSONB
LANGUAGE sql
VOLATILE
AS $$
  SELECT public._blackjack_new_shoe(2);
$$;

CREATE TABLE IF NOT EXISTS public.casino_blackjack_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  deck_count INTEGER NOT NULL DEFAULT 2 CHECK (deck_count = 2),
  shoe JSONB NOT NULL DEFAULT '[]'::jsonb,
  shoe_number INTEGER NOT NULL DEFAULT 0 CHECK (shoe_number >= 0),
  hands_played INTEGER NOT NULL DEFAULT 0 CHECK (hands_played >= 0),
  last_shuffled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT casino_blackjack_tables_user_unique UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS casino_blackjack_tables_user_idx
  ON public.casino_blackjack_tables (user_id);

ALTER TABLE public.casino_blackjack_tables ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.casino_blackjack_games
ADD COLUMN IF NOT EXISTS table_id UUID REFERENCES public.casino_blackjack_tables(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS hand_number BIGINT,
ADD COLUMN IF NOT EXISTS shoe_number INTEGER;

CREATE INDEX IF NOT EXISTS casino_blackjack_games_table_idx
  ON public.casino_blackjack_games (table_id);

CREATE INDEX IF NOT EXISTS casino_blackjack_games_user_active_idx
  ON public.casino_blackjack_games (user_id, created_at DESC)
  WHERE status = 'playing';

DROP POLICY IF EXISTS "Users can view own blackjack games" ON public.casino_blackjack_games;

INSERT INTO public.casino_blackjack_tables (
  user_id,
  shoe,
  shoe_number,
  last_shuffled_at
)
SELECT DISTINCT ON (g.user_id)
  g.user_id,
  CASE
    WHEN jsonb_array_length(COALESCE(g.deck, '[]'::jsonb)) > 0 THEN g.deck
    ELSE public._blackjack_new_shoe(2)
  END,
  1,
  NOW()
FROM public.casino_blackjack_games AS g
ORDER BY g.user_id, g.created_at DESC
ON CONFLICT (user_id) DO NOTHING;

UPDATE public.casino_blackjack_games AS g
SET table_id = t.id,
    hand_number = COALESCE(g.hand_number, 1),
    shoe_number = COALESCE(g.shoe_number, t.shoe_number)
FROM public.casino_blackjack_tables AS t
WHERE g.user_id = t.user_id
  AND g.table_id IS NULL;

CREATE OR REPLACE FUNCTION public._blackjack_ensure_table(p_user_id UUID)
RETURNS public.casino_blackjack_tables
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table public.casino_blackjack_tables%ROWTYPE;
BEGIN
  INSERT INTO public.casino_blackjack_tables (
    user_id,
    shoe,
    shoe_number,
    last_shuffled_at
  )
  VALUES (
    p_user_id,
    public._blackjack_new_shoe(2),
    1,
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_table
  FROM public.casino_blackjack_tables
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono stołu blackjacka';
  END IF;

  IF jsonb_array_length(COALESCE(v_table.shoe, '[]'::jsonb)) = 0
     OR v_table.shoe_number < 1 THEN
    UPDATE public.casino_blackjack_tables
    SET shoe = public._blackjack_new_shoe(deck_count),
        shoe_number = GREATEST(shoe_number, 0) + 1,
        last_shuffled_at = NOW(),
        updated_at = NOW()
    WHERE id = v_table.id
    RETURNING * INTO v_table;
  END IF;

  RETURN v_table;
END;
$$;

CREATE OR REPLACE FUNCTION public._blackjack_table_for_game(
  p_game public.casino_blackjack_games,
  p_user_id UUID
)
RETURNS public.casino_blackjack_tables
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table public.casino_blackjack_tables%ROWTYPE;
BEGIN
  IF p_game.table_id IS NOT NULL THEN
    SELECT * INTO v_table
    FROM public.casino_blackjack_tables
    WHERE id = p_game.table_id AND user_id = p_user_id
    FOR UPDATE;
  END IF;

  IF v_table.id IS NULL THEN
    v_table := public._blackjack_ensure_table(p_user_id);

    UPDATE public.casino_blackjack_games
    SET table_id = v_table.id,
        shoe_number = COALESCE(shoe_number, v_table.shoe_number)
    WHERE id = p_game.id;
  END IF;

  IF p_game.table_id IS NULL
     AND jsonb_array_length(COALESCE(p_game.deck, '[]'::jsonb)) > 0 THEN
    UPDATE public.casino_blackjack_tables
    SET shoe = p_game.deck,
        updated_at = NOW()
    WHERE id = v_table.id
    RETURNING * INTO v_table;
  END IF;

  RETURN v_table;
END;
$$;

CREATE OR REPLACE FUNCTION public._blackjack_draw_from_shoe(
  p_shoe JSONB,
  p_deck_count INTEGER,
  p_shoe_number INTEGER,
  OUT card JSONB,
  OUT remaining JSONB,
  OUT new_shoe_number INTEGER,
  OUT reshuffled BOOLEAN
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_shoe JSONB := COALESCE(p_shoe, '[]'::jsonb);
BEGIN
  new_shoe_number := COALESCE(p_shoe_number, 0);
  reshuffled := FALSE;

  IF jsonb_array_length(v_shoe) = 0 THEN
    v_shoe := public._blackjack_new_shoe(COALESCE(p_deck_count, 2));
    new_shoe_number := new_shoe_number + 1;
    reshuffled := TRUE;
  END IF;

  card := v_shoe->0;
  remaining := COALESCE(
    (
      SELECT jsonb_agg(elem)
      FROM jsonb_array_elements(v_shoe) WITH ORDINALITY AS t(elem, ord)
      WHERE ord > 1
    ),
    '[]'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public._blackjack_play_dealer_from_shoe(
  p_dealer JSONB,
  p_shoe JSONB,
  p_deck_count INTEGER,
  p_shoe_number INTEGER,
  OUT new_dealer JSONB,
  OUT new_shoe JSONB,
  OUT new_shoe_number INTEGER
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_card JSONB;
  v_reshuffled BOOLEAN;
BEGIN
  new_dealer := p_dealer;
  new_shoe := p_shoe;
  new_shoe_number := p_shoe_number;

  WHILE public._blackjack_hand_value(new_dealer) < 17 LOOP
    SELECT d.card, d.remaining, d.new_shoe_number, d.reshuffled
    INTO v_card, new_shoe, new_shoe_number, v_reshuffled
    FROM public._blackjack_draw_from_shoe(new_shoe, p_deck_count, new_shoe_number) AS d;

    new_dealer := new_dealer || jsonb_build_array(v_card);
  END LOOP;
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
  deck_count INTEGER,
  cards_remaining INTEGER,
  shoe_number INTEGER,
  dealer_hidden_count INTEGER,
  created_at TIMESTAMPTZ
);

CREATE OR REPLACE FUNCTION public._blackjack_state(
  p_game public.casino_blackjack_games,
  p_hide_dealer_hole BOOLEAN
)
RETURNS public.blackjack_game_state
LANGUAGE plpgsql
STABLE
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

DROP FUNCTION IF EXISTS public._blackjack_settle_all_hands(UUID, UUID, JSONB, JSONB);
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

CREATE OR REPLACE FUNCTION public.get_blackjack_table_info(p_user_id UUID)
RETURNS TABLE (
  deck_count INTEGER,
  cards_remaining INTEGER,
  shoe_number INTEGER,
  hands_played INTEGER,
  needs_shuffle BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table public.casino_blackjack_tables%ROWTYPE;
  v_cards_remaining INTEGER;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Brak dostępu do stołu';
  END IF;

  v_table := public._blackjack_ensure_table(p_user_id);
  v_cards_remaining := jsonb_array_length(COALESCE(v_table.shoe, '[]'::jsonb));

  RETURN QUERY
  SELECT
    v_table.deck_count,
    v_cards_remaining,
    v_table.shoe_number,
    v_table.hands_played,
    v_cards_remaining < 26;
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
    AND status = 'playing'
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
  WHERE user_id = p_user_id AND status = 'playing'
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
    deck
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
    '[]'::jsonb
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
  v_table public.casino_blackjack_tables%ROWTYPE;
  v_idx INTEGER;
  v_next_idx INTEGER;
  v_hand JSONB;
  v_cards JSONB;
  v_card JSONB;
  v_shoe JSONB;
  v_shoe_number INTEGER;
  v_hands JSONB;
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

  v_table := public._blackjack_table_for_game(v_game, p_user_id);
  v_shoe := v_table.shoe;
  v_shoe_number := v_table.shoe_number;
  v_idx := v_game.active_hand_index;
  v_hand := v_game.player_hands->v_idx;

  IF v_hand IS NULL OR v_hand->>'status' <> 'playing' THEN
    RAISE EXCEPTION 'Ta ręka nie jest aktywna';
  END IF;

  SELECT d.card, d.remaining, d.new_shoe_number, d.reshuffled
  INTO v_card, v_shoe, v_shoe_number, v_reshuffled
  FROM public._blackjack_draw_from_shoe(v_shoe, v_table.deck_count, v_shoe_number) AS d;
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
  v_table public.casino_blackjack_tables%ROWTYPE;
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

  v_table := public._blackjack_table_for_game(v_game, p_user_id);
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
    PERFORM public._blackjack_settle_all_hands(
      v_game.id,
      p_user_id,
      v_game.dealer_hand,
      v_table.shoe,
      v_table.shoe_number
    );
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
  v_table public.casino_blackjack_tables%ROWTYPE;
  v_balance NUMERIC;
  v_idx INTEGER;
  v_next_idx INTEGER;
  v_hand JSONB;
  v_cards JSONB;
  v_card JSONB;
  v_shoe JSONB;
  v_shoe_number INTEGER;
  v_hands JSONB;
  v_hand_stake NUMERIC;
  v_new_hand_stake NUMERIC;
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

  v_table := public._blackjack_table_for_game(v_game, p_user_id);
  v_shoe := v_table.shoe;
  v_shoe_number := v_table.shoe_number;
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

  SELECT d.card, d.remaining, d.new_shoe_number, d.reshuffled
  INTO v_card, v_shoe, v_shoe_number, v_reshuffled
  FROM public._blackjack_draw_from_shoe(v_shoe, v_table.deck_count, v_shoe_number) AS d;
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
      deck = '[]'::jsonb,
      double_down_used = TRUE,
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
    CASE WHEN v_split_aces THEN 'stand' ELSE 'playing' END,
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

REVOKE EXECUTE ON FUNCTION public._blackjack_new_shoe(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._blackjack_new_deck() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._blackjack_hand_value(JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._blackjack_hand_object(TEXT, JSONB, NUMERIC, TEXT, BOOLEAN, BOOLEAN, NUMERIC) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._blackjack_replace_hand(JSONB, INTEGER, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._blackjack_next_active_index(JSONB, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._blackjack_state(public.casino_blackjack_games, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._blackjack_draw(JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._blackjack_play_dealer(JSONB, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._blackjack_resolve(UUID, UUID, JSONB, JSONB, JSONB, NUMERIC, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._blackjack_ensure_table(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._blackjack_table_for_game(public.casino_blackjack_games, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._blackjack_draw_from_shoe(JSONB, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._blackjack_play_dealer_from_shoe(JSONB, JSONB, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._blackjack_settle_all_hands(UUID, UUID, JSONB, JSONB, INTEGER) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.get_blackjack_table_info(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_current_blackjack_game(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.place_blackjack_bet(UUID, NUMERIC) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.blackjack_hit(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.blackjack_stand(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.blackjack_double_down(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.blackjack_split(UUID, UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_blackjack_table_info(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_blackjack_game(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.place_blackjack_bet(UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.blackjack_hit(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.blackjack_stand(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.blackjack_double_down(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.blackjack_split(UUID, UUID) TO authenticated;
