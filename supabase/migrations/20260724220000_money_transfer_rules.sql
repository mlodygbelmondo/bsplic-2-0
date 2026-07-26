-- Single authority for peer-to-peer money transfer rules.
--
-- Before this migration the rule values (14-day account age, 1.00 minimum,
-- 2000-char message, 5 transfers/hour) were authored independently in the
-- create_money_transfer body, the React form, its banner copy, and tests.
-- Now the values live once in private.money_transfer_rules(); enforcement
-- reads them, and clients fetch them via public.get_money_transfer_rules()
-- (the same server-driven pattern the jackpot snapshot uses for
-- ticket_price/min_unique_users). The table CHECK constraints also read this
-- function, retaining defense in depth without duplicating rule values.

CREATE OR REPLACE FUNCTION private.money_transfer_rules()
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT JSONB_BUILD_OBJECT(
    'min_amount', 1.00,
    'max_message_length', 2000,
    'max_transfers_per_hour', 5,
    'min_account_age_days', 14
  );
$$;

REVOKE ALL ON FUNCTION private.money_transfer_rules()
  FROM PUBLIC, anon, authenticated;

ALTER TABLE public.money_transfers
  DROP CONSTRAINT money_transfers_minimum_amount,
  DROP CONSTRAINT money_transfers_message_length,
  ADD CONSTRAINT money_transfers_minimum_amount CHECK (
    amount >= (private.money_transfer_rules()->>'min_amount')::NUMERIC
    AND amount::TEXT NOT IN ('NaN', 'Infinity', '-Infinity')
  ),
  ADD CONSTRAINT money_transfers_message_length CHECK (
    message IS NULL
    OR CHAR_LENGTH(message) <=
      (private.money_transfer_rules()->>'max_message_length')::INTEGER
  );

