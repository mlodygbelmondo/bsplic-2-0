BEGIN;
CREATE TEMP SEQUENCE bonus_group_calls;
CREATE OR REPLACE FUNCTION public._slot_symbol() RETURNS integer LANGUAGE sql AS $$ SELECT 7 $$;
CREATE OR REPLACE FUNCTION public._slot_random() RETURNS double precision LANGUAGE sql AS $$ SELECT 0.99::double precision $$;
CREATE OR REPLACE FUNCTION public._slot_groups(p_board integer[],p_game text) RETURNS jsonb LANGUAGE plpgsql VOLATILE AS $$
BEGIN
 IF nextval('pg_temp.bonus_group_calls')%2=0 THEN RETURN '[]'::jsonb; END IF;
 RETURN jsonb_build_array(jsonb_build_object('symbol',0,'cells',CASE WHEN p_game='candy' THEN '[0,1,2,3,4,5,6,7]'::jsonb ELSE '[0,1,2,6,7]'::jsonb END));
END; $$;
DO $$
DECLARE uid uuid:=gen_random_uuid(); game text; stake numeric; paid jsonb; bonus jsonb; request uuid; wallet numeric;
BEGIN
 INSERT INTO profiles(id,balance) VALUES(uid,100000);
 PERFORM set_config('request.jwt.claim.sub',uid::text,true);
 FOREACH game IN ARRAY ARRAY['bandit','candy','ember','tide'] LOOP
  FOREACH stake IN ARRAY ARRAY[1,5,250] LOOP
   UPDATE casino_slot_bonus SET remaining=0 WHERE user_id=uid;
   paid:=casino_slot_spin(game,stake,gen_random_uuid());
   IF (paid->>'awardedFreeSpins')::int<>15 THEN RAISE EXCEPTION 'missing award'; END IF;
   SELECT balance INTO wallet FROM profiles WHERE id=uid;
   request:=gen_random_uuid();
   bonus:=casino_slot_bonus_spin(game,stake,request);
   IF (bonus->>'payout')::numeric<>round(0.75*(paid->>'payout')::numeric,2) THEN RAISE EXCEPTION 'bonus must pay 75 percent for the same board: %',game; END IF;
   IF (bonus#>>'{frames,0,multiplier}')::int<>(paid#>>'{frames,0,multiplier}')::int THEN RAISE EXCEPTION 'visible multiplier'; END IF;
   IF (bonus->>'charged')::numeric<>0 OR (bonus->>'freeSpins')::int<>14 OR (bonus->>'awardedFreeSpins')::int<>0 THEN RAISE EXCEPTION 'bonus accounting'; END IF;
   IF (bonus->>'balance')::numeric<>wallet+(bonus->>'payout')::numeric THEN RAISE EXCEPTION 'wallet'; END IF;
   IF casino_slot_bonus_spin(game,stake,request)<>bonus THEN RAISE EXCEPTION 'replay'; END IF;
   UPDATE casino_slot_bonus SET remaining=1 WHERE user_id=uid;
   bonus:=casino_slot_bonus_spin(game,stake,gen_random_uuid());
   IF (bonus->>'payout')::numeric<>round(0.75*(paid->>'payout')::numeric,2) OR (bonus->>'freeSpins')::int<>0 THEN RAISE EXCEPTION 'last spin payout'; END IF;
   SELECT balance INTO wallet FROM profiles WHERE id=uid;
   BEGIN
    PERFORM casino_slot_bonus_spin(game,stake,gen_random_uuid());
    RAISE EXCEPTION 'unexpected paid autoplay';
   EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'BONUS_FINISHED' THEN RAISE; END IF;
   END;
   IF (SELECT balance FROM profiles WHERE id=uid)<>wallet THEN RAISE EXCEPTION 'autoplay debit'; END IF;
  END LOOP;
 END LOOP;
 RAISE NOTICE 'PASS: smaller bonus payouts and displayed multipliers, locked stake, wallet, replay and last free spin';
END; $$;
-- A huge cluster must still respect the per-spin cap after the bonus payout.
CREATE OR REPLACE FUNCTION public._slot_groups(p_board integer[],p_game text) RETURNS jsonb LANGUAGE sql AS $$
 SELECT jsonb_build_array(jsonb_build_object('symbol',6,'cells',(SELECT jsonb_agg(i) FROM generate_series(0,29) i)))
$$;
DO $$
DECLARE uid uuid:=gen_random_uuid(); game text; r jsonb;
BEGIN
 INSERT INTO profiles(id,balance) VALUES(uid,0);
 PERFORM set_config('request.jwt.claim.sub',uid::text,true);
 FOREACH game IN ARRAY ARRAY['bandit','candy','ember','tide'] LOOP
  INSERT INTO casino_slot_bonus(user_id,game,remaining,stake) VALUES(uid,game,1,5);
  r:=casino_slot_spin(game,5,gen_random_uuid());
  IF (r->>'payout')::numeric<>1000 OR (r->>'charged')::numeric<>0 THEN RAISE EXCEPTION 'bonus cap %',game; END IF;
 END LOOP;
 RAISE NOTICE 'PASS: bonus payout respects 200x cap with an empty wallet';
END; $$;
ROLLBACK;
