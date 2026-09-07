-- Recurring shared boost. Existing accounts start a new cycle on first access.
ALTER TABLE public.casino_slot_accounts
 ADD COLUMN boost_remaining integer NOT NULL DEFAULT 0 CHECK (boost_remaining BETWEEN 0 AND 15),
 ADD COLUMN boost_resets_at timestamptz DEFAULT now(),
 ADD CONSTRAINT slot_boost_cycle CHECK (
  (boost_remaining > 0 AND boost_resets_at IS NULL) OR
  (boost_remaining = 0 AND boost_resets_at IS NOT NULL)
 );

-- Callers must hold the profile wallet lock before taking the account lock.
CREATE FUNCTION public._slot_refresh_boost(p_user_id uuid) RETURNS integer
LANGUAGE plpgsql VOLATILE SET search_path = public AS $$
DECLARE account public.casino_slot_accounts;
BEGIN
 INSERT INTO public.casino_slot_accounts(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING;
 SELECT * INTO account FROM public.casino_slot_accounts WHERE user_id=p_user_id FOR UPDATE;
 IF account.boost_remaining=0 AND account.boost_resets_at<=clock_timestamp() THEN
  account.boost_remaining:=5+floor(public._slot_random()*11)::integer;
  UPDATE public.casino_slot_accounts
   SET boost_remaining=account.boost_remaining,boost_resets_at=NULL WHERE user_id=p_user_id;
 END IF;
 RETURN account.boost_remaining;
END; $$;
REVOKE ALL ON FUNCTION public._slot_refresh_boost(uuid) FROM PUBLIC, anon, authenticated;

-- Qualify history columns so PL/pgSQL variables cannot shadow table fields.
CREATE OR REPLACE FUNCTION public.casino_slot_state(p_game text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u uuid := auth.uid(); v_state jsonb; boost_left integer;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 IF p_game IS NULL OR p_game NOT IN ('bandit','candy') THEN RAISE EXCEPTION 'INVALID_GAME'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=u FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND'; END IF;
 boost_left:=public._slot_refresh_boost(u);
 SELECT jsonb_build_object(
  'boostRemaining',boost_left,
  'freeSpins',coalesce((SELECT b.remaining FROM public.casino_slot_bonus b WHERE b.user_id=u AND b.game=p_game),0),
  'bonusStake',coalesce((SELECT b.stake FROM public.casino_slot_bonus b WHERE b.user_id=u AND b.game=p_game),1),
  'history',coalesce((SELECT jsonb_agg(s.result ORDER BY s.created_at DESC) FROM (SELECT spins.result,spins.created_at FROM public.casino_slot_spins spins WHERE spins.user_id=u AND spins.game=p_game ORDER BY spins.created_at DESC LIMIT 10) s),'[]'::jsonb)
 ) INTO v_state;
 RETURN v_state;
END; $$;
REVOKE ALL ON FUNCTION public.casino_slot_state(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.casino_slot_state(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.casino_slot_spin(p_game text, p_stake numeric, p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
 u uuid := auth.uid(); balance_before numeric; balance_after numeric; existing public.casino_slot_spins;
 paid integer; boost_left integer; free_left integer; bonus_stake numeric; charged numeric; boosted boolean;
 board integer[] := '{}'; gold integer[] := array_fill(0,ARRAY[30]); survivors integer[];
 frames jsonb := '[]'; groups jsonb; g jsonb; removed integer[]; cells integer[];
 total numeric := 0; frame_payout numeric; group_payout numeric; multiplier integer; frame_multiplier integer;
 i integer; j integer; col integer; row_idx integer; cascade integer; symbol integer; scatters integer;
 awarded integer := 0; result jsonb; size integer; base numeric;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 IF p_game IS NULL OR p_game NOT IN ('bandit','candy') THEN RAISE EXCEPTION 'INVALID_GAME'; END IF;
 IF p_request_id IS NULL OR p_stake IS NULL OR p_stake::text IN ('NaN','Infinity','-Infinity') OR p_stake < 1 OR p_stake > 100 OR p_stake <> round(p_stake,2) THEN RAISE EXCEPTION 'INVALID_STAKE'; END IF;
 -- Wallet lock serializes slots with other casino games and transfers.
 SELECT balance INTO balance_before FROM public.profiles WHERE id=u FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND'; END IF;
 SELECT * INTO existing FROM public.casino_slot_spins WHERE id=p_request_id;
 IF FOUND THEN
  IF existing.user_id<>u OR existing.game<>p_game OR existing.stake<>p_stake THEN RAISE EXCEPTION 'REQUEST_CONFLICT'; END IF;
  RETURN existing.result;
 END IF;
 boost_left:=public._slot_refresh_boost(u);
 SELECT paid_spins INTO paid FROM public.casino_slot_accounts WHERE user_id=u;
 INSERT INTO public.casino_slot_bonus(user_id,game) VALUES(u,p_game) ON CONFLICT DO NOTHING;
 SELECT remaining,stake INTO free_left,bonus_stake FROM public.casino_slot_bonus WHERE user_id=u AND game=p_game;
 IF free_left>0 AND p_stake<>bonus_stake THEN RAISE EXCEPTION 'BONUS_STAKE_LOCKED'; END IF;
 charged := CASE WHEN free_left>0 THEN 0 ELSE p_stake END;
 IF balance_before < charged THEN RAISE EXCEPTION 'INSUFFICIENT_BALANCE'; END IF;
 boosted := boost_left>0 AND free_left=0;
 FOR i IN 1..30 LOOP board := array_append(board,public._slot_symbol()); END LOOP;
 -- Each boosted paid spin has a 35% chance to seed one matching group.
 IF boosted AND public._slot_random()<0.35 THEN
  symbol := floor(public._slot_random()*7)::integer;
  IF p_game='bandit' THEN
   i := floor(public._slot_random()*4)::integer*6+1;
   FOREACH j IN ARRAY ARRAY[i,i+1,i+2,i+6,i+7] LOOP board[j]:=symbol; END LOOP;
  ELSE
   cells := '{}';
   WHILE cardinality(cells)<8 LOOP
    i := floor(public._slot_random()*30)::integer+1;
    IF NOT i=ANY(cells) THEN cells:=array_append(cells,i); board[i]:=symbol; END IF;
   END LOOP;
  END IF;
 END IF;
 SELECT count(*) INTO scatters FROM unnest(board) s WHERE s=7;
 IF free_left=0 AND scatters>=4 THEN awarded:=8; END IF;
 FOR cascade IN 0..11 LOOP
  groups := public._slot_groups(board,p_game); removed:='{}'; frame_payout:=0; frame_multiplier:=1;
  multiplier := CASE WHEN p_game='candy' AND jsonb_array_length(groups)>0 THEN 1+floor(public._slot_random()*5)::integer ELSE 1 END;
  FOR g IN SELECT value FROM jsonb_array_elements(groups) LOOP
   SELECT array_agg(value::integer) INTO cells FROM jsonb_array_elements_text(g->'cells');
   size := cardinality(cells); symbol := (g->>'symbol')::integer;
   base := CASE WHEN p_game='bandit' THEN 2.60 ELSE 0.23 END;
   group_payout := round(p_stake * base * (1+symbol*0.25) * power(1.35,size-CASE WHEN p_game='bandit' THEN 5 ELSE 8 END),2);
   IF p_game='bandit' THEN
    SELECT 1+coalesce(max(gold[c+1]),0) INTO multiplier FROM unnest(cells) c;
   END IF;
   frame_payout:=frame_payout+group_payout*multiplier;
   frame_multiplier:=greatest(frame_multiplier,multiplier);
   removed:=removed||cells;
  END LOOP;
  frame_payout:=least(frame_payout,p_stake*500-total); total:=total+frame_payout;
  frames:=frames||jsonb_build_array(jsonb_build_object('board',to_jsonb(board),'groups',groups,'gold',to_jsonb(gold),'multiplier',frame_multiplier,'payout',frame_payout));
  EXIT WHEN cardinality(removed)=0 OR total>=p_stake*500 OR cascade=11;
  FOREACH i IN ARRAY removed LOOP gold[i+1]:=least(gold[i+1]+1,4); END LOOP;
  FOR col IN 0..5 LOOP
   survivors:='{}';
   FOR row_idx IN 0..4 LOOP
    i:=row_idx*6+col;
    IF NOT i=ANY(removed) THEN survivors:=array_append(survivors,board[i+1]); END IF;
   END LOOP;
   FOR row_idx IN REVERSE 4..0 LOOP
    i:=row_idx*6+col+1;
    IF cardinality(survivors)>0 THEN
     board[i]:=survivors[cardinality(survivors)]; survivors:=survivors[:cardinality(survivors)-1];
    ELSE board[i]:=public._slot_symbol(); END IF;
   END LOOP;
  END LOOP;
 END LOOP;
 IF free_left=0 THEN
  paid:=paid+1;
  IF boosted THEN boost_left:=boost_left-1; END IF;
  UPDATE public.casino_slot_accounts
   SET paid_spins=paid,boost_remaining=boost_left,
       boost_resets_at=CASE WHEN boosted AND boost_left=0
        THEN clock_timestamp()+interval '12 hours'+public._slot_random()*interval '24 hours'
        ELSE boost_resets_at END
   WHERE user_id=u;
  free_left:=awarded; bonus_stake:=p_stake;
 ELSE free_left:=free_left-1; END IF;
 UPDATE public.casino_slot_bonus SET remaining=free_left,stake=bonus_stake WHERE user_id=u AND game=p_game;
 balance_after:=balance_before-charged+total;
 UPDATE public.profiles SET balance=balance_after WHERE id=u;
 result:=jsonb_build_object('id',p_request_id,'game',p_game,'stake',p_stake,'charged',charged,'payout',total,'net',total-charged,'balance',balance_after,'boosted',boosted,'boostRemaining',boost_left,'freeSpins',free_left,'awardedFreeSpins',awarded,'frames',frames,'createdAt',now());
 INSERT INTO public.casino_slot_spins(id,user_id,game,stake,charged,payout,result) VALUES(p_request_id,u,p_game,p_stake,charged,total,result);
 RETURN result;
END; $$;
