-- Actual RPC simulation in a disposable database. Fixed seed makes comparisons repeatable.
-- A paid round includes its awarded free spins. Lucky shots need real idle periods and are excluded.
\if :{?paid_target}
\else
\set paid_target 20000
\endif
SELECT set_config('test.paid_target', :'paid_target', false);
BEGIN;
CREATE OR REPLACE FUNCTION public._slot_random() RETURNS double precision LANGUAGE sql VOLATILE AS $$ SELECT random() $$;
DO $$
DECLARE uid uuid:=gen_random_uuid(); v_game text; r jsonb; paid_count integer; wins integer;
 total_payout numeric; max_payout numeric; cycle_payout numeric; squared_payout numeric; round_net numeric;
 session_payout numeric; profitable_sessions integer; target integer:=current_setting('test.paid_target')::integer;
BEGIN
 IF target<1000 OR target>1000000 OR target%10<>0 THEN RAISE EXCEPTION 'invalid sample size'; END IF;
 INSERT INTO profiles(id,balance) VALUES(uid,100000000);
 PERFORM set_config('request.jwt.claim.sub',uid::text,true);
 FOREACH v_game IN ARRAY ARRAY['bandit','candy','ember','tide'] LOOP
  PERFORM setseed(0.314159);
  paid_count:=0; wins:=0; total_payout:=0; max_payout:=0; squared_payout:=0;
  session_payout:=0; profitable_sessions:=0;
  WHILE paid_count<target LOOP
   r:=casino_slot_spin(v_game,10,gen_random_uuid());
   IF (r->>'charged')::numeric<>10 OR (r->>'luckyShot')::boolean THEN RAISE EXCEPTION 'invalid paid sample'; END IF;
   paid_count:=paid_count+1;
   IF (r->>'net')::numeric>0 THEN wins:=wins+1; END IF;
   cycle_payout:=(r->>'payout')::numeric;
   max_payout:=greatest(max_payout,(r->>'payout')::numeric/10);
   WHILE (r->>'freeSpins')::integer>0 LOOP
    r:=casino_slot_spin(v_game,10,gen_random_uuid());
    cycle_payout:=cycle_payout+(r->>'payout')::numeric;
    max_payout:=greatest(max_payout,(r->>'payout')::numeric/10);
   END LOOP;
   total_payout:=total_payout+cycle_payout;
   squared_payout:=squared_payout+power(cycle_payout/10,2);
   session_payout:=session_payout+cycle_payout;
   IF paid_count%10=0 THEN
    IF session_payout>100 THEN profitable_sessions:=profitable_sessions+1; END IF;
    session_payout:=0;
   END IF;
  END LOOP;
  RAISE NOTICE 'SIM %: paid=%, profitable_paid_pct=%, return_pct=%, approximate_95pct_margin_pp=%, profitable_10_round_sessions_pct=%, max_stake_multiple=%',v_game,paid_count,round(wins*100.0/paid_count,2),round(total_payout*100/(paid_count*10),2),round(1.96*100*sqrt(greatest(0,(squared_payout-power(total_payout/10,2)/paid_count)/(paid_count-1)/paid_count)),2),round(profitable_sessions*100.0/(paid_count/10),2),max_payout;
 END LOOP;
END; $$;
ROLLBACK;
