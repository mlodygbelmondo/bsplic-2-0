-- Canonical current definition (public schema). Mirror of the newest migration;
-- kept in sync by jackpotLifecycleConsolidation.test.ts. Change via a fresh migration.

CREATE OR REPLACE FUNCTION public.buy_daily_jackpot_ticket(p_pool_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_balance NUMERIC;
  v_current_pool_date DATE := (timezone('Europe/Warsaw', NOW()))::DATE;
  v_allowed_pool_date DATE := v_current_pool_date;
  v_max_tickets_per_player INTEGER :=
    (private.daily_jackpot_rules()->>'max_tickets_per_player')::INTEGER;
  v_next_ticket_number INTEGER;
  v_pool public.daily_jackpot_pools%ROWTYPE;
  v_ticket_funding_source_type TEXT := 'ticket_purchase';
  v_ticket_id UUID;
  v_user_ticket_count INTEGER;
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Zaloguj się';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.daily_jackpot_pools current_pool
     WHERE current_pool.pool_date = v_current_pool_date
       AND current_pool.status IN ('drawn', 'rolled_over', 'cancelled')
       AND current_pool.draw_scheduled_at <= NOW()
  ) THEN
    v_allowed_pool_date := v_current_pool_date + 1;
  END IF;

  SELECT *
    INTO v_pool
    FROM public.daily_jackpot_pools
   WHERE id = p_pool_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pula Jackpot nie istnieje';
  END IF;

  IF v_pool.pool_date <> v_allowed_pool_date THEN
    RAISE EXCEPTION 'Ta pula Jackpot nie jest teraz aktywna';
  END IF;

  IF v_pool.status <> 'collecting' THEN
    RAISE EXCEPTION 'Ta pula nie przyjmuje już ticketów';
  END IF;

  IF NOW() >= v_pool.draw_scheduled_at THEN
    RAISE EXCEPTION 'Losowanie już trwa';
  END IF;

  SELECT balance
    INTO v_balance
    FROM public.profiles
   WHERE id = v_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono profilu';
  END IF;

  SELECT COUNT(*)
    INTO v_user_ticket_count
    FROM public.daily_jackpot_tickets
   WHERE pool_id = v_pool.id
     AND user_id = v_user_id;

  IF v_user_ticket_count >= v_max_tickets_per_player THEN
    RAISE EXCEPTION 'Limit ticketów w tej puli to % na gracza', v_max_tickets_per_player;
  END IF;

  IF v_balance < v_pool.ticket_price THEN
    RAISE EXCEPTION 'Niewystarczające środki (saldo: % zł)', ROUND(v_balance, 2);
  END IF;

  SELECT COALESCE(MAX(ticket_number), 0) + 1
    INTO v_next_ticket_number
    FROM public.daily_jackpot_tickets
   WHERE pool_id = v_pool.id;

  UPDATE public.profiles
     SET balance = ROUND(balance - v_pool.ticket_price, 2)
   WHERE id = v_user_id;

  INSERT INTO public.daily_jackpot_tickets (
    pool_id,
    user_id,
    ticket_number,
    price
  )
  VALUES (
    v_pool.id,
    v_user_id,
    v_next_ticket_number,
    ROUND(v_pool.ticket_price, 2)
  )
  RETURNING id INTO v_ticket_id;

  INSERT INTO public.daily_jackpot_funding_entries (
    pool_id,
    source_type,
    ticket_id,
    amount,
    source_day
  )
  VALUES (
    v_pool.id,
    v_ticket_funding_source_type,
    v_ticket_id,
    ROUND(v_pool.ticket_price, 2),
    v_pool.pool_date
  )
  ON CONFLICT DO NOTHING;

  UPDATE public.daily_jackpot_pools p
     SET prize_amount = ROUND(COALESCE((
           SELECT SUM(amount)
             FROM public.daily_jackpot_funding_entries f
            WHERE f.pool_id = p.id
         ), 0), 2),
         updated_at = NOW()
   WHERE p.id = v_pool.id;

  INSERT INTO public.daily_jackpot_events (pool_id, event_type, payload)
  VALUES (
    v_pool.id,
    'ticket_bought',
    jsonb_build_object('user_id', v_user_id, 'ticket_number', v_next_ticket_number)
  );

  RETURN private.get_daily_jackpot_snapshot(v_pool.id, v_user_id);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Nie udało się kupić ticketu. Spróbuj ponownie';
END;
$$;
