-- Fix double increment of bets.bet_count caused by duplicate increment paths:
-- 1) legacy trigger on placed_bets
-- 2) explicit update inside place_bet_secure()

DROP TRIGGER IF EXISTS on_placed_bet_created ON public.placed_bets;
DROP FUNCTION IF EXISTS public.increment_bet_count();

UPDATE public.bets AS b
SET bet_count = COALESCE((
  SELECT COUNT(*)::INTEGER
  FROM public.placed_bets AS pb
  WHERE pb.bet_id = b.id
), 0);
