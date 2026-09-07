-- Qualify history columns so PL/pgSQL variables cannot shadow table fields.
CREATE OR REPLACE FUNCTION public.casino_slot_state(p_game text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u uuid := auth.uid(); v_state jsonb;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 IF p_game IS NULL OR p_game NOT IN ('bandit','candy') THEN RAISE EXCEPTION 'INVALID_GAME'; END IF;
 SELECT jsonb_build_object(
  'boostRemaining',greatest(0,10-coalesce((SELECT a.paid_spins FROM public.casino_slot_accounts a WHERE a.user_id=u),0)),
  'freeSpins',coalesce((SELECT b.remaining FROM public.casino_slot_bonus b WHERE b.user_id=u AND b.game=p_game),0),
  'bonusStake',coalesce((SELECT b.stake FROM public.casino_slot_bonus b WHERE b.user_id=u AND b.game=p_game),1),
  'history',coalesce((SELECT jsonb_agg(s.result ORDER BY s.created_at DESC) FROM (SELECT spins.result,spins.created_at FROM public.casino_slot_spins spins WHERE spins.user_id=u AND spins.game=p_game ORDER BY spins.created_at DESC LIMIT 10) s),'[]'::jsonb)
 ) INTO v_state;
 RETURN v_state;
END; $$;
REVOKE ALL ON FUNCTION public.casino_slot_state(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.casino_slot_state(text) TO authenticated;
