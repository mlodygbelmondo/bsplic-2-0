#!/usr/bin/env bash
# Isolated PostgreSQL contract tests; never reads application credentials.
set -euo pipefail
command -v initdb >/dev/null
command -v pg_ctl >/dev/null
command -v psql >/dev/null
slots_test_dir=$(mktemp -d /tmp/bsplic-slots-test.XXXXXX)
slots_test_root=$(cd "$(dirname "$0")/.." && pwd)
cleanup() {
  pg_ctl -D "$slots_test_dir/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$slots_test_dir"
}
trap cleanup EXIT
initdb -D "$slots_test_dir/data" -A trust --no-locale >"$slots_test_dir/init.log"
pg_ctl -D "$slots_test_dir/data" -l "$slots_test_dir/server.log" -o "-h '' -k $slots_test_dir" start >/dev/null
psql -h "$slots_test_dir" -d postgres -v ON_ERROR_STOP=1 <<'SQL'
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE public.profiles(id uuid PRIMARY KEY, balance numeric(12,2) NOT NULL DEFAULT 500);
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
SQL
psql -h "$slots_test_dir" -d postgres -v ON_ERROR_STOP=1 -f "$slots_test_root/supabase/migrations/20260907090000_casino_slots.sql"
psql -h "$slots_test_dir" -d postgres -v ON_ERROR_STOP=1 -f "$slots_test_root/supabase/migrations/20260907180000_fix_casino_slot_state.sql"
psql -h "$slots_test_dir" -d postgres -v ON_ERROR_STOP=1 -f "$slots_test_root/scripts/tests/casino-slots.sql"
psql -h "$slots_test_dir" -d postgres -v ON_ERROR_STOP=1 -f "$slots_test_root/supabase/migrations/20260907200000_recurring_slot_boost.sql"
psql -h "$slots_test_dir" -d postgres -v ON_ERROR_STOP=1 -f "$slots_test_root/scripts/tests/casino-slot-boost.sql"
psql -h "$slots_test_dir" -d postgres -v ON_ERROR_STOP=1 -f "$slots_test_root/supabase/migrations/20260908090000_more_slots_player_odds.sql"
psql -h "$slots_test_dir" -d postgres -v ON_ERROR_STOP=1 -f "$slots_test_root/scripts/tests/casino-slot-odds.sql"
psql -h "$slots_test_dir" -d postgres -v ON_ERROR_STOP=1 -f "$slots_test_root/supabase/migrations/20260908093000_ten_slot_free_spins.sql"
psql -h "$slots_test_dir" -d postgres -v ON_ERROR_STOP=1 -f "$slots_test_root/scripts/tests/casino-slot-free-spins.sql"
# Two simultaneous connections replay one request: exactly one debit and ledger row.
psql -h "$slots_test_dir" -d postgres -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO profiles(id,balance) VALUES('11111111-1111-4111-8111-111111111111',500);
INSERT INTO casino_slot_accounts(user_id,boost_remaining,boost_resets_at) VALUES('11111111-1111-4111-8111-111111111111',1,NULL);
SQL
for attempt in 1 2; do
  psql -h "$slots_test_dir" -d postgres -v ON_ERROR_STOP=1 >"$slots_test_dir/request-$attempt.log" <<'SQL' &
SET ROLE authenticated;
SET request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
SELECT casino_slot_spin('candy',5,'22222222-2222-4222-8222-222222222222');
SQL
  if [ "$attempt" = 1 ]; then slots_pid_one=$!; else slots_pid_two=$!; fi
done
wait "$slots_pid_one"
wait "$slots_pid_two"
psql -h "$slots_test_dir" -d postgres -v ON_ERROR_STOP=1 <<'SQL'
DO $$ BEGIN
 IF (SELECT count(*) FROM casino_slot_spins)<>1 THEN RAISE EXCEPTION 'concurrent duplicate'; END IF;
 IF (SELECT balance FROM profiles)<>495+(SELECT payout FROM casino_slot_spins) THEN RAISE EXCEPTION 'concurrent wallet'; END IF;
 IF (SELECT boost_remaining FROM casino_slot_accounts)<>0 OR (SELECT paid_spins FROM casino_slot_accounts)<>1 OR (SELECT boost_resets_at FROM casino_slot_accounts) IS NULL THEN RAISE EXCEPTION 'concurrent boost consumption'; END IF;
 RAISE NOTICE 'PASS: concurrent authenticated requests have one debit and one boost consumption';
