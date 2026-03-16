-- Migration: Fix daily topup to use Polish calendar day (Europe/Warsaw)
-- instead of rolling 24-hour window.
-- Created: 2026-03-16
--
-- Problem: User at 00:56 Polish time couldn't claim because the old
-- function checks NOW() - last_topup < 24h. If they claimed at e.g.
-- 01:30 the previous day, 00:56 is only ~23h26m later → blocked.
--
-- Fix: Compare calendar dates in Europe/Warsaw timezone. If today's
-- Polish date is different from the last topup's Polish date, allow.

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
  -- Lock row
  SELECT last_topup_at INTO v_last_topup
    FROM public.profiles
   WHERE id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono użytkownika';
  END IF;

  -- Compare calendar days in Polish timezone
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
