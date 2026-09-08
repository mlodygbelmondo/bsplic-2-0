-- Remove recurring forced wins. A single global inactivity opportunity is claimed atomically.
CREATE TABLE public.casino_slot_activity (
 id boolean PRIMARY KEY DEFAULT true CHECK (id),
 last_spin_at timestamptz NOT NULL
);
INSERT INTO public.casino_slot_activity(id,last_spin_at)
 SELECT true,coalesce(max(created_at),clock_timestamp())
 FROM public.casino_slot_spins WHERE charged>0;
ALTER TABLE public.casino_slot_activity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.casino_slot_activity FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.casino_slot_state(p_game text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u uuid := auth.uid(); v_state jsonb;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 IF p_game IS NULL OR p_game NOT IN ('bandit','candy','ember','tide') THEN RAISE EXCEPTION 'INVALID_GAME'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=u FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND'; END IF;
 SELECT jsonb_build_object(
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
 paid integer; last_paid_at timestamptz; lucky_shot boolean := false; free_left integer; bonus_stake numeric; charged numeric;
 board integer[] := '{}'; gold integer[] := array_fill(0,ARRAY[30]); survivors integer[];
 frames jsonb := '[]'; groups jsonb; g jsonb; removed integer[]; cells integer[];
 total numeric := 0; frame_payout numeric; group_payout numeric; multiplier integer; frame_multiplier integer;
 i integer; j integer; col integer; row_idx integer; cascade integer; symbol integer; scatters integer;
 awarded integer := 0; result jsonb; size integer; base numeric;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 IF p_game IS NULL OR p_game NOT IN ('bandit','candy','ember','tide') THEN RAISE EXCEPTION 'INVALID_GAME'; END IF;
 IF p_request_id IS NULL OR p_stake IS NULL OR p_stake::text IN ('NaN','Infinity','-Infinity') OR p_stake < 1 OR p_stake > 100 OR p_stake <> round(p_stake,2) THEN RAISE EXCEPTION 'INVALID_STAKE'; END IF;
 -- Wallet lock serializes slots with other casino games and transfers.
 SELECT balance INTO balance_before FROM public.profiles WHERE id=u FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND'; END IF;
 SELECT * INTO existing FROM public.casino_slot_spins WHERE id=p_request_id;
 IF FOUND THEN
  IF existing.user_id<>u OR existing.game<>p_game OR existing.stake<>p_stake THEN RAISE EXCEPTION 'REQUEST_CONFLICT'; END IF;
  RETURN existing.result;
 END IF;
 INSERT INTO public.casino_slot_accounts(user_id) VALUES(u) ON CONFLICT DO NOTHING;
 SELECT paid_spins INTO paid FROM public.casino_slot_accounts WHERE user_id=u;
 INSERT INTO public.casino_slot_bonus(user_id,game) VALUES(u,p_game) ON CONFLICT DO NOTHING;
 SELECT remaining,stake INTO free_left,bonus_stake FROM public.casino_slot_bonus WHERE user_id=u AND game=p_game;
 IF free_left>0 AND p_stake<>bonus_stake THEN RAISE EXCEPTION 'BONUS_STAKE_LOCKED'; END IF;
 charged := CASE WHEN free_left>0 THEN 0 ELSE p_stake END;
 IF balance_before < charged THEN RAISE EXCEPTION 'INSUFFICIENT_BALANCE'; END IF;
 -- Only one paid request across all slots can claim the inactivity opportunity.
 IF free_left=0 THEN
  SELECT last_spin_at INTO last_paid_at FROM public.casino_slot_activity WHERE id=true FOR UPDATE;
  IF last_paid_at<=clock_timestamp()-interval '6 hours' THEN
   lucky_shot:=public._slot_random()<0.01;
  END IF;
  UPDATE public.casino_slot_activity SET last_spin_at=clock_timestamp() WHERE id=true;
 END IF;
 FOR i IN 1..30 LOOP board := array_append(board,public._slot_symbol()); END LOOP;
 SELECT count(*) INTO scatters FROM unnest(board) s WHERE s=7;
 IF free_left=0 AND scatters>=4 THEN awarded:=10; END IF;
 FOR cascade IN 0..11 LOOP
  groups := public._slot_groups(board,CASE WHEN p_game IN ('candy','tide') THEN 'candy' ELSE 'bandit' END); removed:='{}'; frame_payout:=0; frame_multiplier:=1;
  multiplier := CASE WHEN p_game='candy' AND jsonb_array_length(groups)>0 THEN 1+floor(public._slot_random()*5)::integer WHEN p_game='ember' THEN least(cascade+1,5) WHEN p_game='tide' THEN 3 ELSE 1 END;
  FOR g IN SELECT value FROM jsonb_array_elements(groups) LOOP
   SELECT array_agg(value::integer) INTO cells FROM jsonb_array_elements_text(g->'cells');
   size := cardinality(cells); symbol := (g->>'symbol')::integer;
   base := CASE WHEN p_game IN ('bandit','ember') THEN 2.60 ELSE 0.23 END;
   group_payout := round(p_stake * base * (1+symbol*0.25) * power(1.35,size-CASE WHEN p_game IN ('bandit','ember') THEN 5 ELSE 8 END),2);
   IF p_game='bandit' THEN
    SELECT 1+coalesce(max(gold[c+1]),0) INTO multiplier FROM unnest(cells) c;
   END IF;
   frame_payout:=frame_payout+group_payout*multiplier;
   frame_multiplier:=greatest(frame_multiplier,multiplier);
   removed:=removed||cells;
  END LOOP;
  frame_payout:=least(frame_payout,p_stake*200-total); total:=total+frame_payout;
  frames:=frames||jsonb_build_array(jsonb_build_object('board',to_jsonb(board),'groups',groups,'gold',to_jsonb(gold),'multiplier',frame_multiplier,'payout',frame_payout));
  EXIT WHEN cardinality(removed)=0 OR total>=p_stake*200 OR cascade=11;
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
  UPDATE public.casino_slot_accounts SET paid_spins=paid WHERE user_id=u;
  free_left:=awarded; bonus_stake:=p_stake;
 ELSE free_left:=free_left-1; END IF;
 UPDATE public.casino_slot_bonus SET remaining=free_left,stake=bonus_stake WHERE user_id=u AND game=p_game;
 IF lucky_shot THEN total:=p_stake*200; END IF;
 balance_after:=balance_before-charged+total;
 UPDATE public.profiles SET balance=balance_after WHERE id=u;
 result:=jsonb_build_object('id',p_request_id,'game',p_game,'stake',p_stake,'charged',charged,'payout',total,'net',total-charged,'balance',balance_after,'luckyShot',lucky_shot,'freeSpins',free_left,'awardedFreeSpins',awarded,'frames',frames,'createdAt',now());
 INSERT INTO public.casino_slot_spins(id,user_id,game,stake,charged,payout,result) VALUES(p_request_id,u,p_game,p_stake,charged,total,result);
 RETURN result;
END; $$;

DROP FUNCTION public._slot_refresh_boost(uuid);
ALTER TABLE public.casino_slot_accounts DROP CONSTRAINT slot_boost_cycle;
ALTER TABLE public.casino_slot_accounts DROP COLUMN boost_remaining, DROP COLUMN boost_resets_at;