END; $$;
SET ROLE authenticated;
SET request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
DO $$ BEGIN
 IF (SELECT count(*) FROM casino_slot_spins)<>0 THEN RAISE EXCEPTION 'RLS data leak'; END IF;
 RAISE NOTICE 'PASS: RLS hides other accounts';
END; $$;
SQL
psql -h "$slots_test_dir" -d postgres -v ON_ERROR_STOP=1 -f "$slots_test_root/supabase/migrations/20260908130000_slot_inactivity_lucky_shot.sql"
psql -h "$slots_test_dir" -d postgres -v ON_ERROR_STOP=1 -f "$slots_test_root/scripts/tests/casino-slot-lucky-shot.sql"
psql -h "$slots_test_dir" -d postgres -v ON_ERROR_STOP=1 -f "$slots_test_root/supabase/migrations/20260908131000_slot_anywhere_payout_balance.sql"
psql -h "$slots_test_dir" -d postgres -v ON_ERROR_STOP=1 -f "$slots_test_root/supabase/migrations/20260908140000_reduced_slot_payouts.sql"
psql -h "$slots_test_dir" -d postgres -v ON_ERROR_STOP=1 -f "$slots_test_root/scripts/tests/casino-slot-payouts.sql"
if [ "${SLOT_SIMULATE:-0}" = 1 ]; then
  psql -h "$slots_test_dir" -d postgres -v ON_ERROR_STOP=1 -f "$slots_test_root/scripts/tests/casino-slot-simulation.sql"
fi
# Two users, two games, one shared inactivity opportunity.
psql -h "$slots_test_dir" -d postgres -v ON_ERROR_STOP=1 <<'SQL'
CREATE OR REPLACE FUNCTION public._slot_random() RETURNS double precision LANGUAGE sql AS $$ SELECT 0::double precision $$;
CREATE OR REPLACE FUNCTION public._slot_symbol() RETURNS integer LANGUAGE sql AS $$ SELECT 7 $$;
INSERT INTO profiles(id,balance) VALUES('44444444-4444-4444-8444-444444444444',500),('55555555-5555-4555-8555-555555555555',500);
UPDATE casino_slot_activity SET last_spin_at=clock_timestamp()-interval '7 hours';
SQL
psql -h "$slots_test_dir" -d postgres -v ON_ERROR_STOP=1 >"$slots_test_dir/lucky-one.log" <<'SQL' &
SET ROLE authenticated;
SET request.jwt.claim.sub='44444444-4444-4444-8444-444444444444';
SELECT casino_slot_spin('bandit',1,'66666666-6666-4666-8666-666666666666');
SQL
slots_pid_one=$!
psql -h "$slots_test_dir" -d postgres -v ON_ERROR_STOP=1 >"$slots_test_dir/lucky-two.log" <<'SQL' &
SET ROLE authenticated;
SET request.jwt.claim.sub='55555555-5555-4555-8555-555555555555';
SELECT casino_slot_spin('tide',1,'77777777-7777-4777-8777-777777777777');
SQL
slots_pid_two=$!
wait "$slots_pid_one"
wait "$slots_pid_two"
psql -h "$slots_test_dir" -d postgres -v ON_ERROR_STOP=1 <<'SQL'
DO $$ BEGIN
 IF (SELECT count(*) FROM casino_slot_spins WHERE (result->>'luckyShot')::boolean)<>1 THEN RAISE EXCEPTION 'concurrent jackpot'; END IF;
 RAISE NOTICE 'PASS: concurrent players claim exactly one global lucky shot';
END; $$;
SQL
