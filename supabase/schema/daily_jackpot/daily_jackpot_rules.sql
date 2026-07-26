-- Canonical current definition (private schema). Mirror of the newest migration;
-- kept in sync by jackpotLifecycleConsolidation.test.ts. Change via a fresh migration.

CREATE OR REPLACE FUNCTION private.daily_jackpot_rules()
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT JSONB_BUILD_OBJECT(
    'max_tickets_per_player', 2,
    'default_ticket_price', 100,
    'default_min_unique_users', 3
  );
$$;
