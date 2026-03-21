-- Market assets and virtual trading without local market price storage.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'market_asset_type'
      AND typnamespace = 'public'::regnamespace
  ) THEN
    CREATE TYPE public.market_asset_type AS ENUM ('stock', 'etf', 'crypto', 'forex', 'commodity');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'market_tx_side'
      AND typnamespace = 'public'::regnamespace
  ) THEN
    CREATE TYPE public.market_tx_side AS ENUM ('buy', 'sell', 'bet_stake');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.market_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  type public.market_asset_type NOT NULL,
  quote_currency TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  min_bet_pln NUMERIC(12, 2) NOT NULL DEFAULT 5 CHECK (min_bet_pln > 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS market_assets_type_idx ON public.market_assets(type);
CREATE INDEX IF NOT EXISTS market_assets_active_idx ON public.market_assets(is_active);
CREATE INDEX IF NOT EXISTS market_assets_symbol_idx ON public.market_assets(symbol);

CREATE TABLE IF NOT EXISTS public.market_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.market_assets(id) ON DELETE RESTRICT,
  side public.market_tx_side NOT NULL,
  quantity NUMERIC(24, 8) NOT NULL CHECK (quantity > 0),
  unit_price_pln NUMERIC(18, 8) NOT NULL CHECK (unit_price_pln > 0),
  quote_currency TEXT NOT NULL,
  fx_rate_to_pln NUMERIC(18, 8) NOT NULL CHECK (fx_rate_to_pln > 0),
  gross_value_pln NUMERIC(18, 2) NOT NULL CHECK (gross_value_pln > 0),
  fee_pln NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (fee_pln >= 0),
  net_value_pln NUMERIC(18, 2) NOT NULL CHECK (net_value_pln > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS market_transactions_user_created_idx
  ON public.market_transactions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS market_transactions_user_asset_idx
  ON public.market_transactions(user_id, asset_id);

ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS stake_asset_id UUID REFERENCES public.market_assets(id),
  ADD COLUMN IF NOT EXISTS stake_asset_symbol TEXT,
  ADD COLUMN IF NOT EXISTS stake_asset_type public.market_asset_type,
  ADD COLUMN IF NOT EXISTS stake_asset_quantity NUMERIC(24, 8),
  ADD COLUMN IF NOT EXISTS stake_asset_unit_price_pln NUMERIC(18, 8),
  ADD COLUMN IF NOT EXISTS stake_asset_fx_rate_to_pln NUMERIC(18, 8);

CREATE OR REPLACE FUNCTION public.touch_market_asset_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS market_assets_touch_updated_at ON public.market_assets;
CREATE TRIGGER market_assets_touch_updated_at
BEFORE UPDATE ON public.market_assets
FOR EACH ROW
EXECUTE FUNCTION public.touch_market_asset_updated_at();

ALTER TABLE public.market_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Market assets are viewable by everyone" ON public.market_assets;
CREATE POLICY "Market assets are viewable by everyone"
  ON public.market_assets
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Only admins can manage market assets" ON public.market_assets;
CREATE POLICY "Only admins can manage market assets"
  ON public.market_assets
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can view own market transactions" ON public.market_transactions;
CREATE POLICY "Users can view own market transactions"
  ON public.market_transactions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users cannot insert market transactions directly" ON public.market_transactions;
CREATE POLICY "Users cannot insert market transactions directly"
  ON public.market_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "Admins can view all market transactions" ON public.market_transactions;
CREATE POLICY "Admins can view all market transactions"
  ON public.market_transactions
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.get_market_asset_position_qty(
  p_user_id UUID,
  p_asset_id UUID
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qty NUMERIC;
BEGIN
  SELECT COALESCE(
    SUM(
      CASE
        WHEN side = 'buy' THEN quantity
        WHEN side IN ('sell', 'bet_stake') THEN -quantity
        ELSE 0
      END
    ),
    0
  )
  INTO v_qty
  FROM public.market_transactions
  WHERE user_id = p_user_id
    AND asset_id = p_asset_id;

  RETURN COALESCE(v_qty, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.place_market_order_secure(
  p_user_id UUID,
  p_asset_id UUID,
  p_side public.market_tx_side,
  p_quantity NUMERIC,
  p_unit_price NUMERIC,
  p_quote_currency TEXT,
  p_fx_rate_to_pln NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance NUMERIC;
  v_order_value NUMERIC;
  v_fee NUMERIC := 0;
  v_asset_active BOOLEAN;
  v_existing_qty NUMERIC;
BEGIN
  IF p_side NOT IN ('buy', 'sell') THEN
    RAISE EXCEPTION 'Dozwolone strony transakcji: buy/sell';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Ilość musi być większa od 0';
  END IF;

  IF p_unit_price IS NULL OR p_unit_price <= 0 THEN
    RAISE EXCEPTION 'Cena jednostkowa musi być większa od 0';
  END IF;

  IF p_fx_rate_to_pln IS NULL OR p_fx_rate_to_pln <= 0 THEN
    RAISE EXCEPTION 'Kurs FX musi być większy od 0';
  END IF;

  SELECT is_active INTO v_asset_active
  FROM public.market_assets
  WHERE id = p_asset_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aktywo nie istnieje';
  END IF;

  IF NOT v_asset_active THEN
    RAISE EXCEPTION 'Aktywo jest nieaktywne';
  END IF;

  v_order_value := ROUND(p_quantity * p_unit_price * p_fx_rate_to_pln, 2);
  IF v_order_value <= 0 THEN
    RAISE EXCEPTION 'Wartość transakcji musi być większa od 0';
  END IF;

  SELECT balance INTO v_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono użytkownika';
  END IF;

  IF p_side = 'buy' THEN
    IF v_balance < (v_order_value + v_fee) THEN
      RAISE EXCEPTION 'Niewystarczające środki (saldo: % zł)', ROUND(v_balance, 2);
    END IF;

    UPDATE public.profiles
      SET balance = ROUND(balance - v_order_value - v_fee, 2)
      WHERE id = p_user_id;
  ELSE
    v_existing_qty := public.get_market_asset_position_qty(p_user_id, p_asset_id);
    IF v_existing_qty < p_quantity THEN
      RAISE EXCEPTION 'Niewystarczająca ilość aktywa (masz: %)', v_existing_qty;
    END IF;

    UPDATE public.profiles
      SET balance = ROUND(balance + v_order_value - v_fee, 2)
      WHERE id = p_user_id;
  END IF;

  INSERT INTO public.market_transactions (
    user_id,
    asset_id,
    side,
    quantity,
    unit_price_pln,
    quote_currency,
    fx_rate_to_pln,
    gross_value_pln,
    fee_pln,
    net_value_pln
  )
  VALUES (
    p_user_id,
    p_asset_id,
    p_side,
    p_quantity,
    ROUND(p_unit_price * p_fx_rate_to_pln, 8),
    UPPER(p_quote_currency),
    p_fx_rate_to_pln,
    v_order_value,
    v_fee,
    ROUND(v_order_value - v_fee, 2)
  );

  RETURN v_order_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_market_assets(
  p_query TEXT,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  symbol TEXT,
  display_name TEXT,
  type public.market_asset_type,
  quote_currency TEXT,
  is_active BOOLEAN,
  min_bet_pln NUMERIC,
  sort_order INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ma.id,
    ma.symbol,
    ma.display_name,
    ma.type,
    ma.quote_currency,
    ma.is_active,
    ma.min_bet_pln,
    ma.sort_order,
    ma.created_at,
    ma.updated_at
  FROM public.market_assets ma
  WHERE
    ma.symbol ILIKE ('%' || p_query || '%')
    OR ma.display_name ILIKE ('%' || p_query || '%')
  ORDER BY ma.sort_order ASC, ma.display_name ASC
  LIMIT GREATEST(1, LEAST(p_limit, 100));
$$;

CREATE OR REPLACE FUNCTION public.place_bet_secure(
  p_user_id     UUID,
  p_total_odds  NUMERIC,
  p_stake       NUMERIC,
  p_items       JSONB,
  p_stake_asset JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance                NUMERIC;
  v_coupon_id              UUID;
  v_item                   JSONB;
  v_bet_active             BOOLEAN;
  v_bet_ended              BOOLEAN;
  v_stake_asset_id         UUID;
  v_stake_asset_symbol     TEXT;
  v_stake_asset_type       public.market_asset_type;
  v_stake_asset_quantity   NUMERIC;
  v_stake_asset_unit_pln   NUMERIC;
  v_stake_asset_fx_to_pln  NUMERIC;
  v_asset_position_qty     NUMERIC;
BEGIN
  IF p_stake IS NULL OR p_stake <= 0 THEN
    RAISE EXCEPTION 'Stawka musi być większa od 0';
  END IF;

  IF p_stake <> ROUND(p_stake, 2) THEN
    RAISE EXCEPTION 'Stawka może mieć maksymalnie 2 miejsca po przecinku';
  END IF;

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

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    IF (v_item->>'stake')::NUMERIC <> ROUND((v_item->>'stake')::NUMERIC, 2) THEN
      RAISE EXCEPTION 'Stawka zakładu może mieć maksymalnie 2 miejsca po przecinku';
    END IF;

    IF (v_item->>'stake')::NUMERIC <= 0 THEN
      RAISE EXCEPTION 'Stawka każdego zakładu musi być większa od 0';
    END IF;

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

  IF p_stake_asset IS NOT NULL THEN
    v_stake_asset_id := NULLIF(p_stake_asset->>'assetId', '')::UUID;
    v_stake_asset_symbol := NULLIF(p_stake_asset->>'symbol', '');
    v_stake_asset_type := NULLIF(p_stake_asset->>'type', '')::public.market_asset_type;
    v_stake_asset_quantity := (p_stake_asset->>'quantity')::NUMERIC;
    v_stake_asset_unit_pln := (p_stake_asset->>'unitPricePln')::NUMERIC;
    v_stake_asset_fx_to_pln := (p_stake_asset->>'fxRateToPln')::NUMERIC;

    IF v_stake_asset_id IS NULL OR v_stake_asset_quantity IS NULL OR v_stake_asset_quantity <= 0 THEN
      RAISE EXCEPTION 'Niepoprawna stawka aktywem';
    END IF;

    IF v_stake_asset_unit_pln IS NULL OR v_stake_asset_unit_pln <= 0 THEN
      RAISE EXCEPTION 'Niepoprawna cena aktywa dla stawki';
    END IF;

    IF v_stake_asset_fx_to_pln IS NULL OR v_stake_asset_fx_to_pln <= 0 THEN
      RAISE EXCEPTION 'Niepoprawny kurs FX dla stawki';
    END IF;

    SELECT public.get_market_asset_position_qty(p_user_id, v_stake_asset_id)
      INTO v_asset_position_qty;

    IF v_asset_position_qty < v_stake_asset_quantity THEN
      RAISE EXCEPTION 'Niewystarczająca ilość aktywa do stawki';
    END IF;

    INSERT INTO public.market_transactions (
      user_id,
      asset_id,
      side,
      quantity,
      unit_price_pln,
      quote_currency,
      fx_rate_to_pln,
      gross_value_pln,
      fee_pln,
      net_value_pln
    ) VALUES (
      p_user_id,
      v_stake_asset_id,
      'bet_stake',
      v_stake_asset_quantity,
      ROUND(v_stake_asset_unit_pln, 8),
      COALESCE(NULLIF(p_stake_asset->>'quoteCurrency', ''), 'PLN'),
      v_stake_asset_fx_to_pln,
      p_stake,
      0,
      p_stake
    );
  END IF;

  UPDATE public.profiles
     SET balance = ROUND(balance - p_stake, 2)
   WHERE id = p_user_id;

  INSERT INTO public.coupons (
    user_id,
    total_odds,
    stake,
    status,
    stake_asset_id,
    stake_asset_symbol,
    stake_asset_type,
    stake_asset_quantity,
    stake_asset_unit_price_pln,
    stake_asset_fx_rate_to_pln
  )
  VALUES (
    p_user_id,
    p_total_odds,
    ROUND(p_stake, 2),
    'pending',
    v_stake_asset_id,
    v_stake_asset_symbol,
    v_stake_asset_type,
    v_stake_asset_quantity,
    v_stake_asset_unit_pln,
    v_stake_asset_fx_to_pln
  )
  RETURNING id INTO v_coupon_id;

  INSERT INTO public.placed_bets (user_id, bet_id, selected_option, stake, odds_at_time, coupon_id)
  SELECT
    p_user_id,
    (item->>'betId')::UUID,
    item->>'selectedOption',
    ROUND((item->>'stake')::NUMERIC, 2),
    (item->>'odds')::NUMERIC,
    v_coupon_id
  FROM jsonb_array_elements(p_items) AS item;

  UPDATE public.bets
     SET bet_count = bet_count + 1
   WHERE id IN (
     SELECT (item->>'betId')::UUID
       FROM jsonb_array_elements(p_items) AS item
   );

  RETURN v_coupon_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_coupon_history(
  p_user_id UUID,
  p_limit   INTEGER DEFAULT 50,
  p_offset  INTEGER DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(row_to_json(c_row))
    INTO v_result
    FROM (
      SELECT
        c.id,
        c.total_odds,
        c.stake,
        c.stake_asset_id,
        c.stake_asset_symbol,
        c.stake_asset_type,
        c.stake_asset_quantity,
        c.stake_asset_unit_price_pln,
        c.stake_asset_fx_rate_to_pln,
        c.payout,
        c.status,
        c.created_at,
        (
          SELECT json_agg(
                   json_build_object(
                     'id', pb.id,
                     'bet_id', pb.bet_id,
                     'selected_option', pb.selected_option,
                     'odds_at_time', pb.odds_at_time,
                     'leg_stake', pb.stake,
                     'leg_payout', pb.payout,
                     'result', pb.result,
                     'bet_title', b.title
                   )
                   ORDER BY pb.created_at
                 )
          FROM public.placed_bets pb
          LEFT JOIN public.bets b ON b.id = pb.bet_id
          WHERE pb.coupon_id = c.id
        ) AS legs
      FROM public.coupons c
      WHERE c.user_id = p_user_id
      ORDER BY c.created_at DESC
      LIMIT p_limit
      OFFSET p_offset
    ) c_row;

  RETURN COALESCE(v_result, '[]'::JSON);
END;
$$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.market_assets;

INSERT INTO public.market_assets (symbol, display_name, type, quote_currency, min_bet_pln, sort_order)
VALUES
  ('AAPL', 'Apple Inc.', 'stock', 'USD', 5, 10),
  ('TSLA', 'Tesla, Inc.', 'stock', 'USD', 5, 20),
  ('MSFT', 'Microsoft Corporation', 'stock', 'USD', 5, 30),
  ('SPY', 'SPDR S&P 500 ETF Trust', 'etf', 'USD', 5, 40),
  ('QQQ', 'Invesco QQQ Trust', 'etf', 'USD', 5, 50),
  ('BTC/USD', 'Bitcoin / US Dollar', 'crypto', 'USD', 1, 60),
  ('ETH/USD', 'Ethereum / US Dollar', 'crypto', 'USD', 1, 70),
  ('EUR/USD', 'Euro / US Dollar', 'forex', 'USD', 5, 80)
ON CONFLICT (symbol) DO NOTHING;
