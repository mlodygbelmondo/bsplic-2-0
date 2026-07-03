-- Harden client-writable tables so users can only reach validated application flows.

CREATE OR REPLACE FUNCTION public.secure_daily_topup(p_user_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_topup   TIMESTAMPTZ;
  v_new_balance  NUMERIC;
  v_today_pl     DATE;
  v_last_pl      DATE;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Brak dostępu do doładowania';
  END IF;

  SELECT last_topup_at INTO v_last_topup
    FROM public.profiles
   WHERE id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono użytkownika';
  END IF;

  v_today_pl := (NOW() AT TIME ZONE 'Europe/Warsaw')::DATE;

  IF v_last_topup IS NOT NULL THEN
    v_last_pl := (v_last_topup AT TIME ZONE 'Europe/Warsaw')::DATE;

    IF v_today_pl <= v_last_pl THEN
      RAISE EXCEPTION 'Już doładowano dzisiaj. Wróć jutro!';
    END IF;
  END IF;

  UPDATE public.profiles
     SET balance = ROUND(balance + 100, 2),
         last_topup_at = NOW()
   WHERE id = p_user_id
   RETURNING balance INTO v_new_balance;

  RETURN v_new_balance;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.secure_daily_topup(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.secure_daily_topup(UUID) TO authenticated;

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
REVOKE INSERT, UPDATE ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
GRANT UPDATE (avatar_url) ON TABLE public.profiles TO authenticated;

DROP POLICY IF EXISTS "Users can insert own placed bets" ON public.placed_bets;
DROP POLICY IF EXISTS "Users can insert own coupons" ON public.coupons;
REVOKE INSERT ON TABLE public.placed_bets FROM PUBLIC, anon, authenticated;
REVOKE INSERT ON TABLE public.coupons FROM PUBLIC, anon, authenticated;

ALTER TABLE public.bet_proposals
  ALTER COLUMN proposal_source SET DEFAULT 'human',
  ALTER COLUMN agent_metadata SET DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.normalize_direct_human_bet_proposal_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    NEW.status := 'pending';
    NEW.proposal_source := 'human';
    NEW.agent_metadata := '{}'::jsonb;
    NEW.agent_duplicate_key := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_direct_human_bet_proposal_insert
  ON public.bet_proposals;
CREATE TRIGGER trg_normalize_direct_human_bet_proposal_insert
  BEFORE INSERT ON public.bet_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_direct_human_bet_proposal_insert();

REVOKE INSERT ON TABLE public.bet_proposals FROM PUBLIC, anon, authenticated;
GRANT INSERT (
  user_id,
  title,
  category_id,
  bet_type,
  options,
  ends_at,
  proposal_source,
  agent_metadata,
  agent_duplicate_key
)
  ON TABLE public.bet_proposals
  TO authenticated;

CREATE OR REPLACE FUNCTION public.create_casino_social_share(
  p_user_id UUID,
  p_roulette_bet_id UUID,
  p_content TEXT,
  p_casino_bet_type TEXT,
  p_casino_bet_value TEXT,
  p_casino_stake NUMERIC,
  p_casino_payout NUMERIC,
  p_casino_round_number INTEGER DEFAULT NULL,
  p_casino_winning_number INTEGER DEFAULT NULL,
  p_casino_winning_color TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bet_payout NUMERIC;
  v_bet_stake NUMERIC;
  v_bet_type TEXT;
  v_bet_value TEXT;
  v_content TEXT;
  v_round_number BIGINT;
  v_share_id UUID;
  v_winning_color TEXT;
  v_winning_number INTEGER;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Nie możesz udostępnić wygranej innego użytkownika';
  END IF;

  IF p_roulette_bet_id IS NULL THEN
    RAISE EXCEPTION 'Możesz udostępnić tylko zweryfikowaną wygraną';
  END IF;

  v_content := TRIM(COALESCE(p_content, ''));

  IF char_length(v_content) = 0 THEN
    RAISE EXCEPTION 'Treść udostępnienia nie może być pusta';
  END IF;
  IF char_length(v_content) > 500 THEN
    RAISE EXCEPTION 'Udostępnienie może mieć maksymalnie 500 znaków';
  END IF;

  SELECT b.bet_type, b.bet_value, b.stake, b.payout,
         r.round_number, r.winning_number, r.winning_color
    INTO v_bet_type, v_bet_value, v_bet_stake, v_bet_payout,
         v_round_number, v_winning_number, v_winning_color
    FROM public.casino_roulette_bets AS b
    JOIN public.casino_roulette_rounds AS r ON r.id = b.round_id
   WHERE b.id = p_roulette_bet_id
     AND b.user_id = p_user_id
     AND b.is_win IS TRUE
     AND b.payout > 0
     AND b.settled_at IS NOT NULL
     AND r.phase = 'settled'
     AND r.winning_number IS NOT NULL
     AND r.winning_color IS NOT NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Możesz udostępnić tylko własną wygraną';
  END IF;

  INSERT INTO public.casino_social_shares (
    user_id,
    roulette_bet_id,
    content,
    casino_bet_type,
    casino_bet_value,
    casino_stake,
    casino_payout,
    casino_round_number,
    casino_winning_number,
    casino_winning_color
  )
  VALUES (
    p_user_id,
    p_roulette_bet_id,
    v_content,
    v_bet_type,
    v_bet_value,
    ROUND(v_bet_stake, 2),
    ROUND(v_bet_payout, 2),
    v_round_number::INTEGER,
    v_winning_number,
    v_winning_color
  )
  ON CONFLICT (roulette_bet_id) WHERE (roulette_bet_id IS NOT NULL) DO UPDATE
    SET content = EXCLUDED.content,
        casino_bet_type = EXCLUDED.casino_bet_type,
        casino_bet_value = EXCLUDED.casino_bet_value,
        casino_stake = EXCLUDED.casino_stake,
        casino_payout = EXCLUDED.casino_payout,
        casino_round_number = EXCLUDED.casino_round_number,
        casino_winning_number = EXCLUDED.casino_winning_number,
        casino_winning_color = EXCLUDED.casino_winning_color
  RETURNING id INTO v_share_id;

  RETURN v_share_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_casino_social_share(UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, INTEGER, INTEGER, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_casino_social_share(UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, INTEGER, INTEGER, TEXT)
  TO authenticated;

DROP POLICY IF EXISTS "Users can insert own casino social shares" ON public.casino_social_shares;
REVOKE INSERT ON TABLE public.casino_social_shares FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Users insert own feature poll votes" ON public.feature_poll_votes;
REVOKE INSERT ON TABLE public.feature_poll_votes FROM PUBLIC, anon, authenticated;
