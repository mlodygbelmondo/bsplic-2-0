-- Coupon placement for clients that cannot tell whether a request went
-- through (a timeout, or iOS dropping the connection when the app is
-- suspended mid-request).
--
-- 1. `p_request_id`: a coupon placed with a client request id is placed once.
--    Repeating the call returns the coupon the first call created, without a
--    second charge, so the app can safely retry after a lost response.
-- 2. `p_check_odds`: the app sends the odds the player saw; when an admin
--    changed them meanwhile, the coupon is rejected (HINT `odds_changed`)
--    instead of being placed at the new odds.
--
-- Both parameters default to the previous behaviour, so the web client keeps
-- working unchanged.

ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS request_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS coupons_user_request_id_unique
  ON public.coupons (user_id, request_id)
  WHERE request_id IS NOT NULL;

DROP FUNCTION IF EXISTS public.place_bet_secure(UUID, NUMERIC, NUMERIC, JSONB);

CREATE FUNCTION public.place_bet_secure(
  p_user_id UUID,
  p_total_odds NUMERIC,
  p_stake NUMERIC,
  p_items JSONB,
  p_request_id UUID DEFAULT NULL,
  p_check_odds BOOLEAN DEFAULT FALSE
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
  v_existing_coupon_id UUID;
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

  -- A retry of a coupon already placed returns it instead of charging again.
  -- The profile row lock above serializes a player's placements, so a retry
  -- that overlaps the first call sees its coupon here once it commits.
  IF p_request_id IS NOT NULL THEN
    SELECT c.id
      INTO v_existing_coupon_id
      FROM public.coupons AS c
     WHERE c.user_id = p_user_id
       AND c.request_id = p_request_id;

    IF FOUND THEN
      RETURN v_existing_coupon_id;
    END IF;
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

    -- The player confirms the odds they saw; a changed price is never applied silently.
    IF p_check_odds AND (v_item->>'odds')::NUMERIC IS DISTINCT FROM v_canonical_odds THEN
      RAISE EXCEPTION 'Kurs zakładu się zmienił. Sprawdź kupon i postaw go ponownie.'
        USING HINT = 'odds_changed';
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

  INSERT INTO public.coupons (user_id, total_odds, stake, status, request_id)
  VALUES (
    p_user_id,
    CASE WHEN v_item_count > 1 THEN v_canonical_total_odds ELSE 1 END,
    ROUND(p_stake, 2),
    'pending',
    p_request_id
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

REVOKE EXECUTE ON FUNCTION public.place_bet_secure(UUID, NUMERIC, NUMERIC, JSONB, UUID, BOOLEAN)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_bet_secure(UUID, NUMERIC, NUMERIC, JSONB, UUID, BOOLEAN)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
