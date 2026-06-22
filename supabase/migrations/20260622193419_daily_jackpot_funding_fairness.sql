-- Make Jackpot Dnia funding easier to explain:
-- 20% of previous-day lost sportsbook stakes + 100% of purchased tickets.

ALTER TABLE public.daily_jackpot_funding_entries
  ADD COLUMN IF NOT EXISTS ticket_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'daily_jackpot_funding_entries_ticket_id_fkey'
       AND conrelid = 'public.daily_jackpot_funding_entries'::regclass
  ) THEN
    ALTER TABLE public.daily_jackpot_funding_entries
      ADD CONSTRAINT daily_jackpot_funding_entries_ticket_id_fkey
      FOREIGN KEY (ticket_id)
      REFERENCES public.daily_jackpot_tickets(id)
      ON DELETE CASCADE;
  END IF;
END
$$;

DELETE FROM public.daily_jackpot_funding_entries
 WHERE source_type = 'ticket_fee';

ALTER TABLE public.daily_jackpot_funding_entries
  DROP CONSTRAINT IF EXISTS daily_jackpot_funding_entries_source_type_check;

ALTER TABLE public.daily_jackpot_funding_entries
  ADD CONSTRAINT daily_jackpot_funding_entries_source_type_check
  CHECK (source_type IN ('lost_coupon', 'rollover', 'ticket_purchase'));

CREATE UNIQUE INDEX IF NOT EXISTS daily_jackpot_funding_ticket_purchase_unique
  ON public.daily_jackpot_funding_entries(ticket_id)
  WHERE source_type = 'ticket_purchase'
    AND ticket_id IS NOT NULL;

CREATE OR REPLACE FUNCTION private.sync_daily_jackpot_funding(p_pool_date DATE)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_pool public.daily_jackpot_pools%ROWTYPE;
  v_pool_id UUID;
  v_source_day DATE := p_pool_date - 1;
  v_source_start TIMESTAMPTZ;
  v_source_end TIMESTAMPTZ;
