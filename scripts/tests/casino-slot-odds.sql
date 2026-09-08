BEGIN;
-- A scatter-only natural board isolates the injected profitable group.
CREATE OR REPLACE FUNCTION public._slot_symbol() RETURNS integer LANGUAGE sql AS $$ SELECT 7 $$;
CREATE OR REPLACE FUNCTION public._slot_random() RETURNS double precision LANGUAGE sql AS $$ SELECT current_setting('test.slot_draw')::double precision $$;
DO $$
DECLARE uid uuid:=gen_random_uuid(); game text; boosted boolean; draw double precision; r jsonb; expected boolean; before_remaining integer; request uuid;
BEGIN
 INSERT INTO profiles(id,balance) VALUES(uid,100000);
 INSERT INTO casino_slot_accounts(user_id,boost_remaining,boost_resets_at) VALUES(uid,15,NULL);
 PERFORM set_config('request.jwt.claim.sub',uid::text,true);
 FOREACH game IN ARRAY ARRAY['bandit','candy','ember','tide'] LOOP
  FOREACH boosted IN ARRAY ARRAY[false,true] LOOP
   FOREACH draw IN ARRAY ARRAY[0.0,0.599999,0.60,0.899999,0.90,0.999999] LOOP
    PERFORM set_config('test.slot_draw',draw::text,true);
    UPDATE casino_slot_accounts SET boost_remaining=CASE WHEN boosted THEN 15 ELSE 0 END,
     boost_resets_at=CASE WHEN boosted THEN NULL ELSE clock_timestamp()+interval '1 day' END WHERE user_id=uid;
    UPDATE casino_slot_bonus SET remaining=0 WHERE user_id=uid;
    UPDATE casino_slot_spins SET created_at=now()-interval '1 minute' WHERE user_id=uid;
    request:=gen_random_uuid();
    r:=casino_slot_spin(game,1,request);
    expected:=draw<(CASE WHEN boosted THEN 0.90 ELSE 0.60 END);
    IF ((r->>'net')::numeric>0)<>expected THEN RAISE EXCEPTION 'profit threshold: %, %, %, %',game,boosted,draw,r->>'net'; END IF;
    IF (r->>'boosted')::boolean<>boosted THEN RAISE EXCEPTION 'boost flag'; END IF;
    IF casino_slot_spin(game,1,request)<>r THEN RAISE EXCEPTION 'new game replay'; END IF;
    IF casino_slot_state(game)->'history'->0->>'id'<>request::text THEN RAISE EXCEPTION 'new game history'; END IF;
    IF game='tide' AND expected AND (r->'frames'->0->>'multiplier')::integer<>3 THEN RAISE EXCEPTION 'tide fixed multiplier'; END IF;
   END LOOP;
  END LOOP;
 END LOOP;
 RAISE NOTICE 'PASS: all games profitable injection, exact 60/90 percent boundaries, minimum stake, replay, history';
END; $$;
-- Guaranteed matches verify Ember's per-cascade progression through the cap.
CREATE OR REPLACE FUNCTION public._slot_symbol() RETURNS integer LANGUAGE sql AS $$ SELECT 0 $$;
CREATE OR REPLACE FUNCTION public._slot_groups(p_board integer[],p_game text) RETURNS jsonb LANGUAGE sql AS $$ SELECT '[{"symbol":0,"cells":[0,1,2,6,7]}]'::jsonb $$;
DO $$
DECLARE uid uuid:=gen_random_uuid(); r jsonb; frame jsonb; idx integer;
BEGIN
 INSERT INTO profiles(id,balance) VALUES(uid,10000);
 INSERT INTO casino_slot_accounts(user_id,boost_remaining,boost_resets_at) VALUES(uid,0,clock_timestamp()+interval '1 day');
 PERFORM set_config('request.jwt.claim.sub',uid::text,true);
 PERFORM set_config('test.slot_draw','0.99',true);
 r:=casino_slot_spin('ember',1,gen_random_uuid());
 FOR frame,idx IN SELECT value,ordinality::integer FROM jsonb_array_elements(r->'frames') WITH ORDINALITY LOOP
  IF (frame->>'multiplier')::integer<>least(idx,5) THEN RAISE EXCEPTION 'ember progression'; END IF;
 END LOOP;
 IF jsonb_array_length(r->'frames')<>12 THEN RAISE EXCEPTION 'cascade count'; END IF;
 IF (r->>'payout')::numeric>500 THEN RAISE EXCEPTION 'cap'; END IF;
 RAISE NOTICE 'PASS: Ember cascade progression and payout cap';
END; $$;
ROLLBACK;
