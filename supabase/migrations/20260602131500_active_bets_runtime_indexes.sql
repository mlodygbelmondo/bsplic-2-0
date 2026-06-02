CREATE INDEX IF NOT EXISTS idx_bets_active_popular
  ON public.bets (bet_count DESC, created_at DESC)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_bets_active_category_popular
  ON public.bets (category_id, bet_count DESC, created_at DESC)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_bets_active_ending_soon
  ON public.bets (ends_at ASC, created_at DESC)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_bets_active_category_ending_soon
  ON public.bets (category_id, ends_at ASC, created_at DESC)
  WHERE is_active = true;
