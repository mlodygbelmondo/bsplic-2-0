-- Run only against a disposable local database after the slots migration.
-- Rolls back all fixtures and function substitutions, including on disconnect.
\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE b integer[]:=array_fill(7,ARRAY[30]); groups jsonb; first jsonb; again jsonb; r jsonb; uid uuid:=gen_random_uuid(); other uuid:=gen_random_uuid(); request uuid:=gen_random_uuid(); wallet numeric; n integer;
BEGIN
 INSERT INTO profiles(id,balance) VALUES(uid,10000),(other,10000);
 PERFORM set_config('request.jwt.claim.sub',uid::text,true);
 -- Adjacency must not wrap between the right and left board edges.
 b[5]:=0; b[6]:=0; b[7]:=0; b[8]:=0; b[9]:=0;
 IF jsonb_array_length(_slot_groups(b,'bandit'))<>0 THEN RAISE EXCEPTION 'row wrap falsely wins'; END IF;
 b:=array_fill(7,ARRAY[30]); b[1]:=0;b[2]:=0;b[3]:=0;b[7]:=0;b[8]:=0;
 IF jsonb_array_length(_slot_groups(b,'bandit'))<>1 THEN RAISE EXCEPTION 'connected group missing'; END IF;
 b:=array_fill(7,ARRAY[30]);
 FOREACH n IN ARRAY ARRAY[1,3,5,8,10,12,15,17] LOOP b[n]:=0; END LOOP;
 IF jsonb_array_length(_slot_groups(b,'candy'))<>1 OR jsonb_array_length(_slot_groups(b,'bandit'))<>0 THEN RAISE EXCEPTION 'candy anywhere rule'; END IF;
 IF jsonb_array_length(casino_slot_state('bandit')->'history')<>0 THEN RAISE EXCEPTION 'initial history'; END IF;
 first:=casino_slot_spin('bandit',5,request);
 IF casino_slot_state('bandit')->'history'->0->>'id'<>request::text THEN RAISE EXCEPTION 'state history'; END IF;
 IF (casino_slot_state('bandit')->>'boostRemaining')::integer<>9 THEN RAISE EXCEPTION 'state welcome count'; END IF;
 SELECT balance INTO wallet FROM profiles WHERE id=uid;
 again:=casino_slot_spin('bandit',5,request);
 IF first<>again OR (SELECT balance FROM profiles WHERE id=uid)<>wallet THEN RAISE EXCEPTION 'idempotency'; END IF;
 IF wallet<>10000-5+(first->>'payout')::numeric THEN RAISE EXCEPTION 'wallet mismatch'; END IF;
 BEGIN PERFORM casino_slot_spin('candy',5,request); RAISE EXCEPTION 'conflict accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'REQUEST_CONFLICT' THEN RAISE; END IF; END;
 FOREACH n IN ARRAY ARRAY[-1,0,101] LOOP
  BEGIN PERFORM casino_slot_spin('bandit',n,gen_random_uuid()); RAISE EXCEPTION 'invalid stake accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'INVALID_STAKE' THEN RAISE; END IF; END;
 END LOOP;
 BEGIN PERFORM casino_slot_spin('bandit','NaN',gen_random_uuid()); RAISE EXCEPTION 'NaN accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'INVALID_STAKE' THEN RAISE; END IF; END;
 PERFORM set_config('request.jwt.claim.sub','',true);
 BEGIN PERFORM casino_slot_spin('bandit',5,gen_random_uuid()); RAISE EXCEPTION 'anonymous accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'AUTH_REQUIRED' THEN RAISE; END IF; END;
 PERFORM set_config('request.jwt.claim.sub',other::text,true);
 BEGIN PERFORM casino_slot_spin('bandit',5,request); RAISE EXCEPTION 'other user replay accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'REQUEST_CONFLICT' THEN RAISE; END IF; END;
 PERFORM set_config('request.jwt.claim.sub',uid::text,true);
 UPDATE profiles SET balance=0 WHERE id=uid;
 BEGIN PERFORM casino_slot_spin('bandit',5,gen_random_uuid()); RAISE EXCEPTION 'overdraft accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'INSUFFICIENT_BALANCE' THEN RAISE; END IF; END;
 UPDATE casino_slot_bonus SET remaining=2,stake=5 WHERE user_id=uid AND game='bandit';
 r:=casino_slot_spin('bandit',5,gen_random_uuid());
 IF (r->>'charged')::numeric<>0 OR (r->>'freeSpins')::integer<>1 THEN RAISE EXCEPTION 'free spin'; END IF;
 BEGIN PERFORM casino_slot_spin('bandit',6,gen_random_uuid()); RAISE EXCEPTION 'bonus stake change'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'BONUS_STAKE_LOCKED' THEN RAISE; END IF; END;
 UPDATE profiles SET balance=10000 WHERE id=uid;
 UPDATE casino_slot_bonus SET remaining=0 WHERE user_id=uid;
 UPDATE casino_slot_accounts SET paid_spins=10 WHERE user_id=uid;
 r:=casino_slot_spin('candy',5,gen_random_uuid());
 IF (r->>'boosted')::boolean OR (r->>'boostRemaining')::integer<>0 THEN RAISE EXCEPTION 'welcome reset'; END IF;
 IF has_function_privilege('authenticated','public._slot_random()','EXECUTE') THEN RAISE EXCEPTION 'helper exposed'; END IF;
 IF has_table_privilege('authenticated','public.casino_slot_spins','INSERT') THEN RAISE EXCEPTION 'write exposed'; END IF;
 RAISE NOTICE 'PASS: clusters, anywhere wins, wallet, idempotency, validation, auth, free spins, welcome expiry, permissions';
