-- Harden the user-facing jackpot snapshot and the authoritative AKO placement path.

CREATE OR REPLACE FUNCTION private.get_daily_jackpot_snapshot(
  p_pool_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_snapshot JSONB;
BEGIN
  SELECT jsonb_build_object(
    'pool_id', p.id,
    'pool_date', p.pool_date,
    'status', p.status,
    'prize_amount', p.prize_amount,
    'ticket_price', p.ticket_price,
    'max_tickets_per_player', 2,
    'min_unique_users', p.min_unique_users,
    'participant_count', (
      SELECT COUNT(DISTINCT t.user_id)
        FROM public.daily_jackpot_tickets t
       WHERE t.pool_id = p.id
    ),
    'ticket_count', (
      SELECT COUNT(*)
        FROM public.daily_jackpot_tickets t
       WHERE t.pool_id = p.id
    ),
    'draw_scheduled_at', p.draw_scheduled_at,
    'current_user_has_ticket', EXISTS (
      SELECT 1
        FROM public.daily_jackpot_tickets t
       WHERE t.pool_id = p.id
         AND t.user_id = p_user_id
    ),
    'current_user_ticket_count', (
      SELECT COUNT(*)
        FROM public.daily_jackpot_tickets t
       WHERE t.pool_id = p.id
         AND t.user_id = p_user_id
    ),
    'current_user_ticket_number', (
      SELECT t.ticket_number
        FROM public.daily_jackpot_tickets t
       WHERE t.pool_id = p.id
         AND t.user_id = p_user_id
       ORDER BY t.ticket_number
       LIMIT 1
    ),
    'winner_user_id', p.winner_user_id,
    'winner_username', winner.username,
    'winner_avatar_url', winner.avatar_url,
    'winning_ticket_number', winning_ticket.ticket_number,
    'server_now', NOW()
  )
    INTO v_snapshot
    FROM public.daily_jackpot_pools p
    LEFT JOIN public.profiles winner ON winner.id = p.winner_user_id
    LEFT JOIN public.daily_jackpot_tickets winning_ticket
      ON winning_ticket.id = p.winning_ticket_id
   WHERE p.id = p_pool_id;

  RETURN v_snapshot;
END;
$$;

CREATE OR REPLACE FUNCTION private.get_empty_daily_jackpot_snapshot(p_pool_date DATE)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'pool_id', NULL,
    'pool_date', p_pool_date,
    'status', 'collecting',
    'prize_amount', 0,
    'ticket_price', 100,
    'max_tickets_per_player', 2,
    'min_unique_users', 3,
    'participant_count', 0,
    'ticket_count', 0,
    'draw_scheduled_at', public.get_warsaw_draw_at(p_pool_date),
    'current_user_has_ticket', false,
    'current_user_ticket_count', 0,
    'current_user_ticket_number', NULL,
    'winner_user_id', NULL,
    'winner_username', NULL,
    'winner_avatar_url', NULL,
    'winning_ticket_number', NULL,
    'server_now', NOW()
  );
$$;

