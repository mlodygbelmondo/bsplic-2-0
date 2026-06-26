-- Make insufficient-player jackpot rollovers visible to participants.
-- Previously those pools refunded tickets and moved on without notification
-- or an accessible settlement screen.

CREATE OR REPLACE FUNCTION public.get_daily_jackpot_draw(p_pool_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_current_user_ticket_count INTEGER := 0;
  v_current_user_viewed_at TIMESTAMPTZ;
  v_participant_count INTEGER := 0;
  v_participants JSONB := '[]'::JSONB;
  v_pool public.daily_jackpot_pools%ROWTYPE;
  v_ticket_count INTEGER := 0;
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Zaloguj się';
  END IF;

  SELECT *
    INTO v_pool
    FROM public.daily_jackpot_pools
   WHERE id = p_pool_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pula Jackpot nie istnieje';
  END IF;

  IF v_pool.status NOT IN ('drawn', 'rolled_over') THEN
    RAISE EXCEPTION 'Losowanie nie jest jeszcze gotowe';
  END IF;

  SELECT COUNT(DISTINCT user_id), COUNT(*)
    INTO v_participant_count, v_ticket_count
    FROM public.daily_jackpot_tickets
   WHERE pool_id = v_pool.id;

  SELECT COUNT(*)
    INTO v_current_user_ticket_count
    FROM public.daily_jackpot_tickets
   WHERE pool_id = v_pool.id
     AND user_id = v_user_id;

  IF v_pool.status = 'rolled_over' AND v_current_user_ticket_count = 0 THEN
    RAISE EXCEPTION 'Rozliczenie tej puli jest dostępne tylko dla uczestników';
  END IF;

  IF v_pool.status = 'rolled_over' AND v_current_user_ticket_count > 0 THEN
    INSERT INTO public.daily_jackpot_draw_views (pool_id, user_id, viewed_at)
    VALUES (v_pool.id, v_user_id, NOW())
    ON CONFLICT (pool_id, user_id) DO NOTHING;

    SELECT viewed_at
      INTO v_current_user_viewed_at
      FROM public.daily_jackpot_draw_views
     WHERE pool_id = v_pool.id
       AND user_id = v_user_id;
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'user_id', participant_rows.user_id,
      'username', COALESCE(profile.username, 'Gracz'),
      'avatar_url', profile.avatar_url,
      'ticket_numbers', participant_rows.ticket_numbers,
      'ticket_count', participant_rows.ticket_count
    )
    ORDER BY participant_rows.first_ticket_number
  ), '[]'::JSONB)
    INTO v_participants
    FROM (
      SELECT
        t.user_id,
        MIN(t.ticket_number) AS first_ticket_number,
        ARRAY_AGG(t.ticket_number ORDER BY t.ticket_number) AS ticket_numbers,
        COUNT(*)::INTEGER AS ticket_count
      FROM public.daily_jackpot_tickets t
      WHERE t.pool_id = v_pool.id
      GROUP BY t.user_id
    ) participant_rows
    JOIN public.profiles profile ON profile.id = participant_rows.user_id;

  RETURN jsonb_build_object(
    'pool_id', v_pool.id,
    'pool_date', v_pool.pool_date,
    'status', v_pool.status,
    'prize_amount', v_pool.prize_amount,
    'ticket_price', v_pool.ticket_price,
    'min_unique_users', v_pool.min_unique_users,
    'participant_count', v_participant_count,
    'ticket_count', v_ticket_count,
    'draw_scheduled_at', v_pool.draw_scheduled_at,
    'drawn_at', v_pool.drawn_at,
    'winner_user_id', NULL,
    'winner_username', NULL,
    'winner_avatar_url', NULL,
    'winning_ticket_number', NULL,
    'current_user_has_ticket', v_current_user_ticket_count > 0,
    'current_user_ticket_count', v_current_user_ticket_count,
    'current_user_is_winner', false,
    'result_viewed_at', COALESCE(v_current_user_viewed_at, v_pool.result_viewed_at),
    'reward_claimed_at', v_pool.reward_claimed_at,
    'reward_auto_credited_at', v_pool.reward_auto_credited_at,
    'reward_credit_status', v_pool.reward_credit_status,
    'reward_credit_event_id', v_pool.reward_credit_event_id,
    'participants', v_participants,
    'server_now', NOW()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_daily_jackpot_state()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
SET lock_timeout = '3s'
AS $$
DECLARE
  v_auto_credited_count INTEGER := 0;
  v_due RECORD;
  v_pending_draw_pool_id UUID;
  v_pool_id UUID;
  v_snapshot JSONB;
  v_today DATE := (timezone('Europe/Warsaw', NOW()))::DATE;
  v_user_id UUID := auth.uid();
  v_visible_pool_date DATE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Zaloguj się';
  END IF;

  v_auto_credited_count :=
    private.auto_credit_unclaimed_daily_jackpot_rewards(v_today);

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

  SELECT p.id
    INTO v_pending_draw_pool_id
    FROM public.daily_jackpot_pools p
   WHERE p.status IN ('drawn', 'rolled_over')
     AND p.pool_date <= v_today
     AND EXISTS (
       SELECT 1
         FROM public.daily_jackpot_tickets t
        WHERE t.pool_id = p.id
          AND t.user_id = v_user_id
     )
     AND NOT EXISTS (
       SELECT 1
         FROM public.daily_jackpot_draw_views viewed
        WHERE viewed.pool_id = p.id
          AND viewed.user_id = v_user_id
     )
     AND NOT (
       p.winner_user_id = v_user_id
       AND p.result_viewed_at IS NOT NULL
     )
   ORDER BY p.pool_date DESC
   LIMIT 1;

  IF v_pending_draw_pool_id IS NOT NULL THEN
    v_snapshot := private.get_daily_jackpot_snapshot(v_pending_draw_pool_id, v_user_id);
    RETURN jsonb_set(v_snapshot, '{maintenance_auto_credited_count}', to_jsonb(v_auto_credited_count), true);
  END IF;

  v_visible_pool_date := v_today;

  IF EXISTS (
    SELECT 1
      FROM public.daily_jackpot_pools p
     WHERE p.pool_date = v_today
       AND p.status IN ('drawn', 'rolled_over', 'cancelled')
       AND p.draw_scheduled_at <= NOW()
  ) THEN
    v_visible_pool_date := v_today + 1;
  END IF;

  v_pool_id := private.sync_daily_jackpot_funding(v_visible_pool_date);

  IF v_pool_id IS NULL THEN
    v_snapshot := private.get_empty_daily_jackpot_snapshot(v_visible_pool_date);
  ELSE
    v_snapshot := private.get_daily_jackpot_snapshot(v_pool_id, v_user_id);
  END IF;

  RETURN jsonb_set(v_snapshot, '{maintenance_auto_credited_count}', to_jsonb(v_auto_credited_count), true);
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

-- Backfill rollover notifications for already-settled pools.
INSERT INTO public.user_notifications (
  user_id,
  type,
  title,
  body,
  link_path,
  metadata
)
SELECT DISTINCT
  t.user_id,
  'jackpot_draw_ready'::public.notification_type,
  'Pula jackpotu przeszła dalej',
  'W tej rundzie było za mało graczy. Ticket został zwrócony, a pula przechodzi na kolejny dzień.',
  '/jackpot/draw/' || p.id::TEXT,
  jsonb_build_object(
    'source', 'daily_jackpot',
    'event', 'rolled_over',
    'pool_id', p.id
  )
FROM public.daily_jackpot_pools p
JOIN public.daily_jackpot_tickets t ON t.pool_id = p.id
WHERE p.status = 'rolled_over'
  AND NOT EXISTS (
    SELECT 1
      FROM public.user_notifications existing
     WHERE existing.user_id = t.user_id
       AND existing.type = 'jackpot_draw_ready'::public.notification_type
       AND existing.metadata ->> 'source' = 'daily_jackpot'
       AND existing.metadata ->> 'event' = 'rolled_over'
       AND existing.metadata ->> 'pool_id' = p.id::TEXT
  );

REVOKE EXECUTE ON FUNCTION public.get_daily_jackpot_draw(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_daily_jackpot_draw(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_daily_jackpot_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_daily_jackpot_state() TO authenticated;
REVOKE ALL ON FUNCTION private.finalize_daily_jackpot_pool(DATE, UUID)
  FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