-- Client-facing rules snapshot, including the caller's own eligibility so the
-- browser never re-derives the account-age rule from profile data.
CREATE OR REPLACE FUNCTION public.get_money_transfer_rules()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_rules JSONB := private.money_transfer_rules();
  v_created_at TIMESTAMPTZ;
  v_eligible_at TIMESTAMPTZ;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Musisz być zalogowany';
  END IF;

  SELECT auth_user.created_at
  INTO v_created_at
  FROM auth.users auth_user
  WHERE auth_user.id = v_user_id;

  IF v_created_at IS NOT NULL THEN
    v_eligible_at := v_created_at
      + MAKE_INTERVAL(days => (v_rules->>'min_account_age_days')::INTEGER);
  END IF;

  RETURN v_rules || JSONB_BUILD_OBJECT(
    'sender_eligible_at', v_eligible_at,
    'sender_eligible', v_eligible_at IS NOT NULL AND v_eligible_at <= NOW(),
    'server_now', NOW()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_money_transfer_rules()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_money_transfer_rules()
  TO authenticated;

-- Redefine enforcement on top of the single rule source. Behavior is
-- unchanged for the current values; only the literals moved.
CREATE OR REPLACE FUNCTION public.create_money_transfer(
  p_recipient_id UUID,
  p_amount NUMERIC,
  p_message TEXT,
  p_idempotency_key UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sender_id UUID := auth.uid();
  v_rules JSONB := private.money_transfer_rules();
  v_min_amount NUMERIC := (v_rules->>'min_amount')::NUMERIC;
  v_min_amount_label TEXT := REPLACE(v_rules->>'min_amount', '.', ',');
  v_max_message_length INTEGER := (v_rules->>'max_message_length')::INTEGER;
  v_max_transfers_per_hour INTEGER := (v_rules->>'max_transfers_per_hour')::INTEGER;
  v_min_account_age_days INTEGER := (v_rules->>'min_account_age_days')::INTEGER;
  v_sender_username TEXT;
  v_recipient_username TEXT;
  v_sender_avatar TEXT;
  v_recipient_avatar TEXT;
  v_sender_balance NUMERIC;
  v_recipient_balance NUMERIC;
  v_sender_created_at TIMESTAMPTZ;
  v_message TEXT := NULLIF(BTRIM(COALESCE(p_message, '')), '');
  v_transfer public.money_transfers%ROWTYPE;
BEGIN
  IF v_sender_id IS NULL THEN
    RAISE EXCEPTION 'Musisz być zalogowany';
  END IF;

  IF p_recipient_id IS NULL OR p_recipient_id = v_sender_id THEN
    RAISE EXCEPTION 'Nie możesz wysłać pieniędzy do siebie';
  END IF;

  IF p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'Brak identyfikatora operacji';
  END IF;

  IF p_amount IS NULL
    OR p_amount::TEXT IN ('NaN', 'Infinity', '-Infinity')
    OR p_amount < v_min_amount
    OR p_amount <> ROUND(p_amount, 2)
  THEN
    RAISE EXCEPTION 'Kwota musi wynosić co najmniej % zł i mieć maksymalnie 2 miejsca po przecinku',
      v_min_amount_label;
  END IF;

  IF v_message IS NOT NULL AND CHAR_LENGTH(v_message) > v_max_message_length THEN
    RAISE EXCEPTION 'Wiadomość może mieć maksymalnie % znaków', v_max_message_length;
  END IF;

  -- A stable lock order prevents deadlocks when two users transfer to each other.
  PERFORM profile.id
  FROM public.profiles profile
  WHERE profile.id IN (v_sender_id, p_recipient_id)
  ORDER BY profile.id
  FOR UPDATE;

  SELECT profile.username, profile.balance, profile.avatar_url
  INTO v_sender_username, v_sender_balance, v_sender_avatar
  FROM public.profiles profile
  WHERE profile.id = v_sender_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono konta nadawcy';
  END IF;

  SELECT profile.username, profile.balance, profile.avatar_url
  INTO v_recipient_username, v_recipient_balance, v_recipient_avatar
  FROM public.profiles profile
  WHERE profile.id = p_recipient_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono odbiorcy';
  END IF;

  SELECT transfer.*
  INTO v_transfer
  FROM public.money_transfers transfer
  WHERE transfer.sender_id = v_sender_id
    AND transfer.idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF v_transfer.recipient_id IS DISTINCT FROM p_recipient_id
      OR v_transfer.amount IS DISTINCT FROM p_amount
      OR v_transfer.message IS DISTINCT FROM v_message
    THEN
      RAISE EXCEPTION 'Identyfikator operacji został już wykorzystany';
    END IF;

    RETURN JSONB_BUILD_OBJECT(
      'id', v_transfer.id,
      'amount', v_transfer.amount,
      'recipient_username', v_transfer.recipient_username_snapshot,
      'balance_after', v_transfer.sender_balance_after,
      'created_at', v_transfer.created_at
    );
  END IF;

  SELECT auth_user.created_at
  INTO v_sender_created_at
  FROM auth.users auth_user
  WHERE auth_user.id = v_sender_id;

  IF v_sender_created_at IS NULL
    OR v_sender_created_at > NOW() - MAKE_INTERVAL(days => v_min_account_age_days)
  THEN
    RAISE EXCEPTION 'Konto nadawcy musi istnieć od co najmniej % dni', v_min_account_age_days;
  END IF;

  IF private.is_agent_profile(v_sender_id)
    OR private.is_agent_profile(p_recipient_id)
    OR EXISTS (
      SELECT 1
      FROM private.transfer_restricted_accounts restricted
      WHERE restricted.user_id IN (v_sender_id, p_recipient_id)
    )
  THEN
    RAISE EXCEPTION 'Transfery są niedostępne dla jednego z tych kont';
  END IF;

  IF v_sender_balance::TEXT IN ('NaN', 'Infinity', '-Infinity')
    OR v_recipient_balance::TEXT IN ('NaN', 'Infinity', '-Infinity')
  THEN
    RAISE EXCEPTION 'Nieprawidłowe saldo konta';
  END IF;

  IF (
    SELECT COUNT(*)
    FROM public.money_transfers transfer
    WHERE transfer.sender_id = v_sender_id
      AND transfer.created_at > NOW() - INTERVAL '1 hour'
  ) >= v_max_transfers_per_hour THEN
    RAISE EXCEPTION 'Możesz wykonać maksymalnie % transferów w ciągu godziny',
      v_max_transfers_per_hour;
  END IF;

  IF v_sender_balance < p_amount THEN
    RAISE EXCEPTION 'Niewystarczające saldo';
  END IF;

  UPDATE public.profiles
  SET balance = balance - p_amount
  WHERE id = v_sender_id;

  UPDATE public.profiles
  SET balance = balance + p_amount
  WHERE id = p_recipient_id;

  INSERT INTO public.money_transfers (
    idempotency_key,
    sender_id,
    recipient_id,
    sender_username_snapshot,
    recipient_username_snapshot,
    sender_avatar_snapshot,
    recipient_avatar_snapshot,
    amount,
    message,
    sender_balance_after,
    recipient_balance_after
  ) VALUES (
    p_idempotency_key,
    v_sender_id,
    p_recipient_id,
    v_sender_username,
    v_recipient_username,
    v_sender_avatar,
    v_recipient_avatar,
    p_amount,
    v_message,
    v_sender_balance - p_amount,
    v_recipient_balance + p_amount
  )
  RETURNING * INTO v_transfer;

  INSERT INTO public.user_notifications (
    user_id,
    actor_user_id,
    type,
    title,
    body,
    link_path,
    metadata
  ) VALUES (
    p_recipient_id,
    v_sender_id,
    'money_transfer'::public.notification_type,
    'Otrzymano ' || REPLACE(p_amount::TEXT, '.', ',')
      || ' zł od @' || v_sender_username,
    v_message,
    '/?wallet=history',
    JSONB_BUILD_OBJECT('transfer_id', v_transfer.id, 'amount', p_amount)
  );

  RETURN JSONB_BUILD_OBJECT(
    'id', v_transfer.id,
    'amount', v_transfer.amount,
    'recipient_username', v_transfer.recipient_username_snapshot,
    'balance_after', v_transfer.sender_balance_after,
    'created_at', v_transfer.created_at
  );
END;
$$;
