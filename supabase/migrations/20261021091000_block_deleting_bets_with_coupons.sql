-- Deleting a market cascaded into placed_bets without touching the coupons:
-- a single lost its stake with no refund, and an AKO kept the deleted leg's
-- odds in total_odds, so the remaining legs paid out too much. A market that
-- carries coupons must be settled (refund if cancelled) instead of deleted.

CREATE OR REPLACE FUNCTION private.prevent_deleting_bet_with_coupons()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.placed_bets
     WHERE bet_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'Nie można usunąć zakładu, na który postawiono kupony. Rozlicz go jako zwrot albo zostaw nieaktywny.';
  END IF;

  RETURN OLD;
END;
$$;

REVOKE EXECUTE ON FUNCTION private.prevent_deleting_bet_with_coupons()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS prevent_deleting_bet_with_coupons ON public.bets;
CREATE TRIGGER prevent_deleting_bet_with_coupons
  BEFORE DELETE ON public.bets
  FOR EACH ROW
  EXECUTE FUNCTION private.prevent_deleting_bet_with_coupons();