BEGIN
  v_pool_id := private.ensure_daily_jackpot_pool(p_pool_date);
  v_source_start := (v_source_day::TEXT || ' 00:00:00 Europe/Warsaw')::TIMESTAMPTZ;
  v_source_end := ((v_source_day + 1)::TEXT || ' 00:00:00 Europe/Warsaw')::TIMESTAMPTZ;

  SELECT *
    INTO v_pool
    FROM public.daily_jackpot_pools
   WHERE id = v_pool_id
   FOR UPDATE;

  IF v_pool.status <> 'collecting' THEN
    RETURN v_pool_id;
  END IF;

  DELETE FROM public.daily_jackpot_funding_entries f
   WHERE f.pool_id = v_pool.id
     AND f.source_type = 'lost_coupon'
     AND f.source_day = v_source_day
     AND NOT EXISTS (
       SELECT 1
         FROM public.coupons c
        WHERE c.id = f.coupon_id
          AND c.status = 'lost'
          AND c.stake > 0
          AND ROUND(c.stake * 0.20, 2) = ROUND(f.amount, 2)
          AND (
            (
              c.settled_at IS NOT NULL
              AND c.settled_at >= v_source_start
              AND c.settled_at < v_source_end
            )
            OR (
              c.settled_at IS NULL
              AND c.created_at >= v_source_start
              AND c.created_at < v_source_end
            )
          )
     );

  INSERT INTO public.daily_jackpot_funding_entries (
    pool_id,
    source_type,
    coupon_id,
    amount,
    source_day
  )
  SELECT
    v_pool.id,
    'lost_coupon',
    c.id,
    ROUND(c.stake * 0.20, 2),
    v_source_day
  FROM public.coupons c
  WHERE c.status = 'lost'
    AND c.stake > 0
    AND (
      (
        c.settled_at IS NOT NULL
        AND c.settled_at >= v_source_start
        AND c.settled_at < v_source_end
      )
      OR (
        c.settled_at IS NULL
        AND c.created_at >= v_source_start
        AND c.created_at < v_source_end
      )
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

  RETURN v_pool_id;
END;
$$;

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

CREATE OR REPLACE FUNCTION private.finalize_daily_jackpot_pool(
  p_pool_date DATE,
  p_snapshot_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_entropy BYTEA;
  v_entropy_hash TEXT;
  v_next_pool_id UUID;
  v_now TIMESTAMPTZ := NOW();
  v_participant_count INTEGER;
  v_participant_user_id UUID;
  v_pool public.daily_jackpot_pools%ROWTYPE;
  v_pool_id UUID;
  v_rollover_amount NUMERIC := 0;
  v_snapshot_user_id UUID := p_snapshot_user_id;
  v_ticket_count INTEGER;
  v_winner_offset INTEGER;
  v_winning_ticket public.daily_jackpot_tickets%ROWTYPE;
BEGIN
  IF p_pool_date IS NULL THEN
    RAISE EXCEPTION 'Nieprawidłowa data puli Jackpot';
  END IF;

  PERFORM private.auto_credit_unclaimed_daily_jackpot_rewards(p_pool_date);

  v_pool_id := private.sync_daily_jackpot_funding(p_pool_date);

  SELECT *
    INTO v_pool
    FROM public.daily_jackpot_pools
   WHERE id = v_pool_id
   FOR UPDATE;

  IF v_pool.status IN ('drawn', 'rolled_over', 'cancelled') THEN
    RETURN private.get_daily_jackpot_snapshot(v_pool.id, v_snapshot_user_id);
  END IF;

  IF v_now < v_pool.draw_scheduled_at THEN
    RETURN private.get_daily_jackpot_snapshot(v_pool.id, v_snapshot_user_id);
  END IF;

  UPDATE public.daily_jackpot_pools
     SET status = 'locked',
         locked_at = COALESCE(locked_at, v_now),
         updated_at = v_now
   WHERE id = v_pool.id
   RETURNING * INTO v_pool;

  SELECT COUNT(DISTINCT user_id), COUNT(*)
    INTO v_participant_count, v_ticket_count
    FROM public.daily_jackpot_tickets
   WHERE pool_id = v_pool.id;

  IF v_participant_count < v_pool.min_unique_users THEN
    WITH refundable AS (
      SELECT id, user_id, price
        FROM public.daily_jackpot_tickets
       WHERE pool_id = v_pool.id
         AND refunded_at IS NULL
    ), credited AS (
      UPDATE public.profiles p
         SET balance = ROUND(p.balance + r.price, 2)
        FROM refundable r
       WHERE p.id = r.user_id
       RETURNING r.id
    )
    UPDATE public.daily_jackpot_tickets t
       SET refunded_at = v_now
      FROM credited c
     WHERE t.id = c.id
       AND t.refunded_at IS NULL;

    SELECT ROUND(COALESCE(SUM(amount), 0), 2)
      INTO v_rollover_amount
      FROM public.daily_jackpot_funding_entries
     WHERE pool_id = v_pool.id
       AND source_type <> 'ticket_purchase';

    DELETE FROM public.daily_jackpot_funding_entries
     WHERE pool_id = v_pool.id
       AND source_type = 'ticket_purchase';

    v_next_pool_id := private.ensure_daily_jackpot_pool(v_pool.pool_date + 1);

    IF v_rollover_amount > 0 THEN
      INSERT INTO public.daily_jackpot_funding_entries (
        pool_id,
        source_type,
        source_pool_id,
        amount,
        source_day
      )
      VALUES (
        v_next_pool_id,
        'rollover',
        v_pool.id,
        ROUND(v_rollover_amount, 2),
        v_pool.pool_date
      )
      ON CONFLICT DO NOTHING;

      UPDATE public.daily_jackpot_pools p
         SET prize_amount = ROUND(COALESCE((
               SELECT SUM(amount)
                 FROM public.daily_jackpot_funding_entries f
                WHERE f.pool_id = p.id
             ), 0), 2),
             rollover_from_pool_id = v_pool.id,
             updated_at = v_now
       WHERE p.id = v_next_pool_id
         AND p.status = 'collecting';
    END IF;

    UPDATE public.daily_jackpot_pools
       SET status = 'rolled_over',
           prize_amount = v_rollover_amount,
           drawn_at = v_now,
           reward_credit_status = 'not_applicable',
           updated_at = v_now
     WHERE id = v_pool.id
     RETURNING * INTO v_pool;

    INSERT INTO public.daily_jackpot_events (pool_id, event_type, payload)
    VALUES (
      v_pool.id,
      'rolled_over',
      jsonb_build_object(
        'participant_count', v_participant_count,
        'ticket_count', v_ticket_count,
        'rollover_amount', v_rollover_amount,
        'next_pool_id', v_next_pool_id
      )
    );

    RETURN private.get_daily_jackpot_snapshot(v_pool.id, v_snapshot_user_id);
  END IF;

  v_entropy := extensions.gen_random_bytes(32);
  v_entropy_hash := encode(extensions.digest(v_entropy, 'sha256'), 'hex');
  v_winner_offset := (
    (
      get_byte(v_entropy, 0)::BIGINT * 16777216
      + get_byte(v_entropy, 1)::BIGINT * 65536
      + get_byte(v_entropy, 2)::BIGINT * 256
      + get_byte(v_entropy, 3)::BIGINT
    ) % v_ticket_count
  )::INTEGER;

  SELECT *
    INTO v_winning_ticket
    FROM public.daily_jackpot_tickets
   WHERE pool_id = v_pool.id
   ORDER BY purchased_at ASC, id ASC
   OFFSET v_winner_offset
   LIMIT 1;

  UPDATE public.daily_jackpot_pools
     SET status = 'drawn',
         drawn_at = v_now,
         winner_user_id = v_winning_ticket.user_id,
         winning_ticket_id = v_winning_ticket.id,
         entropy_hash = v_entropy_hash,
         reward_credit_status = 'pending',
         reward_claimed_at = NULL,
         reward_auto_credited_at = NULL,
         reward_credit_event_id = NULL,
         updated_at = v_now
   WHERE id = v_pool.id
   RETURNING * INTO v_pool;

  INSERT INTO public.daily_jackpot_events (pool_id, event_type, payload)
  VALUES (
    v_pool.id,
    'drawn',
    jsonb_build_object(
      'winner_user_id', v_winning_ticket.user_id,
      'winning_ticket_id', v_winning_ticket.id,
      'winning_ticket_number', v_winning_ticket.ticket_number,
      'ticket_count', v_ticket_count
    )
  );

  FOR v_participant_user_id IN
    SELECT DISTINCT user_id
      FROM public.daily_jackpot_tickets
     WHERE pool_id = v_pool.id
  LOOP
    PERFORM public.create_user_notification(
      v_participant_user_id,
      'jackpot_draw_ready'::public.notification_type,
      'Losowanie jackpotu zakończone',
      'Losowanie jackpotu, w którym bierzesz udział, właśnie się zakończyło. Kliknij, aby obejrzeć wynik.',
      NULL,
      '/jackpot/draw/' || v_pool.id::TEXT,
      jsonb_build_object(
        'source', 'daily_jackpot',
        'pool_id', v_pool.id
      )
    );
  END LOOP;

  RETURN private.get_daily_jackpot_snapshot(v_pool.id, v_snapshot_user_id);
END;
$$;

REVOKE ALL ON FUNCTION private.sync_daily_jackpot_funding(DATE)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.finalize_daily_jackpot_pool(DATE, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.buy_daily_jackpot_ticket(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buy_daily_jackpot_ticket(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
