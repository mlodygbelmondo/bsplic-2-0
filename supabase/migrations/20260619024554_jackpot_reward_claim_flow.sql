-- Defer daily jackpot reward crediting until replay claim, with automatic
-- fallback credit before the next jackpot cycle.

ALTER TABLE public.daily_jackpot_pools
  ADD COLUMN IF NOT EXISTS result_viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reward_claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reward_auto_credited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reward_credit_status TEXT NOT NULL DEFAULT 'not_applicable',
  ADD COLUMN IF NOT EXISTS reward_credit_event_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'daily_jackpot_pools_reward_credit_status_check'
  ) THEN
    ALTER TABLE public.daily_jackpot_pools
      ADD CONSTRAINT daily_jackpot_pools_reward_credit_status_check
      CHECK (
        reward_credit_status IN (
          'pending',
          'claimed',
          'auto_credited',
          'not_applicable'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'daily_jackpot_pools_reward_credit_event_id_fkey'
  ) THEN
    ALTER TABLE public.daily_jackpot_pools
      ADD CONSTRAINT daily_jackpot_pools_reward_credit_event_id_fkey
      FOREIGN KEY (reward_credit_event_id)
      REFERENCES public.daily_jackpot_events(id);
  END IF;
END
$$;

UPDATE public.daily_jackpot_pools
   SET reward_credit_status = CASE
         WHEN status = 'drawn'
          AND winner_user_id IS NOT NULL
          AND prize_amount > 0
           THEN 'claimed'
         ELSE 'not_applicable'
       END,
       reward_claimed_at = CASE
         WHEN status = 'drawn'
          AND winner_user_id IS NOT NULL
          AND prize_amount > 0
           THEN COALESCE(reward_claimed_at, drawn_at, updated_at)
         ELSE reward_claimed_at
       END
 WHERE reward_credit_status = 'not_applicable';

CREATE INDEX IF NOT EXISTS daily_jackpot_pools_pending_reward_idx
  ON public.daily_jackpot_pools(pool_date, status)
  WHERE reward_credit_status = 'pending'
    AND winner_user_id IS NOT NULL
    AND prize_amount > 0;

CREATE OR REPLACE FUNCTION private.credit_daily_jackpot_reward(
  p_pool_id UUID,
  p_credit_mode TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_already_credited BOOLEAN := false;
  v_balance_after NUMERIC := 0;
  v_event_id UUID;
  v_next_status TEXT;
  v_now TIMESTAMPTZ := NOW();
  v_pool public.daily_jackpot_pools%ROWTYPE;
BEGIN
  IF p_credit_mode NOT IN ('claimed', 'auto_credited') THEN
    RAISE EXCEPTION 'Nieprawidłowy tryb kredytowania Jackpot';
  END IF;

  SELECT *
    INTO v_pool
    FROM public.daily_jackpot_pools
   WHERE id = p_pool_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pula Jackpot nie istnieje';
  END IF;

  IF v_pool.status <> 'drawn'
     OR v_pool.winner_user_id IS NULL
     OR v_pool.prize_amount <= 0 THEN
    RAISE EXCEPTION 'Ta pula Jackpot nie ma nagrody do odebrania';
  END IF;

  IF v_pool.reward_credit_status IN ('claimed', 'auto_credited') THEN
    v_already_credited := true;

    SELECT balance
      INTO v_balance_after
      FROM public.profiles
     WHERE id = v_pool.winner_user_id;

    RETURN jsonb_build_object(
      'pool_id', v_pool.id,
      'amount', v_pool.prize_amount,
      'balance_after', COALESCE(v_balance_after, 0),
      'reward_credit_status', v_pool.reward_credit_status,
      'reward_claimed_at', v_pool.reward_claimed_at,
      'reward_auto_credited_at', v_pool.reward_auto_credited_at,
      'already_credited', v_already_credited
    );
  END IF;

  v_next_status := CASE
    WHEN p_credit_mode = 'auto_credited' THEN 'auto_credited'
    ELSE 'claimed'
  END;

  INSERT INTO public.daily_jackpot_events (pool_id, event_type, payload)
  VALUES (
    v_pool.id,
    CASE
      WHEN p_credit_mode = 'auto_credited'
        THEN 'reward_auto_credited'
      ELSE 'reward_claimed'
    END,
    jsonb_build_object(
      'winner_user_id', v_pool.winner_user_id,
      'amount', v_pool.prize_amount,
      'credit_mode', p_credit_mode
    )
  )
  RETURNING id INTO v_event_id;

  UPDATE public.profiles
     SET balance = ROUND(balance + v_pool.prize_amount, 2)
   WHERE id = v_pool.winner_user_id
   RETURNING balance INTO v_balance_after;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono profilu zwycięzcy';
  END IF;

  UPDATE public.daily_jackpot_pools
     SET reward_credit_status = v_next_status,
         reward_claimed_at = CASE
           WHEN p_credit_mode = 'claimed'
             THEN COALESCE(reward_claimed_at, v_now)
           ELSE reward_claimed_at
         END,
         reward_auto_credited_at = CASE
           WHEN p_credit_mode = 'auto_credited'
             THEN COALESCE(reward_auto_credited_at, v_now)
           ELSE reward_auto_credited_at
         END,
         reward_credit_event_id = v_event_id,
         updated_at = v_now
   WHERE id = v_pool.id
   RETURNING * INTO v_pool;

  RETURN jsonb_build_object(
    'pool_id', v_pool.id,
    'amount', v_pool.prize_amount,
    'balance_after', v_balance_after,
    'reward_credit_status', v_pool.reward_credit_status,
    'reward_claimed_at', v_pool.reward_claimed_at,
    'reward_auto_credited_at', v_pool.reward_auto_credited_at,
    'already_credited', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.auto_credit_unclaimed_daily_jackpot_rewards(
  p_before_date DATE
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_credited_count INTEGER := 0;
  v_pool_id UUID;
BEGIN
  IF p_before_date IS NULL THEN
    RETURN 0;
  END IF;

  FOR v_pool_id IN
    SELECT id
      FROM public.daily_jackpot_pools
     WHERE pool_date < p_before_date
       AND status = 'drawn'
       AND reward_credit_status = 'pending'
       AND winner_user_id IS NOT NULL
       AND prize_amount > 0
     ORDER BY pool_date ASC
  LOOP
    PERFORM private.credit_daily_jackpot_reward(
      v_pool_id,
      'auto_credited'
    );
    v_credited_count := v_credited_count + 1;
  END LOOP;

  RETURN v_credited_count;
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

  IF v_pool.status <> 'drawn' THEN
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
    'result_viewed_at', v_pool.result_viewed_at,
    'reward_claimed_at', v_pool.reward_claimed_at,
    'reward_auto_credited_at', v_pool.reward_auto_credited_at,
    'reward_credit_status', v_pool.reward_credit_status,
    'reward_credit_event_id', v_pool.reward_credit_event_id,
    'participants', v_participants,
    'server_now', NOW()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reveal_daily_jackpot_draw(p_pool_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_current_user_ticket_count INTEGER := 0;
  v_participant_count INTEGER := 0;
  v_participants JSONB := '[]'::JSONB;
  v_pool public.daily_jackpot_pools%ROWTYPE;
  v_ticket_count INTEGER := 0;
  v_user_id UUID := auth.uid();
  v_winner_avatar_url TEXT;
  v_winner_username TEXT;
  v_winning_ticket_number INTEGER;
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

  IF v_pool.status <> 'drawn' THEN
    RAISE EXCEPTION 'Losowanie nie jest jeszcze gotowe';
  END IF;

  IF v_pool.winner_user_id = v_user_id THEN
    UPDATE public.daily_jackpot_pools
       SET result_viewed_at = COALESCE(result_viewed_at, NOW()),
           updated_at = NOW()
     WHERE id = v_pool.id
     RETURNING * INTO v_pool;
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

  SELECT winner.username, winner.avatar_url, winning_ticket.ticket_number
    INTO v_winner_username, v_winner_avatar_url, v_winning_ticket_number
    FROM public.daily_jackpot_pools p
    LEFT JOIN public.profiles winner ON winner.id = p.winner_user_id
    LEFT JOIN public.daily_jackpot_tickets winning_ticket
      ON winning_ticket.id = p.winning_ticket_id
   WHERE p.id = v_pool.id;

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
    'winner_user_id', v_pool.winner_user_id,
    'winner_username', v_winner_username,
    'winner_avatar_url', v_winner_avatar_url,
    'winning_ticket_number', v_winning_ticket_number,
    'current_user_has_ticket', v_current_user_ticket_count > 0,
    'current_user_ticket_count', v_current_user_ticket_count,
    'current_user_is_winner', v_pool.winner_user_id = v_user_id,
    'result_viewed_at', v_pool.result_viewed_at,
    'reward_claimed_at', v_pool.reward_claimed_at,
    'reward_auto_credited_at', v_pool.reward_auto_credited_at,
    'reward_credit_status', v_pool.reward_credit_status,
    'reward_credit_event_id', v_pool.reward_credit_event_id,
    'participants', v_participants,
    'server_now', NOW()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_daily_jackpot_result_viewed(
  p_pool_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_result_viewed_at TIMESTAMPTZ;
  v_user_id UUID := auth.uid();
  v_winner_user_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Zaloguj się';
  END IF;

  SELECT winner_user_id
    INTO v_winner_user_id
    FROM public.daily_jackpot_pools
   WHERE id = p_pool_id
     AND status = 'drawn';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pula Jackpot nie jest gotowa';
  END IF;

  IF v_winner_user_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'Tylko zwycięzca może oznaczyć wynik jako obejrzany';
  END IF;

  UPDATE public.daily_jackpot_pools
     SET result_viewed_at = COALESCE(result_viewed_at, NOW()),
         updated_at = NOW()
   WHERE id = p_pool_id
   RETURNING result_viewed_at INTO v_result_viewed_at;

  RETURN jsonb_build_object(
    'pool_id', p_pool_id,
    'result_viewed_at', v_result_viewed_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_daily_jackpot_reward(p_pool_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_pool public.daily_jackpot_pools%ROWTYPE;
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

  IF v_pool.winner_user_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'To nie jest Twoja nagroda Jackpot';
  END IF;

  IF v_pool.reward_credit_status = 'pending'
     AND v_pool.result_viewed_at IS NULL THEN
    RAISE EXCEPTION 'Obejrzyj wynik Jackpot przed odbiorem nagrody';
  END IF;

  RETURN private.credit_daily_jackpot_reward(p_pool_id, 'claimed');
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

    v_next_pool_id := private.ensure_daily_jackpot_pool(v_pool.pool_date + 1);

    IF v_pool.prize_amount > 0 THEN
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
        ROUND(v_pool.prize_amount, 2),
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

CREATE OR REPLACE FUNCTION public.finalize_daily_jackpot_if_due()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_snapshot_user_id UUID := auth.uid();
  v_target_date DATE;
  v_today DATE := (timezone('Europe/Warsaw', NOW()))::DATE;
BEGIN
  IF v_snapshot_user_id IS NULL AND COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Zaloguj się';
  END IF;

  IF v_snapshot_user_id IS NOT NULL
     AND NOT public.has_role(v_snapshot_user_id, 'admin') THEN
    RAISE EXCEPTION 'Brak uprawnień administratora';
  END IF;

  PERFORM private.auto_credit_unclaimed_daily_jackpot_rewards(v_today);

  SELECT pool_date
    INTO v_target_date
    FROM public.daily_jackpot_pools
   WHERE status IN ('collecting', 'locked')
     AND draw_scheduled_at <= NOW()
   ORDER BY pool_date ASC
   LIMIT 1;

  IF v_target_date IS NULL THEN
    RETURN private.get_empty_daily_jackpot_snapshot(v_today);
  END IF;

  RETURN private.finalize_daily_jackpot_pool(v_target_date, v_snapshot_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_daily_jackpot()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
SET lock_timeout = '3s'
AS $$
DECLARE
  v_due RECORD;
  v_pool_id UUID;
  v_snapshot_user_id UUID := auth.uid();
  v_today DATE := (timezone('Europe/Warsaw', NOW()))::DATE;
BEGIN
  IF v_snapshot_user_id IS NULL
     AND COALESCE(auth.role(), '') NOT IN ('', 'service_role') THEN
    RAISE EXCEPTION 'Zaloguj się';
  END IF;

  IF v_snapshot_user_id IS NOT NULL
     AND NOT public.has_role(v_snapshot_user_id, 'admin') THEN
    RAISE EXCEPTION 'Brak uprawnień administratora';
  END IF;

  PERFORM private.auto_credit_unclaimed_daily_jackpot_rewards(v_today);

  v_pool_id := private.sync_daily_jackpot_funding(v_today);

  FOR v_due IN
    SELECT pool_date
      FROM public.daily_jackpot_pools
     WHERE status IN ('collecting', 'locked')
       AND draw_scheduled_at <= NOW()
     ORDER BY pool_date ASC
     LIMIT 5
  LOOP
    PERFORM private.finalize_daily_jackpot_pool(v_due.pool_date, v_snapshot_user_id);
  END LOOP;

  SELECT id
    INTO v_pool_id
    FROM public.daily_jackpot_pools
   WHERE pool_date = v_today;

  RETURN private.get_daily_jackpot_snapshot(v_pool_id, v_snapshot_user_id);
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
  v_due RECORD;
  v_pool_id UUID;
  v_today DATE := (timezone('Europe/Warsaw', NOW()))::DATE;
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Zaloguj się';
  END IF;

  PERFORM private.auto_credit_unclaimed_daily_jackpot_rewards(v_today);

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

REVOKE EXECUTE ON FUNCTION public.get_daily_jackpot_draw(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reveal_daily_jackpot_draw(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_daily_jackpot_result_viewed(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_daily_jackpot_reward(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.credit_daily_jackpot_reward(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.auto_credit_unclaimed_daily_jackpot_rewards(DATE) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_daily_jackpot_draw(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reveal_daily_jackpot_draw(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_daily_jackpot_reward(UUID) TO authenticated;
