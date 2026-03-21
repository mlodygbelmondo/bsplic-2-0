-- Cached market quotes table populated by scheduled Edge Function.

CREATE TABLE IF NOT EXISTS public.market_quotes (
  asset_id UUID PRIMARY KEY REFERENCES public.market_assets(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  quote_currency TEXT NOT NULL,
  price NUMERIC(24, 10) NOT NULL CHECK (price > 0),
  open NUMERIC(24, 10),
  high NUMERIC(24, 10),
  low NUMERIC(24, 10),
  volume NUMERIC(24, 2),
  as_of TIMESTAMPTZ NOT NULL,
  provider TEXT NOT NULL DEFAULT 'twelvedata',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS market_quotes_symbol_idx ON public.market_quotes(symbol);
CREATE INDEX IF NOT EXISTS market_quotes_updated_at_idx ON public.market_quotes(updated_at DESC);

ALTER TABLE public.market_quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Market quotes are viewable by everyone" ON public.market_quotes;
CREATE POLICY "Market quotes are viewable by everyone"
  ON public.market_quotes
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Only admins can manage market quotes" ON public.market_quotes;
CREATE POLICY "Only admins can manage market quotes"
  ON public.market_quotes
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.touch_market_quote_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS market_quotes_touch_updated_at ON public.market_quotes;
CREATE TRIGGER market_quotes_touch_updated_at
BEFORE UPDATE ON public.market_quotes
FOR EACH ROW
EXECUTE FUNCTION public.touch_market_quote_updated_at();
