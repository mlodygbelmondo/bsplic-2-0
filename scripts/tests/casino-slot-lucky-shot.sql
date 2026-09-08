BEGIN;
CREATE OR REPLACE FUNCTION public._slot_symbol() RETURNS integer LANGUAGE sql AS $$ SELECT 7 $$;
CREATE OR REPLACE FUNCTION public._slot_random() RETURNS double precision LANGUAGE sql AS $$ SELECT current_setting('test.slot_draw')::double precision $$;
DO $$
DECLARE uid uuid:=gen_random_uuid(); r jsonb; first jsonb; request uuid:=gen_random_uuid(); last_time timestamptz; game text;
BEGIN
 INSERT INTO profiles(id,balance) VALUES(uid,10000);
 PERFORM set_config('request.jwt.claim.sub',uid::text,true);
 PERFORM set_config('test.slot_draw','0.009999',true);
 UPDATE casino_slot_activity SET last_spin_at=clock_timestamp()-interval '5 hours 59 minutes';
 r:=casino_slot_spin('tide',5,gen_random_uuid());
 IF (r->>'luckyShot')::boolean THEN RAISE EXCEPTION 'early opportunity'; END IF;
 UPDATE casino_slot_bonus SET remaining=0 WHERE user_id=uid;
 UPDATE casino_slot_activity SET last_spin_at=clock_timestamp()-interval '6 hours';
 first:=casino_slot_spin('bandit',5,request);
 IF NOT (first->>'luckyShot')::boolean OR (first->>'payout')::numeric<>1000 OR (first->>'net')::numeric<>995 THEN RAISE EXCEPTION 'jackpot award'; END IF;
 SELECT last_spin_at INTO last_time FROM casino_slot_activity;
 r:=casino_slot_spin('bandit',5,request);
 IF r<>first OR (SELECT last_spin_at FROM casino_slot_activity)<>last_time THEN RAISE EXCEPTION 'replay modifies jackpot'; END IF;
 r:=casino_slot_spin('candy',5,gen_random_uuid());
 IF (r->>'luckyShot')::boolean OR (r->>'payout')::numeric<>0 THEN RAISE EXCEPTION 'repeated or forced win'; END IF;
 -- Free spin after another long gap neither claims nor consumes the chance.
 UPDATE casino_slot_activity SET last_spin_at=clock_timestamp()-interval '7 hours';
 SELECT last_spin_at INTO last_time FROM casino_slot_activity;
 r:=casino_slot_spin('bandit',5,gen_random_uuid());
 IF (r->>'luckyShot')::boolean OR (r->>'charged')::numeric<>0 OR (SELECT last_spin_at FROM casino_slot_activity)<>last_time THEN RAISE EXCEPTION 'free jackpot'; END IF;
 -- Exactly 1% fails, and failure consumes the opportunity for everyone.
 PERFORM set_config('test.slot_draw','0.01',true);
 r:=casino_slot_spin('ember',5,gen_random_uuid());
 IF (r->>'luckyShot')::boolean THEN RAISE EXCEPTION 'probability boundary'; END IF;
 PERFORM set_config('test.slot_draw','0',true);
 r:=casino_slot_spin('tide',5,gen_random_uuid());
 IF (r->>'luckyShot')::boolean OR (r->>'payout')::numeric<>0 THEN RAISE EXCEPTION 'failed chance retried'; END IF;
 -- No forced wins in any game, even at the lowest possible random draw.
 FOREACH game IN ARRAY ARRAY['bandit','candy','ember','tide'] LOOP
  UPDATE casino_slot_bonus SET remaining=0 WHERE user_id=uid;
  r:=casino_slot_spin(game,5,gen_random_uuid());
  IF (r->>'payout')::numeric<>0 THEN RAISE EXCEPTION 'forced win remains %',game; END IF;
 END LOOP;
 -- Invalid requests roll back the activity claim.
 UPDATE casino_slot_activity SET last_spin_at=clock_timestamp()-interval '7 hours';
 SELECT last_spin_at INTO last_time FROM casino_slot_activity;
 UPDATE profiles SET balance=0 WHERE id=uid;
 UPDATE casino_slot_bonus SET remaining=0 WHERE user_id=uid;
 BEGIN
  PERFORM casino_slot_spin('bandit',5,gen_random_uuid());
  RAISE EXCEPTION 'insufficient balance accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'INSUFFICIENT_BALANCE' THEN RAISE; END IF; END;
 IF (SELECT last_spin_at FROM casino_slot_activity)<>last_time THEN RAISE EXCEPTION 'invalid attempt consumes opportunity'; END IF;
 IF has_table_privilege('authenticated','casino_slot_activity','UPDATE') THEN RAISE EXCEPTION 'activity client writable'; END IF;
 RAISE NOTICE 'PASS: inactivity threshold, 1 percent boundary, x200 net, replay, global expiry, free spins, no injected wins';
END; $$;
ROLLBACK;
