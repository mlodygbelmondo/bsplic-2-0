-- Disposable local database only. Deterministic draws exercise cycle boundaries.
BEGIN;
CREATE OR REPLACE FUNCTION public._slot_random() RETURNS double precision LANGUAGE sql AS $$ SELECT 0.99::double precision $$;
DO $$
DECLARE uid uuid:=gen_random_uuid(); request uuid:=gen_random_uuid(); r jsonb; first jsonb; deadline timestamptz; n integer;
BEGIN
 INSERT INTO profiles(id,balance) VALUES(uid,10000);
 PERFORM set_config('request.jwt.claim.sub',uid::text,true);
 r:=casino_slot_state('bandit');
 IF (r->>'boostRemaining')::integer<>15 THEN RAISE EXCEPTION 'upper cycle size'; END IF;
 IF (casino_slot_state('candy')->>'boostRemaining')::integer<>15 THEN RAISE EXCEPTION 'shared cycle'; END IF;
 first:=casino_slot_spin('bandit',5,request);
 IF NOT (first->>'boosted')::boolean OR (first->>'boostRemaining')::integer<>14 THEN RAISE EXCEPTION 'paid consumes boost'; END IF;
 r:=casino_slot_spin('bandit',5,request);
 IF r<>first OR (casino_slot_state('bandit')->>'boostRemaining')::integer<>14 THEN RAISE EXCEPTION 'retry consumes boost'; END IF;
 -- Force a free spin regardless of the board drawn above.
 UPDATE casino_slot_bonus SET remaining=1,stake=5 WHERE user_id=uid AND game='bandit';
 r:=casino_slot_spin('bandit',5,gen_random_uuid());
 IF (r->>'boosted')::boolean OR (r->>'boostRemaining')::integer<>14 THEN RAISE EXCEPTION 'free consumes boost'; END IF;
 UPDATE casino_slot_accounts SET boost_remaining=1 WHERE user_id=uid;
 r:=casino_slot_spin('candy',5,gen_random_uuid());
 SELECT boost_resets_at INTO deadline FROM casino_slot_accounts WHERE user_id=uid;
 IF (r->>'boostRemaining')::integer<>0 OR deadline NOT BETWEEN clock_timestamp()+interval '12 hours' AND clock_timestamp()+interval '36 hours' THEN RAISE EXCEPTION 'cooldown bounds'; END IF;
 UPDATE casino_slot_bonus SET remaining=0 WHERE user_id=uid;
 r:=casino_slot_spin('bandit',5,gen_random_uuid());
 IF (r->>'boosted')::boolean OR (SELECT boost_resets_at FROM casino_slot_accounts WHERE user_id=uid)<>deadline THEN RAISE EXCEPTION 'cooldown extended or ignored'; END IF;
 IF (casino_slot_state('candy')->>'boostRemaining')::integer<>0 THEN RAISE EXCEPTION 'early refresh'; END IF;
 UPDATE casino_slot_accounts SET boost_resets_at=clock_timestamp()-interval '30 days' WHERE user_id=uid;
 IF (casino_slot_state('candy')->>'boostRemaining')::integer<>15 THEN RAISE EXCEPTION 'overdue refresh or stacking'; END IF;
 IF (casino_slot_state('bandit')->>'boostRemaining')::integer<>15 THEN RAISE EXCEPTION 'refresh rerolls'; END IF;
 -- Spin itself renews an expired cycle without requiring a state request.
 UPDATE casino_slot_accounts SET boost_remaining=0,boost_resets_at=clock_timestamp()-interval '1 second' WHERE user_id=uid;
 UPDATE casino_slot_bonus SET remaining=0 WHERE user_id=uid;
 r:=casino_slot_spin('bandit',5,gen_random_uuid());
 IF NOT (r->>'boosted')::boolean OR (r->>'boostRemaining')::integer<>14 THEN RAISE EXCEPTION 'spin refresh'; END IF;
 IF has_function_privilege('authenticated','public._slot_refresh_boost(uuid)','EXECUTE') OR has_table_privilege('authenticated','public.casino_slot_accounts','UPDATE') THEN RAISE EXCEPTION 'cycle writable by client'; END IF;
 RAISE NOTICE 'PASS: shared recurring boost, paid/free spins, retries, cooldown, renewal, no stacking, permissions';
END; $$;
CREATE OR REPLACE FUNCTION public._slot_random() RETURNS double precision LANGUAGE sql AS $$ SELECT 0::double precision $$;
DO $$
DECLARE uid uuid:=gen_random_uuid(); r jsonb; deadline timestamptz;
BEGIN
 INSERT INTO profiles(id,balance) VALUES(uid,10000);
 PERFORM set_config('request.jwt.claim.sub',uid::text,true);
 IF (casino_slot_state('bandit')->>'boostRemaining')::integer<>5 THEN RAISE EXCEPTION 'lower cycle size'; END IF;
 UPDATE casino_slot_accounts SET boost_remaining=1 WHERE user_id=uid;
 r:=casino_slot_spin('bandit',5,gen_random_uuid());
 SELECT boost_resets_at INTO deadline FROM casino_slot_accounts WHERE user_id=uid;
 IF abs(extract(epoch FROM deadline-clock_timestamp()-interval '12 hours'))>2 THEN RAISE EXCEPTION 'lower cooldown bound'; END IF;
 RAISE NOTICE 'PASS: minimum cycle and cooldown';
END; $$;
ROLLBACK;
