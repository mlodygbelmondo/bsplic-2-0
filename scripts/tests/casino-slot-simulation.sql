-- Actual RPC simulation, never run against production. Includes free-spin payouts.
BEGIN;
DO $$
DECLARE uid uuid:=gen_random_uuid(); v_game text; r jsonb; n integer; paid_count integer; wins integer; total_payout numeric; max_payout numeric;
BEGIN
 INSERT INTO profiles(id,balance) VALUES(uid,1000000);
 PERFORM set_config('request.jwt.claim.sub',uid::text,true);
 FOREACH v_game IN ARRAY ARRAY['bandit','candy','ember','tide'] LOOP
  paid_count:=0; wins:=0; total_payout:=0; max_payout:=0;
  WHILE paid_count<10000 OR coalesce((SELECT remaining FROM casino_slot_bonus WHERE user_id=uid AND casino_slot_bonus.game=v_game),0)>0 LOOP
   r:=casino_slot_spin(v_game,10,gen_random_uuid());
   IF (r->>'charged')::numeric>0 THEN
    paid_count:=paid_count+1;
    IF (r->>'net')::numeric>0 THEN wins:=wins+1; END IF;
   END IF;
   total_payout:=total_payout+(r->>'payout')::numeric;
   max_payout:=greatest(max_payout,(r->>'payout')::numeric/10);
  END LOOP;
  RAISE NOTICE 'SIM %: paid=%, profitable_paid_pct=%, observed_return_pct=%, max_stake_multiple=%',v_game,paid_count,round(wins*100.0/paid_count,2),round(total_payout*100/(paid_count*10),2),max_payout;
 END LOOP;
END; $$;
ROLLBACK;
