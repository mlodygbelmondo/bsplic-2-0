-- Consolidate the Jackpot Dnia lifecycle into one canonical migration.
--
-- Until now the current behavior of the lifecycle lived in whichever of four
-- scattered migrations was newest per function (snapshot builders in
-- 20260621043000, buy in 20260622193419, state/draw in 20260626111656, sync
-- in 20260629134419, finalize in 20260722230000). This migration re-declares
-- all of them verbatim so the newest migration IS the current definition, and
-- mirror copies live under supabase/schema/daily_jackpot/ for reading.
-- A test (jackpotLifecycleConsolidation.test.ts) keeps the mirror honest.
--
-- Behavior is unchanged, with one reconciliation: the per-player ticket limit
-- was authored twice as a literal `2` (snapshot payload and the buy guard).
-- Both now read private.daily_jackpot_rules(), the single authority.
--
-- Deliberately kept: public.get_daily_jackpot_state() still syncs funding and
-- finalizes due pools on read. The pg_cron job (maintain_daily_jackpot, every
-- 5 minutes) is only a backstop; the read-trigger is what makes the 20:00
-- draw visible immediately to the polling client.

CREATE OR REPLACE FUNCTION private.daily_jackpot_rules()
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT JSONB_BUILD_OBJECT(
    'max_tickets_per_player', 2,
    'default_ticket_price', 100,
    'default_min_unique_users', 3
  );
$$;

REVOKE ALL ON FUNCTION private.daily_jackpot_rules()
  FROM PUBLIC, anon, authenticated;

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
  v_max_tickets_per_player INTEGER :=
    (private.daily_jackpot_rules()->>'max_tickets_per_player')::INTEGER;
  v_snapshot JSONB;
BEGIN
  SELECT jsonb_build_object(
    'pool_id', p.id,
    'pool_date', p.pool_date,
    'status', p.status,
    'prize_amount', p.prize_amount,
    'ticket_price', p.ticket_price,
    'max_tickets_per_player', v_max_tickets_per_player,
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
    'current_user_ticket_numbers', COALESCE((
      SELECT jsonb_agg(t.ticket_number ORDER BY t.ticket_number)
        FROM public.daily_jackpot_tickets t
       WHERE t.pool_id = p.id
         AND t.user_id = p_user_id
    ), '[]'::jsonb),
    'winner_user_id', NULL,
    'winner_username', NULL,
    'winner_avatar_url', NULL,
    'winning_ticket_number', NULL,
    'result_viewed_at', NULL,
    'reward_claimed_at', NULL,
    'reward_auto_credited_at', NULL,
    'reward_credit_status', 'not_applicable',
    'reward_credit_event_id', NULL,
    'maintenance_auto_credited_count', 0,
    'server_now', NOW()
  )
    INTO v_snapshot
    FROM public.daily_jackpot_pools p
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
    'ticket_price', (private.daily_jackpot_rules()->>'default_ticket_price')::NUMERIC,
    'max_tickets_per_player', (private.daily_jackpot_rules()->>'max_tickets_per_player')::INTEGER,
    'min_unique_users', (private.daily_jackpot_rules()->>'default_min_unique_users')::INTEGER,
    'participant_count', 0,
    'ticket_count', 0,
    'draw_scheduled_at', public.get_warsaw_draw_at(p_pool_date),
    'current_user_has_ticket', false,
    'current_user_ticket_count', 0,
    'current_user_ticket_number', NULL,
    'current_user_ticket_numbers', '[]'::jsonb,
    'winner_user_id', NULL,
    'winner_username', NULL,
    'winner_avatar_url', NULL,
    'winning_ticket_number', NULL,
    'result_viewed_at', NULL,
    'reward_claimed_at', NULL,
    'reward_auto_credited_at', NULL,
    'reward_credit_status', 'not_applicable',
    'reward_credit_event_id', NULL,
    'maintenance_auto_credited_count', 0,
    'server_now', NOW()
  );
$$;

CREATE OR REPLACE FUNCTION private.sync_daily_jackpot_funding(p_pool_date DATE)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_pool public.daily_jackpot_pools%ROWTYPE;
  v_pool_id UUID;
  v_season_started_at TIMESTAMPTZ := private.get_active_season_started_at();
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
          AND COALESCE(c.settled_at, c.created_at) >= v_season_started_at
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
    AND COALESCE(c.settled_at, c.created_at) >= v_season_started_at
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

REVOKE ALL ON FUNCTION private.get_daily_jackpot_snapshot(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.get_empty_daily_jackpot_snapshot(DATE)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.sync_daily_jackpot_funding(DATE)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.finalize_daily_jackpot_pool(DATE, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.buy_daily_jackpot_ticket(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buy_daily_jackpot_ticket(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_daily_jackpot_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_daily_jackpot_state() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_daily_jackpot_draw(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_daily_jackpot_draw(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
