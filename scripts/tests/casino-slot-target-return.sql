BEGIN;
CREATE TEMP SEQUENCE group_calls;
CREATE OR REPLACE FUNCTION public._slot_symbol() RETURNS integer LANGUAGE sql AS $$ SELECT 7 $$;
CREATE OR REPLACE FUNCTION public._slot_random() RETURNS double precision LANGUAGE sql AS $$ SELECT 0.99::double precision $$;
-- Isolate one winning group followed by an empty cascade to verify money arithmetic.
CREATE OR REPLACE FUNCTION public._slot_groups(p_board integer[],p_game text) RETURNS jsonb LANGUAGE plpgsql VOLATILE AS $$
BEGIN
 IF nextval('pg_temp.group_calls')%2=0 THEN RETURN '[]'::jsonb; END IF;
 RETURN jsonb_build_array(jsonb_build_object('symbol',current_setting('test.symbol')::integer,'cells',CASE WHEN p_game='candy' THEN '[0,1,2,3,4,5,6,7]'::jsonb ELSE '[0,1,2,6,7]'::jsonb END));
END; $$;
DO $$
DECLARE uid uuid:=gen_random_uuid(); v_game text; stake numeric; symbol integer; r jsonb; expected numeric;
BEGIN
 INSERT INTO profiles(id,balance) VALUES(uid,100000);
 PERFORM set_config('request.jwt.claim.sub',uid::text,true);
 FOREACH v_game IN ARRAY ARRAY['bandit','candy','ember','tide'] LOOP
  FOREACH stake IN ARRAY ARRAY[1,5,100] LOOP
   FOREACH symbol IN ARRAY ARRAY[0,6] LOOP
    PERFORM set_config('test.symbol',symbol::text,true);
    UPDATE casino_slot_bonus SET remaining=0 WHERE user_id=uid;
    r:=casino_slot_spin(v_game,stake,gen_random_uuid());
    expected:=round(stake*(CASE v_game WHEN 'bandit' THEN 2.5654 WHEN 'candy' THEN 0.2111 WHEN 'ember' THEN 2.532 WHEN 'tide' THEN 0.2108 END)*(1+symbol*0.25),2)*(CASE WHEN v_game='candy' THEN 5 WHEN v_game='tide' THEN 3 ELSE 1 END);
    IF (r->>'payout')::numeric<>expected OR (r->>'net')::numeric<>expected-stake THEN RAISE EXCEPTION 'payout mismatch % % %',v_game,stake,symbol; END IF;
   END LOOP;
  END LOOP;
 END LOOP;
 RAISE NOTICE 'PASS: 90 percent target payout tables, rounding, multipliers and net across all games';
END; $$;
ROLLBACK;
