-- Original virtual-currency slots. All draws and wallet writes are server-owned.
CREATE TABLE public.casino_slot_accounts (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  paid_spins integer NOT NULL DEFAULT 0 CHECK (paid_spins >= 0)
);
CREATE TABLE public.casino_slot_bonus (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game text NOT NULL CHECK (game IN ('bandit', 'candy')),
  remaining integer NOT NULL DEFAULT 0 CHECK (remaining BETWEEN 0 AND 8),
  stake numeric(12,2) NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, game)
);
CREATE TABLE public.casino_slot_spins (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game text NOT NULL CHECK (game IN ('bandit', 'candy')),
  stake numeric(12,2) NOT NULL,
  charged numeric(12,2) NOT NULL,
  payout numeric(12,2) NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX casino_slot_spins_user_created ON public.casino_slot_spins(user_id, created_at DESC);
ALTER TABLE public.casino_slot_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.casino_slot_bonus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.casino_slot_spins ENABLE ROW LEVEL SECURITY;
CREATE POLICY slot_accounts_read ON public.casino_slot_accounts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY slot_bonus_read ON public.casino_slot_bonus FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY slot_spins_read ON public.casino_slot_spins FOR SELECT TO authenticated USING (user_id = auth.uid());
REVOKE ALL ON public.casino_slot_accounts, public.casino_slot_bonus, public.casino_slot_spins FROM anon, authenticated;
GRANT SELECT ON public.casino_slot_accounts, public.casino_slot_bonus, public.casino_slot_spins TO authenticated;

CREATE FUNCTION public._slot_random() RETURNS double precision
LANGUAGE plpgsql VOLATILE SET search_path = public, extensions AS $$
DECLARE b bytea := gen_random_bytes(4);
BEGIN
 RETURN (get_byte(b,0)::bigint * 16777216 + get_byte(b,1)::bigint * 65536 + get_byte(b,2)::bigint * 256 + get_byte(b,3)::bigint)::double precision / 4294967296.0;
END; $$;
CREATE FUNCTION public._slot_symbol() RETURNS integer
LANGUAGE plpgsql VOLATILE SET search_path = public AS $$
DECLARE r double precision := public._slot_random();
BEGIN
 IF r < 0.025 THEN RETURN 7; END IF;
 RETURN floor((r - 0.025) / 0.975 * 7)::integer;
END; $$;

-- Cells are row-major, zero-based in the public JSON. SQL arrays are one-based.
CREATE FUNCTION public._slot_groups(p_board integer[], p_game text) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
 seen integer[] := '{}'; group_cells integer[]; queue integer[];
 groups jsonb := '[]'; i integer; j integer; cell integer; neighbor integer;
BEGIN
 FOR i IN 1..30 LOOP
  IF p_board[i] = 7 OR i = ANY(seen) THEN CONTINUE; END IF;
  group_cells := '{}'; queue := ARRAY[i]; seen := array_append(seen,i);
  WHILE cardinality(queue) > 0 LOOP
   cell := queue[1]; queue := queue[2:]; group_cells := array_append(group_cells,cell-1);
   IF p_game = 'candy' THEN
    FOR j IN 1..30 LOOP
     IF p_board[j] = p_board[i] AND NOT j = ANY(seen) THEN
      seen := array_append(seen,j); queue := array_append(queue,j);
     END IF;
    END LOOP;
   ELSE
    FOREACH neighbor IN ARRAY ARRAY[cell-6,cell+6,CASE WHEN (cell-1)%6>0 THEN cell-1 ELSE 0 END,CASE WHEN (cell-1)%6<5 THEN cell+1 ELSE 0 END] LOOP
     IF neighbor BETWEEN 1 AND 30 AND NOT neighbor = ANY(seen) AND p_board[neighbor] = p_board[i] THEN
      seen := array_append(seen,neighbor); queue := array_append(queue,neighbor);
     END IF;
    END LOOP;
   END IF;
  END LOOP;
  IF cardinality(group_cells) >= (CASE WHEN p_game = 'candy' THEN 8 ELSE 5 END) THEN
   groups := groups || jsonb_build_array(jsonb_build_object('symbol',p_board[i],'cells',to_jsonb(group_cells)));
  END IF;
 END LOOP;
 RETURN groups;
END; $$;

CREATE FUNCTION public.casino_slot_state(p_game text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u uuid := auth.uid(); result jsonb;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 IF p_game IS NULL OR p_game NOT IN ('bandit','candy') THEN RAISE EXCEPTION 'INVALID_GAME'; END IF;
 SELECT jsonb_build_object(
  'boostRemaining',greatest(0,10-coalesce((SELECT paid_spins FROM public.casino_slot_accounts WHERE user_id=u),0)),
  'freeSpins',coalesce((SELECT remaining FROM public.casino_slot_bonus WHERE user_id=u AND game=p_game),0),
  'bonusStake',coalesce((SELECT stake FROM public.casino_slot_bonus WHERE user_id=u AND game=p_game),1),
  'history',coalesce((SELECT jsonb_agg(s.result ORDER BY s.created_at DESC) FROM (SELECT result,created_at FROM public.casino_slot_spins WHERE user_id=u AND game=p_game ORDER BY created_at DESC LIMIT 10) s),'[]'::jsonb)
 ) INTO result;
 RETURN result;
END; $$;

CREATE FUNCTION public.casino_slot_spin(p_game text, p_stake numeric, p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
 u uuid := auth.uid(); balance_before numeric; balance_after numeric; existing public.casino_slot_spins;
 paid integer; free_left integer; bonus_stake numeric; charged numeric; boosted boolean;
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
 INSERT INTO public.casino_slot_accounts(user_id) VALUES(u) ON CONFLICT DO NOTHING;
 SELECT paid_spins INTO paid FROM public.casino_slot_accounts WHERE user_id=u;
 INSERT INTO public.casino_slot_bonus(user_id,game) VALUES(u,p_game) ON CONFLICT DO NOTHING;
 SELECT remaining,stake INTO free_left,bonus_stake FROM public.casino_slot_bonus WHERE user_id=u AND game=p_game;
 IF free_left>0 AND p_stake<>bonus_stake THEN RAISE EXCEPTION 'BONUS_STAKE_LOCKED'; END IF;
 charged := CASE WHEN free_left>0 THEN 0 ELSE p_stake END;
 IF balance_before < charged THEN RAISE EXCEPTION 'INSUFFICIENT_BALANCE'; END IF;
 boosted := paid<10 AND free_left=0;
 FOR i IN 1..30 LOOP board := array_append(board,public._slot_symbol()); END LOOP;
 -- Disclosed welcome rule: 35% chance to seed one matching group, first 10 paid spins per account.
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
  UPDATE public.casino_slot_accounts SET paid_spins=paid WHERE user_id=u;
  free_left:=awarded; bonus_stake:=p_stake;
 ELSE free_left:=free_left-1; END IF;
 UPDATE public.casino_slot_bonus SET remaining=free_left,stake=bonus_stake WHERE user_id=u AND game=p_game;
 balance_after:=balance_before-charged+total;
 UPDATE public.profiles SET balance=balance_after WHERE id=u;
 result:=jsonb_build_object('id',p_request_id,'game',p_game,'stake',p_stake,'charged',charged,'payout',total,'net',total-charged,'balance',balance_after,'boosted',boosted,'boostRemaining',greatest(0,10-paid),'freeSpins',free_left,'awardedFreeSpins',awarded,'frames',frames,'createdAt',now());
 INSERT INTO public.casino_slot_spins(id,user_id,game,stake,charged,payout,result) VALUES(p_request_id,u,p_game,p_stake,charged,total,result);
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public._slot_random(), public._slot_symbol(), public._slot_groups(integer[],text), public.casino_slot_state(text), public.casino_slot_spin(text,numeric,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.casino_slot_state(text), public.casino_slot_spin(text,numeric,uuid) TO authenticated;
