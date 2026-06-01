CREATE TABLE public.bonus_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bonus_campaigns_amount_positive CHECK (amount > 0),
  CONSTRAINT bonus_campaigns_expires_after_start CHECK (expires_at > starts_at)
);

CREATE TABLE public.bonus_campaign_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.bonus_campaigns(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  balance_after NUMERIC NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bonus_campaign_claims_amount_positive CHECK (amount > 0),
  CONSTRAINT bonus_campaign_claims_unique_user_campaign UNIQUE (campaign_id, user_id)
);

CREATE INDEX bonus_campaigns_active_window_idx
  ON public.bonus_campaigns (is_active, starts_at, expires_at);

CREATE INDEX bonus_campaign_claims_campaign_id_idx
  ON public.bonus_campaign_claims (campaign_id);

ALTER TABLE public.bonus_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonus_campaign_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage bonus campaigns"
  ON public.bonus_campaigns
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins view bonus campaign claims"
  ON public.bonus_campaign_claims
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.get_available_bonus_campaigns()
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  amount NUMERIC,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Musisz być zalogowany';
  END IF;

  RETURN QUERY
  SELECT
    campaign.id,
    campaign.title,
    campaign.description,
    campaign.amount,
    campaign.starts_at,
    campaign.expires_at
  FROM public.bonus_campaigns AS campaign
  WHERE campaign.is_active = TRUE
    AND NOW() >= campaign.starts_at
    AND NOW() < campaign.expires_at
    AND NOT EXISTS (
      SELECT 1
      FROM public.bonus_campaign_claims AS claim
      WHERE claim.campaign_id = campaign.id
        AND claim.user_id = v_user_id
    )
  ORDER BY campaign.starts_at ASC, campaign.created_at ASC;
END;
$$;

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

  SELECT *
    INTO v_campaign
    FROM public.bonus_campaigns
   WHERE id = p_campaign_id;

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
    FROM public.profiles
   WHERE id = v_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono użytkownika';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.bonus_campaign_claims
    WHERE campaign_id = p_campaign_id
      AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Bonus został już odebrany';
  END IF;

  UPDATE public.profiles
     SET balance = ROUND(balance + v_campaign.amount, 2)
   WHERE id = v_user_id
   RETURNING balance INTO v_new_balance;

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

GRANT EXECUTE ON FUNCTION public.get_available_bonus_campaigns() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_bonus_campaign(UUID) TO authenticated;
