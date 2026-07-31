-- Refund every ticket when an underfunded jackpot round rolls over.
-- PostgreSQL updates a target profile only once when UPDATE ... FROM matches
-- multiple tickets, so aggregate the refund per player before crediting it.

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
      SELECT
        user_id,
        ROUND(SUM(price), 2) AS refund_amount
      FROM public.daily_jackpot_tickets
      WHERE pool_id = v_pool.id
        AND refunded_at IS NULL
      GROUP BY user_id
    ), credited AS (
      UPDATE public.profiles p
         SET balance = ROUND(p.balance + r.refund_amount, 2)
        FROM refundable r
       WHERE p.id = r.user_id
       RETURNING p.id AS user_id
    )
    UPDATE public.daily_jackpot_tickets t
       SET refunded_at = v_now
      FROM credited c
     WHERE t.pool_id = v_pool.id
       AND t.user_id = c.user_id
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

    FOR v_participant_user_id IN
      SELECT DISTINCT user_id
        FROM public.daily_jackpot_tickets
       WHERE pool_id = v_pool.id
    LOOP
      PERFORM public.create_user_notification(
        v_participant_user_id,
        'jackpot_draw_ready'::public.notification_type,
        'Pula jackpotu przeszła dalej',
        'W tej rundzie było za mało graczy. Ticket został zwrócony, a pula przechodzi na kolejny dzień.',
        NULL,
        '/jackpot/draw/' || v_pool.id::TEXT,
        jsonb_build_object(
          'source', 'daily_jackpot',
          'event', 'rolled_over',
          'pool_id', v_pool.id
        )
      );
    END LOOP;

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

REVOKE ALL ON FUNCTION private.finalize_daily_jackpot_pool(DATE, UUID)
FROM PUBLIC, anon, authenticated;

-- Repair the additional ticket left unpaid by the previous implementation.
WITH missing_refunds AS (
  SELECT
    t.user_id,
    ROUND(SUM(t.price), 2) AS refund_amount
  FROM public.daily_jackpot_tickets t
  JOIN public.daily_jackpot_pools p ON p.id = t.pool_id
  WHERE p.status = 'rolled_over'
    AND t.refunded_at IS NULL
  GROUP BY t.user_id
), credited AS (
  UPDATE public.profiles p
     SET balance = ROUND(p.balance + r.refund_amount, 2)
    FROM missing_refunds r
   WHERE p.id = r.user_id
   RETURNING p.id AS user_id
)
UPDATE public.daily_jackpot_tickets t
   SET refunded_at = NOW()
  FROM public.daily_jackpot_pools pool, credited c
 WHERE pool.id = t.pool_id
   AND pool.status = 'rolled_over'
   AND t.user_id = c.user_id
   AND t.refunded_at IS NULL;

NOTIFY pgrst, 'reload schema';
