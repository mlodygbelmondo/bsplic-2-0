-- The authoritative bet placement RPC is for signed-in users only.

REVOKE EXECUTE ON FUNCTION public.place_bet_secure(UUID, NUMERIC, NUMERIC, JSONB)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_bet_secure(UUID, NUMERIC, NUMERIC, JSONB)
  TO authenticated;
