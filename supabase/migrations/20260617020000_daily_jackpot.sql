-- Daily Jackpot MVP: idempotent funding, ticket purchase, draw, refund, rollover.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE SCHEMA IF NOT EXISTS private;

ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;

UPDATE public.coupons
   SET settled_at = COALESCE(settled_at, created_at)
 WHERE status IN ('won', 'lost', 'refund')
   AND settled_at IS NULL;

CREATE OR REPLACE FUNCTION public.resolve_coupon_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total BIGINT;
  v_resolved BIGINT;
  v_lost BIGINT;
  v_refund BIGINT;
  v_stake NUMERIC;
  v_odds NUMERIC;
BEGIN
  IF NEW.coupon_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*),
         count(*) FILTER (WHERE result IN ('won', 'lost', 'refund')),
         count(*) FILTER (WHERE result = 'lost'),
         count(*) FILTER (WHERE result = 'refund')
    INTO v_total, v_resolved, v_lost, v_refund
    FROM public.placed_bets
   WHERE coupon_id = NEW.coupon_id;

  IF v_lost > 0 THEN
    UPDATE public.coupons
       SET status = 'lost',
           payout = 0,
           settled_at = COALESCE(settled_at, NOW())
     WHERE id = NEW.coupon_id;
    RETURN NEW;
  END IF;

  IF v_resolved = v_total THEN
    SELECT stake, total_odds
      INTO v_stake, v_odds
      FROM public.coupons
     WHERE id = NEW.coupon_id;

    IF v_refund = v_total THEN
      UPDATE public.coupons
         SET status = 'refund',
             payout = ROUND(v_stake, 2),
             settled_at = COALESCE(settled_at, NOW())
       WHERE id = NEW.coupon_id;
    ELSE
      UPDATE public.coupons
         SET status = 'won',
             payout = ROUND(v_stake * v_odds, 2),
             settled_at = COALESCE(settled_at, NOW())
       WHERE id = NEW.coupon_id;
    END IF;
  ELSE
    UPDATE public.coupons
       SET status = 'pending',
           payout = 0,
           settled_at = NULL
     WHERE id = NEW.coupon_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TABLE public.daily_jackpot_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_date DATE NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'collecting'
    CHECK (status IN ('collecting', 'locked', 'drawn', 'rolled_over', 'cancelled')),
  prize_amount NUMERIC NOT NULL DEFAULT 0 CHECK (prize_amount >= 0),
  min_unique_users INTEGER NOT NULL DEFAULT 3 CHECK (min_unique_users > 0),
  ticket_price NUMERIC NOT NULL DEFAULT 5 CHECK (ticket_price >= 0),
  draw_scheduled_at TIMESTAMPTZ NOT NULL,
  locked_at TIMESTAMPTZ,
  drawn_at TIMESTAMPTZ,
  winner_user_id UUID REFERENCES public.profiles(id),
  winning_ticket_id UUID,
  rollover_from_pool_id UUID REFERENCES public.daily_jackpot_pools(id),
  entropy_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.daily_jackpot_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES public.daily_jackpot_pools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ticket_number INTEGER NOT NULL,
  price NUMERIC NOT NULL CHECK (price >= 0),
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  refunded_at TIMESTAMPTZ,
  UNIQUE(pool_id, user_id),
  UNIQUE(pool_id, ticket_number)
);

ALTER TABLE public.daily_jackpot_pools
  ADD CONSTRAINT daily_jackpot_pools_winning_ticket_id_fkey
  FOREIGN KEY (winning_ticket_id) REFERENCES public.daily_jackpot_tickets(id);

