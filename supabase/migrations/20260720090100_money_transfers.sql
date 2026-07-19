-- Private account restrictions managed by database administrators.
CREATE TABLE private.transfer_restricted_accounts (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE private.transfer_restricted_accounts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE private.transfer_restricted_accounts
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE private.transfer_restricted_accounts
  TO service_role;

COMMENT ON TABLE private.transfer_restricted_accounts IS
  'Accounts that cannot send or receive peer-to-peer money transfers.';

-- Append-only ledger. User-facing reads and all writes go through guarded RPCs.
CREATE TABLE public.money_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key UUID NOT NULL,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  recipient_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  sender_username_snapshot TEXT NOT NULL,
  recipient_username_snapshot TEXT NOT NULL,
  sender_avatar_snapshot TEXT,
  recipient_avatar_snapshot TEXT,
  amount NUMERIC NOT NULL,
  message TEXT,
  sender_balance_after NUMERIC NOT NULL,
  recipient_balance_after NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT money_transfers_different_accounts
    CHECK (sender_id IS NULL OR recipient_id IS NULL OR sender_id <> recipient_id),
  CONSTRAINT money_transfers_minimum_amount
    CHECK (
      amount >= 1
      AND amount::TEXT NOT IN ('NaN', 'Infinity', '-Infinity')
    ),
  CONSTRAINT money_transfers_cent_precision
    CHECK (amount = ROUND(amount, 2)),
  CONSTRAINT money_transfers_message_length
    CHECK (message IS NULL OR CHAR_LENGTH(message) <= 2000),
  CONSTRAINT money_transfers_finite_balance_snapshots
    CHECK (
      sender_balance_after::TEXT NOT IN ('NaN', 'Infinity', '-Infinity')
      AND recipient_balance_after::TEXT NOT IN ('NaN', 'Infinity', '-Infinity')
    ),
  CONSTRAINT money_transfers_sender_idempotency
    UNIQUE (sender_id, idempotency_key)
);

CREATE INDEX idx_money_transfers_sender_created
  ON public.money_transfers (sender_id, created_at DESC);
CREATE INDEX idx_money_transfers_recipient_created
  ON public.money_transfers (recipient_id, created_at DESC);

ALTER TABLE public.money_transfers ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.money_transfers
  FROM PUBLIC, anon, authenticated;

-- RLS is row-scoped, not column-scoped. Restrict browser updates to the only
-- profile field that the application currently lets a user change.
REVOKE UPDATE ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
GRANT UPDATE (avatar_url) ON TABLE public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.search_money_transfer_recipients(
  p_query TEXT,
  p_limit INTEGER DEFAULT 8
)
RETURNS TABLE (
  id UUID,
  username TEXT,
  avatar_url TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_query TEXT := BTRIM(COALESCE(p_query, ''));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Musisz być zalogowany';
  END IF;

  IF CHAR_LENGTH(v_query) < 2 THEN
    RETURN;
  END IF;

  IF private.is_agent_profile(v_user_id)
    OR EXISTS (
      SELECT 1
      FROM private.transfer_restricted_accounts restricted
      WHERE restricted.user_id = v_user_id
    )
  THEN
    RAISE EXCEPTION 'Transfery są niedostępne dla tego konta';
  END IF;

  RETURN QUERY
  SELECT profile.id, profile.username, profile.avatar_url
  FROM public.profiles profile
  WHERE profile.id <> v_user_id
    AND STRPOS(LOWER(profile.username), LOWER(v_query)) > 0
    AND NOT private.is_agent_profile(profile.id)
    AND NOT EXISTS (
      SELECT 1
      FROM private.transfer_restricted_accounts restricted
      WHERE restricted.user_id = profile.id
    )
  ORDER BY
    CASE WHEN LOWER(profile.username) = LOWER(v_query) THEN 0 ELSE 1 END,
    CASE WHEN LOWER(profile.username) LIKE LOWER(v_query) || '%' THEN 0 ELSE 1 END,
    profile.username
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 8), 1), 8);
END;
$$;

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
    OR p_amount < 1
    OR p_amount <> ROUND(p_amount, 2)
  THEN
    RAISE EXCEPTION 'Kwota musi wynosić co najmniej 1,00 zł i mieć maksymalnie 2 miejsca po przecinku';
  END IF;

  IF v_message IS NOT NULL AND CHAR_LENGTH(v_message) > 2000 THEN
    RAISE EXCEPTION 'Wiadomość może mieć maksymalnie 2000 znaków';
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
    OR v_sender_created_at > NOW() - INTERVAL '14 days'
  THEN
    RAISE EXCEPTION 'Konto nadawcy musi istnieć od co najmniej 14 dni';
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
  ) >= 5 THEN
    RAISE EXCEPTION 'Możesz wykonać maksymalnie 5 transferów w ciągu godziny';
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

CREATE OR REPLACE FUNCTION public.get_money_transfer_history(
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  direction TEXT,
  counterparty_id UUID,
  counterparty_username TEXT,
  counterparty_avatar_url TEXT,
  counterparty_deleted BOOLEAN,
  amount NUMERIC,
  message TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Musisz być zalogowany';
  END IF;

  RETURN QUERY
  SELECT
    transfer.id,
    CASE WHEN transfer.sender_id = v_user_id THEN 'sent' ELSE 'received' END,
    CASE
      WHEN transfer.sender_id = v_user_id THEN transfer.recipient_id
      ELSE transfer.sender_id
    END,
    CASE
      WHEN transfer.sender_id = v_user_id THEN transfer.recipient_username_snapshot
      ELSE transfer.sender_username_snapshot
    END,
    CASE
      WHEN transfer.sender_id = v_user_id THEN transfer.recipient_avatar_snapshot
      ELSE transfer.sender_avatar_snapshot
    END,
    counterparty.id IS NULL,
    transfer.amount,
    transfer.message,
    transfer.created_at
  FROM public.money_transfers transfer
  LEFT JOIN public.profiles counterparty
    ON counterparty.id = CASE
      WHEN transfer.sender_id = v_user_id THEN transfer.recipient_id
      ELSE transfer.sender_id
    END
  WHERE transfer.sender_id = v_user_id
    OR transfer.recipient_id = v_user_id
  ORDER BY transfer.created_at DESC, transfer.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

REVOKE ALL ON FUNCTION public.search_money_transfer_recipients(TEXT, INTEGER)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_money_transfer(UUID, NUMERIC, TEXT, UUID)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_money_transfer_history(INTEGER, INTEGER)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.search_money_transfer_recipients(TEXT, INTEGER)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_money_transfer(UUID, NUMERIC, TEXT, UUID)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_money_transfer_history(INTEGER, INTEGER)
  TO authenticated;