CREATE OR REPLACE FUNCTION public.get_daily_jackpot_state()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
SET lock_timeout = '3s'
AS $$
DECLARE
  v_due RECORD;
  v_pool_id UUID;
  v_today DATE := (timezone('Europe/Warsaw', NOW()))::DATE;
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Zaloguj się';
  END IF;

  v_pool_id := private.sync_daily_jackpot_funding(v_today);

  FOR v_due IN
    SELECT pool_date
      FROM public.daily_jackpot_pools
     WHERE status IN ('collecting', 'locked')
       AND draw_scheduled_at <= NOW()
     ORDER BY pool_date ASC
     LIMIT 5
  LOOP
    PERFORM private.finalize_daily_jackpot_pool(v_due.pool_date, v_user_id);
  END LOOP;

  SELECT id
    INTO v_pool_id
    FROM public.daily_jackpot_pools
   WHERE pool_date = v_today;

  IF v_pool_id IS NULL THEN
    RETURN private.get_empty_daily_jackpot_snapshot(v_today);
  END IF;

  RETURN private.get_daily_jackpot_snapshot(v_pool_id, v_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.place_bet_secure(
  p_user_id UUID,
  p_total_odds NUMERIC,
  p_stake NUMERIC,
  p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance NUMERIC;
  v_bet_active BOOLEAN;
  v_bet_ended BOOLEAN;
  v_bet_options JSONB;
  v_canonical_odds NUMERIC;
  v_canonical_total_odds NUMERIC := 1;
  v_conflict RECORD;
  v_coupon_id UUID;
  v_distinct_bet_count INTEGER;
  v_item JSONB;
  v_item_count INTEGER;
  v_item_stake NUMERIC;
  v_item_stake_sum NUMERIC := 0;
  v_selected_option TEXT;
  v_validated_items JSONB := '[]'::JSONB;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Nie możesz obstawiać w imieniu innego użytkownika';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'Nieprawidłowy kupon';
  END IF;

  v_item_count := jsonb_array_length(p_items);

  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'Dodaj co najmniej jedno zdarzenie do kuponu';
  END IF;

  IF p_stake IS NULL OR p_stake <= 0 THEN
    RAISE EXCEPTION 'Stawka musi być większa od 0';
  END IF;

  IF p_stake <> ROUND(p_stake, 2) THEN
    RAISE EXCEPTION 'Stawka może mieć maksymalnie 2 miejsca po przecinku';
  END IF;

  SELECT balance
    INTO v_balance
    FROM public.profiles
   WHERE id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono użytkownika';
  END IF;

  IF p_stake > v_balance THEN
    RAISE EXCEPTION 'Niewystarczające środki (saldo: % zł)', ROUND(v_balance, 2);
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    IF NOT (v_item ? 'stake') THEN
      RAISE EXCEPTION 'Stawka każdego zakładu musi być większa od 0';
    END IF;

    v_item_stake := (v_item->>'stake')::NUMERIC;

    IF v_item_stake <= 0 THEN
      RAISE EXCEPTION 'Stawka każdego zakładu musi być większa od 0';
    END IF;

    IF v_item_stake <> ROUND(v_item_stake, 2) THEN
      RAISE EXCEPTION 'Stawka zakładu może mieć maksymalnie 2 miejsca po przecinku';
    END IF;

    v_selected_option := NULLIF(v_item->>'selectedOption', '');

    IF v_selected_option IS NULL THEN
      RAISE EXCEPTION 'Wybierz opcję zakładu';
    END IF;

    SELECT is_active, (ends_at <= NOW()), options
      INTO v_bet_active, v_bet_ended, v_bet_options
      FROM public.bets
     WHERE id = (v_item->>'betId')::UUID;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Zakład nie istnieje';
    END IF;

    IF NOT v_bet_active THEN
      RAISE EXCEPTION 'Zakład jest już zamknięty';
    END IF;

    IF v_bet_ended THEN
      RAISE EXCEPTION 'Czas na obstawianie tego zakładu minął';
    END IF;

    v_canonical_odds := NULL;

    SELECT (option_item->>'odds')::NUMERIC
      INTO v_canonical_odds
      FROM jsonb_array_elements(v_bet_options) AS option_item
     WHERE option_item->>'name' = v_selected_option
     LIMIT 1;

    IF v_canonical_odds IS NULL THEN
      RAISE EXCEPTION 'Wybrana opcja zakładu nie istnieje';
    END IF;

    IF v_canonical_odds <= 0 THEN
      RAISE EXCEPTION 'Nieprawidłowy kurs zakładu';
    END IF;

    v_item_stake_sum := ROUND(v_item_stake_sum + v_item_stake, 2);

    IF v_item_count > 1 THEN
      v_canonical_total_odds := v_canonical_total_odds * v_canonical_odds;
    END IF;

    v_validated_items := v_validated_items || jsonb_build_array(
      jsonb_build_object(
        'betId', v_item->>'betId',
        'selectedOption', v_selected_option,
        'odds', v_canonical_odds,
        'stake', v_item_stake
      )
    );
  END LOOP;

  IF v_item_stake_sum <> ROUND(p_stake, 2) THEN
    RAISE EXCEPTION 'Suma stawek zakładów musi być równa stawce kuponu';
  END IF;

  IF v_item_count > 1 THEN
    SELECT COUNT(DISTINCT (item->>'betId')::UUID)
      INTO v_distinct_bet_count
      FROM jsonb_array_elements(v_validated_items) AS item;

    IF v_distinct_bet_count <> v_item_count THEN
      RAISE EXCEPTION 'Nie możesz dodać tego samego zdarzenia do AKO więcej niż raz';
    END IF;

    WITH coupon_bets AS (
      SELECT (item->>'betId')::UUID AS bet_id
        FROM jsonb_array_elements(v_validated_items) AS item
    ), conflicts AS (
      SELECT
        e.bet_id_a,
        e.bet_id_b,
        ba.title AS title_a,
        bb.title AS title_b
      FROM public.bet_ako_exclusions e
      JOIN coupon_bets ca ON ca.bet_id = e.bet_id_a
      JOIN coupon_bets cb ON cb.bet_id = e.bet_id_b
      JOIN public.bets ba ON ba.id = e.bet_id_a
      JOIN public.bets bb ON bb.id = e.bet_id_b
      LIMIT 1
    )
    SELECT *
      INTO v_conflict
      FROM conflicts;

    IF FOUND THEN
      RAISE EXCEPTION 'Tych zdarzeń nie można łączyć na AKO: % + %',
        v_conflict.title_a,
        v_conflict.title_b;
    END IF;
  END IF;

  UPDATE public.profiles
     SET balance = ROUND(balance - p_stake, 2)
   WHERE id = p_user_id;

  INSERT INTO public.coupons (user_id, total_odds, stake, status)
  VALUES (
    p_user_id,
    CASE WHEN v_item_count > 1 THEN v_canonical_total_odds ELSE 1 END,
    ROUND(p_stake, 2),
    'pending'
  )
  RETURNING id INTO v_coupon_id;

  INSERT INTO public.placed_bets (user_id, bet_id, selected_option, stake, odds_at_time, coupon_id)
  SELECT
    p_user_id,
    (item->>'betId')::UUID,
    item->>'selectedOption',
    ROUND((item->>'stake')::NUMERIC, 2),
    (item->>'odds')::NUMERIC,
    v_coupon_id
  FROM jsonb_array_elements(v_validated_items) AS item;

  UPDATE public.bets
     SET bet_count = bet_count + 1
   WHERE id IN (
     SELECT (item->>'betId')::UUID
       FROM jsonb_array_elements(v_validated_items) AS item
   );

  RETURN v_coupon_id;
END;
$$;
