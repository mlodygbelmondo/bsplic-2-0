-- Apply the daily jackpot ticket contract to databases that already ran the
-- original jackpot migration before these requirements were corrected.

ALTER TABLE public.daily_jackpot_pools
  ALTER COLUMN ticket_price SET DEFAULT 100;

UPDATE public.daily_jackpot_pools
   SET ticket_price = 100,
       updated_at = NOW()
 WHERE status IN ('collecting', 'locked')
   AND ticket_price IS DISTINCT FROM 100;

ALTER TABLE public.daily_jackpot_tickets
  DROP CONSTRAINT IF EXISTS daily_jackpot_tickets_pool_id_user_id_key;

CREATE INDEX IF NOT EXISTS daily_jackpot_tickets_pool_user_idx
  ON public.daily_jackpot_tickets(pool_id, user_id);

CREATE OR REPLACE FUNCTION public.buy_daily_jackpot_ticket(p_pool_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_balance NUMERIC;
  v_current_pool_date DATE := (timezone('Europe/Warsaw', NOW()))::DATE;
  v_next_ticket_number INTEGER;
  v_pool public.daily_jackpot_pools%ROWTYPE;
  v_user_ticket_count INTEGER;
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Zaloguj się';
  END IF;

  SELECT *
    INTO v_pool
    FROM public.daily_jackpot_pools
   WHERE id = p_pool_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pula Jackpot nie istnieje';
  END IF;

  IF v_pool.pool_date <> v_current_pool_date THEN
    RAISE EXCEPTION 'Ta pula Jackpot nie jest dzisiaj aktywna';
  END IF;

  IF v_pool.status <> 'collecting' THEN
    RAISE EXCEPTION 'Ta pula nie przyjmuje już ticketów';
  END IF;

  IF v_pool.prize_amount <= 0 THEN
    RAISE EXCEPTION 'Brak aktywnej puli Jackpot';
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

  IF v_user_ticket_count >= 2 THEN
    RAISE EXCEPTION 'Limit ticketów w tej puli to 2 na gracza';
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
  );

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

REVOKE EXECUTE ON FUNCTION public.buy_daily_jackpot_ticket(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buy_daily_jackpot_ticket(UUID) TO authenticated;
