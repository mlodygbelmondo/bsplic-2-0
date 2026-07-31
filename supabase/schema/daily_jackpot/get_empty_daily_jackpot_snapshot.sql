-- Canonical current definition (private schema). Mirror of the newest migration;
-- kept in sync by jackpotLifecycleConsolidation.test.ts. Change via a fresh migration.

CREATE OR REPLACE FUNCTION private.get_empty_daily_jackpot_snapshot(p_pool_date DATE)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'pool_id', NULL,
    'pool_date', p_pool_date,
    'status', 'collecting',
    'prize_amount', 0,
    'ticket_price', (private.daily_jackpot_rules()->>'default_ticket_price')::NUMERIC,
    'max_tickets_per_player', (private.daily_jackpot_rules()->>'max_tickets_per_player')::INTEGER,
    'min_unique_users', (private.daily_jackpot_rules()->>'default_min_unique_users')::INTEGER,
    'participant_count', 0,
    'ticket_count', 0,
    'draw_scheduled_at', public.get_warsaw_draw_at(p_pool_date),
    'current_user_has_ticket', false,
    'current_user_ticket_count', 0,
    'current_user_ticket_number', NULL,
    'current_user_ticket_numbers', '[]'::jsonb,
    'winner_user_id', NULL,
    'winner_username', NULL,
    'winner_avatar_url', NULL,
    'winning_ticket_number', NULL,
    'result_viewed_at', NULL,
    'reward_claimed_at', NULL,
    'reward_auto_credited_at', NULL,
    'reward_credit_status', 'not_applicable',
    'reward_credit_event_id', NULL,
    'maintenance_auto_credited_count', 0,
    'server_now', NOW()
  );
$$;