CREATE TABLE public.daily_jackpot_funding_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES public.daily_jackpot_pools(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('lost_coupon', 'rollover', 'ticket_fee')),
  coupon_id UUID REFERENCES public.coupons(id),
  source_pool_id UUID REFERENCES public.daily_jackpot_pools(id),
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  source_day DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.daily_jackpot_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID REFERENCES public.daily_jackpot_pools(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX daily_jackpot_funding_lost_coupon_unique
  ON public.daily_jackpot_funding_entries(coupon_id)
  WHERE source_type = 'lost_coupon' AND coupon_id IS NOT NULL;

CREATE UNIQUE INDEX daily_jackpot_funding_rollover_source_unique
  ON public.daily_jackpot_funding_entries(source_pool_id)
  WHERE source_type = 'rollover' AND source_pool_id IS NOT NULL;

CREATE INDEX daily_jackpot_tickets_pool_id_idx
  ON public.daily_jackpot_tickets(pool_id);

CREATE INDEX daily_jackpot_tickets_user_id_idx
  ON public.daily_jackpot_tickets(user_id);

CREATE INDEX daily_jackpot_funding_entries_pool_id_idx
  ON public.daily_jackpot_funding_entries(pool_id);

CREATE INDEX daily_jackpot_pools_status_draw_idx
  ON public.daily_jackpot_pools(status, draw_scheduled_at);

ALTER TABLE public.daily_jackpot_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_jackpot_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_jackpot_funding_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_jackpot_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read jackpot pools"
  ON public.daily_jackpot_pools
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can read own jackpot tickets"
  ON public.daily_jackpot_tickets
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can read jackpot funding"
  ON public.daily_jackpot_funding_entries
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can read jackpot events"
  ON public.daily_jackpot_events
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.get_warsaw_draw_at(p_pool_date DATE)
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
AS $$
  SELECT (p_pool_date::TEXT || ' 20:00:00 Europe/Warsaw')::TIMESTAMPTZ;
$$;

CREATE OR REPLACE FUNCTION private.ensure_daily_jackpot_pool(p_pool_date DATE)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_pool_id UUID;
BEGIN
  INSERT INTO public.daily_jackpot_pools (pool_date, draw_scheduled_at)
  VALUES (p_pool_date, public.get_warsaw_draw_at(p_pool_date))
  ON CONFLICT (pool_date) DO NOTHING
  RETURNING id INTO v_pool_id;

  IF v_pool_id IS NULL THEN
    SELECT id
      INTO v_pool_id
      FROM public.daily_jackpot_pools
     WHERE pool_date = p_pool_date;
  END IF;

  RETURN v_pool_id;
END;
$$;

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
    'current_user_ticket_number', (
      SELECT t.ticket_number
        FROM public.daily_jackpot_tickets t
       WHERE t.pool_id = p.id
         AND t.user_id = p_user_id
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
BEGIN
  v_pool_id := private.ensure_daily_jackpot_pool(p_pool_date);

  SELECT *
    INTO v_pool
    FROM public.daily_jackpot_pools
   WHERE id = v_pool_id
   FOR UPDATE;

  IF v_pool.status <> 'collecting' THEN
    RETURN v_pool_id;
  END IF;

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
    ROUND(c.stake, 2),
    v_source_day
  FROM public.coupons c
  WHERE c.status = 'lost'
    AND ROUND(c.stake, 2) > 0
    AND (timezone('Europe/Warsaw', COALESCE(c.settled_at, c.created_at)))::DATE = v_source_day
  ON CONFLICT DO NOTHING;

  UPDATE public.daily_jackpot_pools p
     SET prize_amount = ROUND(COALESCE((
           SELECT SUM(amount)
             FROM public.daily_jackpot_funding_entries f
            WHERE f.pool_id = p.id
         ), 0), 2),
         updated_at = NOW()
   WHERE p.id = v_pool.id;

  RETURN v_pool.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_daily_jackpot_if_due(
  p_pool_date DATE DEFAULT NULL
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
  v_pool public.daily_jackpot_pools%ROWTYPE;
  v_pool_id UUID;
  v_target_date DATE;
  v_ticket_count INTEGER;
  v_winner_offset INTEGER;
  v_winning_ticket public.daily_jackpot_tickets%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Zaloguj się';
  END IF;

  IF p_pool_date IS NULL THEN
    SELECT pool_date
      INTO v_target_date
      FROM public.daily_jackpot_pools
     WHERE status IN ('collecting', 'locked')
       AND draw_scheduled_at <= v_now
     ORDER BY pool_date ASC
     LIMIT 1;

    IF v_target_date IS NULL THEN
      v_target_date := (timezone('Europe/Warsaw', v_now))::DATE;
    END IF;
  ELSE
    v_target_date := p_pool_date;
  END IF;

  v_pool_id := private.ensure_daily_jackpot_pool(v_target_date);

  SELECT *
    INTO v_pool
    FROM public.daily_jackpot_pools
   WHERE id = v_pool_id
   FOR UPDATE;

  IF v_pool.status IN ('drawn', 'rolled_over', 'cancelled') THEN
    RETURN private.get_daily_jackpot_snapshot(v_pool.id, auth.uid());
  END IF;

  IF v_now < v_pool.draw_scheduled_at THEN
    RETURN private.get_daily_jackpot_snapshot(v_pool.id, auth.uid());
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

    RETURN private.get_daily_jackpot_snapshot(v_pool.id, auth.uid());
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

  UPDATE public.profiles
     SET balance = ROUND(balance + v_pool.prize_amount, 2)
   WHERE id = v_winning_ticket.user_id;

  UPDATE public.daily_jackpot_pools
     SET status = 'drawn',
         drawn_at = v_now,
         winner_user_id = v_winning_ticket.user_id,
         winning_ticket_id = v_winning_ticket.id,
         entropy_hash = v_entropy_hash,
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

  RETURN private.get_daily_jackpot_snapshot(v_pool.id, auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.get_daily_jackpot_state()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_due RECORD;
  v_pool_id UUID;
  v_today DATE := (timezone('Europe/Warsaw', NOW()))::DATE;
BEGIN
  IF auth.uid() IS NULL THEN
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
    PERFORM public.finalize_daily_jackpot_if_due(v_due.pool_date);
  END LOOP;

  SELECT id
    INTO v_pool_id
    FROM public.daily_jackpot_pools
   WHERE pool_date = v_today;

  RETURN private.get_daily_jackpot_snapshot(v_pool_id, auth.uid());
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
  v_next_ticket_number INTEGER;
  v_pool public.daily_jackpot_pools%ROWTYPE;
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

  IF v_pool.status <> 'collecting' THEN
    RAISE EXCEPTION 'Ta pula nie przyjmuje już ticketów';
  END IF;

  IF v_pool.prize_amount <= 0 THEN
    RAISE EXCEPTION 'Brak aktywnej puli Jackpot';
  END IF;

  IF NOW() >= v_pool.draw_scheduled_at THEN
    RAISE EXCEPTION 'Losowanie już trwa';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.daily_jackpot_tickets
     WHERE pool_id = v_pool.id
       AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Masz już ticket w tej puli';
  END IF;

  SELECT balance
    INTO v_balance
    FROM public.profiles
   WHERE id = v_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono profilu';
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
    RAISE EXCEPTION 'Masz już ticket w tej puli';
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_finalize_daily_jackpot(p_pool_date DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Brak uprawnień administratora';
  END IF;

  RETURN public.finalize_daily_jackpot_if_due(p_pool_date);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_warsaw_draw_at(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_daily_jackpot_state() TO authenticated;
GRANT EXECUTE ON FUNCTION public.buy_daily_jackpot_ticket(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_daily_jackpot_if_due(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_finalize_daily_jackpot(DATE) TO authenticated;