END; $$;
-- Deterministic scatter board tests the bonus award path, not probability.
CREATE OR REPLACE FUNCTION public._slot_symbol() RETURNS integer LANGUAGE sql AS $$ SELECT 7 $$;
DO $$
DECLARE uid uuid:=gen_random_uuid(); r jsonb;
BEGIN
 INSERT INTO profiles(id,balance) VALUES(uid,100);
 INSERT INTO casino_slot_accounts(user_id,paid_spins) VALUES(uid,10);
 PERFORM set_config('request.jwt.claim.sub',uid::text,true);
 r:=casino_slot_spin('bandit',5,gen_random_uuid());
 IF (r->>'awardedFreeSpins')::integer<>8 OR (r->>'freeSpins')::integer<>8 THEN RAISE EXCEPTION 'scatter bonus'; END IF;
 r:=casino_slot_spin('bandit',5,gen_random_uuid());
 IF (r->>'awardedFreeSpins')::integer<>0 OR (r->>'freeSpins')::integer<>7 THEN RAISE EXCEPTION 'bonus retriggers'; END IF;
 RAISE NOTICE 'PASS: scatter bonus award and no retrigger';
END; $$;
-- All matches exercise the cascade bound and win cap with a known outcome.
CREATE OR REPLACE FUNCTION public._slot_symbol() RETURNS integer LANGUAGE sql AS $$ SELECT 6 $$;
DO $$
DECLARE uid uuid:=gen_random_uuid(); r jsonb;
BEGIN
 INSERT INTO profiles(id,balance) VALUES(uid,100);
 INSERT INTO casino_slot_accounts(user_id,paid_spins) VALUES(uid,10);
 PERFORM set_config('request.jwt.claim.sub',uid::text,true);
 r:=casino_slot_spin('bandit',5,gen_random_uuid());
 IF (r->>'payout')::numeric<>2500 OR jsonb_array_length(r->'frames')>12 THEN RAISE EXCEPTION 'win cap'; END IF;
 IF (SELECT balance FROM profiles WHERE id=uid)<>2595 THEN RAISE EXCEPTION 'capped wallet'; END IF;
 RAISE NOTICE 'PASS: max win cap and bounded cascades';
END; $$;
ROLLBACK;
