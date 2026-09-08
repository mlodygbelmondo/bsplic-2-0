BEGIN;
CREATE OR REPLACE FUNCTION public._slot_symbol() RETURNS integer LANGUAGE sql AS $$ SELECT 7 $$;
CREATE OR REPLACE FUNCTION public._slot_random() RETURNS double precision LANGUAGE sql AS $$ SELECT 0.99::double precision $$;
DO $$
DECLARE uid uuid:=gen_random_uuid(); game text; r jsonb; request uuid; n integer; wallet numeric;
BEGIN
 INSERT INTO profiles(id,balance) VALUES(uid,10000);
 PERFORM set_config('request.jwt.claim.sub',uid::text,true);
 FOREACH game IN ARRAY ARRAY['bandit','candy','ember','tide'] LOOP
  request:=gen_random_uuid();
  r:=casino_slot_spin(game,5,request);
  IF (r->>'awardedFreeSpins')::integer<>10 OR (r->>'freeSpins')::integer<>10 THEN RAISE EXCEPTION 'award %',game; END IF;
  IF casino_slot_spin(game,5,request)<>r THEN RAISE EXCEPTION 'duplicate award'; END IF;
  IF (casino_slot_state(game)->>'freeSpins')::integer<>10 THEN RAISE EXCEPTION 'state count'; END IF;
  SELECT balance INTO wallet FROM profiles WHERE id=uid;
  FOR n IN REVERSE 9..0 LOOP
   r:=casino_slot_spin(game,5,gen_random_uuid());
   IF (r->>'charged')::numeric<>0 OR (r->>'awardedFreeSpins')::integer<>0 OR (r->>'freeSpins')::integer<>n THEN RAISE EXCEPTION 'free spin progression % %',game,n; END IF;
  END LOOP;
  IF (SELECT balance FROM profiles WHERE id=uid)<>wallet THEN RAISE EXCEPTION 'free debit'; END IF;
 END LOOP;
 RAISE NOTICE 'PASS: all four games award 10 spins once, persist them, consume without charge or retrigger';
END; $$;
ROLLBACK;
