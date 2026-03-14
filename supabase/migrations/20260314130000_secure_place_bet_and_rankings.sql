-- Migration: Secure bet placement (atomic) + server-side rankings
-- Created: 2026-03-14

-- ============================================================
-- 1. place_bet_secure() — atomic balance check, deduction,
--    coupon + placed_bets creation in a single transaction.
--    Prevents race conditions and client-side balance manipulation.
-- ============================================================
CREATE OR REPLACE FUNCTION public.place_bet_secure(
  p_user_id     UUID,
  p_total_odds  NUMERIC,
  p_stake       NUMERIC,
  p_items       JSONB  -- array of {betId, selectedOption, odds, stake}
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance    NUMERIC;
  v_coupon_id  UUID;
  v_item       JSONB;
  v_bet_active BOOLEAN;
  v_bet_ended  BOOLEAN;
BEGIN
  -- Validate stake precision (max 2 decimal places) and range
  IF p_stake IS NULL OR p_stake <= 0 THEN
    RAISE EXCEPTION 'Stawka musi być większa od 0';
  END IF;

  IF p_stake <> ROUND(p_stake, 2) THEN
    RAISE EXCEPTION 'Stawka może mieć maksymalnie 2 miejsca po przecinku';
  END IF;

  -- Lock the user's row to prevent concurrent balance modifications
  SELECT balance INTO v_balance
    FROM public.profiles
   WHERE id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono użytkownika';
  END IF;

  IF p_stake > v_balance THEN
    RAISE EXCEPTION 'Niewystarczające środki (saldo: % zł)', ROUND(v_balance, 2);
  END IF;

  -- Validate each item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Validate individual stake precision
    IF (v_item->>'stake')::NUMERIC <> ROUND((v_item->>'stake')::NUMERIC, 2) THEN
      RAISE EXCEPTION 'Stawka zakładu może mieć maksymalnie 2 miejsca po przecinku';
    END IF;

    IF (v_item->>'stake')::NUMERIC <= 0 THEN
      RAISE EXCEPTION 'Stawka każdego zakładu musi być większa od 0';
    END IF;

    -- Verify bet is still active and not ended
    SELECT is_active, (ends_at <= NOW()) INTO v_bet_active, v_bet_ended
      FROM public.bets
     WHERE id = (v_item->>'betId')::UUID;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Zakład nie istnieje';
    END IF;

    IF NOT v_bet_active THEN
      RAISE EXCEPTION 'Zakład jest już zamknięty';
    END IF;

    IF v_bet_ended THEN
      RAISE EXCEPTION 'Czas na obstawianie tego zakładu minął';
    END IF;
  END LOOP;

  -- Deduct balance atomically
  UPDATE public.profiles
     SET balance = ROUND(balance - p_stake, 2)
   WHERE id = p_user_id;

  -- Create coupon
  INSERT INTO public.coupons (user_id, total_odds, stake, status)
  VALUES (p_user_id, p_total_odds, ROUND(p_stake, 2), 'pending')
  RETURNING id INTO v_coupon_id;

  -- Create placed_bets
  INSERT INTO public.placed_bets (user_id, bet_id, selected_option, stake, odds_at_time, coupon_id)
  SELECT
    p_user_id,
    (item->>'betId')::UUID,
    item->>'selectedOption',
    ROUND((item->>'stake')::NUMERIC, 2),
    (item->>'odds')::NUMERIC,
    v_coupon_id
  FROM jsonb_array_elements(p_items) AS item;

  -- Update bet_count on each bet
  UPDATE public.bets
     SET bet_count = bet_count + 1
   WHERE id IN (
     SELECT (item->>'betId')::UUID
       FROM jsonb_array_elements(p_items) AS item
   );

  RETURN v_coupon_id;
END;
$$;

-- ============================================================
-- 2. get_user_rankings() — server-side ranking computation
--    Returns profit, win_rate, total_bets for all users
--    who have placed at least one bet.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_rankings()
RETURNS TABLE (
  id           UUID,
  username     TEXT,
  total_bets   BIGINT,
  won_bets     BIGINT,
  lost_bets    BIGINT,
  win_rate     NUMERIC,
  total_profit NUMERIC,
  balance      NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.username,
    COALESCE(s.total_bets, 0)::BIGINT   AS total_bets,
    COALESCE(s.won_bets, 0)::BIGINT     AS won_bets,
    COALESCE(s.lost_bets, 0)::BIGINT    AS lost_bets,
    CASE
      WHEN COALESCE(s.resolved_bets, 0) > 0
      THEN ROUND((COALESCE(s.won_bets, 0)::NUMERIC / s.resolved_bets) * 100, 1)
      ELSE 0
    END                                  AS win_rate,
    COALESCE(s.total_profit, 0)          AS total_profit,
    p.balance
  FROM public.profiles p
  LEFT JOIN (
    SELECT
      pb.user_id,
      COUNT(*)                                             AS total_bets,
      COUNT(*) FILTER (WHERE pb.result = 'won')            AS won_bets,
      COUNT(*) FILTER (WHERE pb.result = 'lost')           AS lost_bets,
      COUNT(*) FILTER (WHERE pb.result IN ('won', 'lost')) AS resolved_bets,
      ROUND(
        SUM(
          CASE
            WHEN pb.result = 'won' THEN COALESCE(pb.payout, 0) - pb.stake
            WHEN pb.result = 'lost' THEN -pb.stake
            ELSE 0
          END
        ), 2
      ) AS total_profit
    FROM public.placed_bets pb
    GROUP BY pb.user_id
  ) s ON s.user_id = p.id
  WHERE COALESCE(s.total_bets, 0) > 0
  ORDER BY COALESCE(s.total_profit, 0) DESC;
END;
$$;

-- ============================================================
-- 3. secure_daily_topup() — atomic daily top-up with
--    server-side 24h cooldown enforcement.
-- ============================================================
CREATE OR REPLACE FUNCTION public.secure_daily_topup(p_user_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_topup TIMESTAMPTZ;
  v_new_balance NUMERIC;
BEGIN
  -- Lock row
  SELECT last_topup_at INTO v_last_topup
    FROM public.profiles
   WHERE id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono użytkownika';
  END IF;

  IF v_last_topup IS NOT NULL AND (NOW() - v_last_topup) < INTERVAL '24 hours' THEN
    RAISE EXCEPTION 'Już doładowano dzisiaj. Wróć jutro!';
  END IF;

  UPDATE public.profiles
     SET balance = ROUND(balance + 100, 2),
         last_topup_at = NOW()
   WHERE id = p_user_id
   RETURNING balance INTO v_new_balance;

  RETURN v_new_balance;
END;
$$;
