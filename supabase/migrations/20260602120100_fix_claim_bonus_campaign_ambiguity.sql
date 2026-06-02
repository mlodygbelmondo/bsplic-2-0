CREATE OR REPLACE FUNCTION public.claim_bonus_campaign(p_campaign_id UUID)
RETURNS TABLE (
  campaign_id UUID,
  amount NUMERIC,
  balance_after NUMERIC,
  claimed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_campaign public.bonus_campaigns%ROWTYPE;
  v_new_balance NUMERIC;
  v_claimed_at TIMESTAMPTZ := NOW();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Musisz być zalogowany';
  END IF;

  IF p_campaign_id IS NULL THEN
    RAISE EXCEPTION 'Nieprawidłowa kampania';
  END IF;

  SELECT campaign.*
    INTO v_campaign
    FROM public.bonus_campaigns AS campaign
   WHERE campaign.id = p_campaign_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono kampanii';
  END IF;

  IF v_campaign.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Kampania nie jest aktywna';
  END IF;

  IF NOW() < v_campaign.starts_at THEN
    RAISE EXCEPTION 'Kampania jeszcze się nie rozpoczęła';
  END IF;

  IF NOW() >= v_campaign.expires_at THEN
    RAISE EXCEPTION 'Kampania wygasła';
  END IF;

  PERFORM 1
    FROM public.profiles AS profile
   WHERE profile.id = v_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono użytkownika';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.bonus_campaign_claims AS claim
    WHERE claim.campaign_id = p_campaign_id
      AND claim.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Bonus został już odebrany';
  END IF;

  UPDATE public.profiles AS profile
     SET balance = ROUND(profile.balance + v_campaign.amount, 2)
   WHERE profile.id = v_user_id
   RETURNING profile.balance INTO v_new_balance;

  INSERT INTO public.bonus_campaign_claims (
    campaign_id,
    user_id,
    amount,
    balance_after,
    claimed_at
  )
  VALUES (
    p_campaign_id,
    v_user_id,
    v_campaign.amount,
    v_new_balance,
    v_claimed_at
  );

  RETURN QUERY
  SELECT
    p_campaign_id,
    v_campaign.amount,
    v_new_balance,
    v_claimed_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_bonus_campaign(UUID) TO authenticated;
