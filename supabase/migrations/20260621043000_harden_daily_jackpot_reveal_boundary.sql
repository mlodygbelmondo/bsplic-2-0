-- Keep jackpot state snapshots spoiler-free and remove broad direct pool reads.

DROP POLICY IF EXISTS "Authenticated users can read jackpot pools"
  ON public.daily_jackpot_pools;
DROP POLICY IF EXISTS "Admins can read jackpot pools"
  ON public.daily_jackpot_pools;

CREATE POLICY "Admins can read jackpot pools"
  ON public.daily_jackpot_pools
  FOR SELECT
  TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'));

CREATE OR REPLACE FUNCTION private.get_daily_jackpot_snapshot(
  p_pool_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_snapshot JSONB;
BEGIN
  SELECT jsonb_build_object(
    'pool_id', p.id,
    'pool_date', p.pool_date,
    'status', p.status,
    'prize_amount', p.prize_amount,
    'ticket_price', p.ticket_price,
    'max_tickets_per_player', 2,
    'min_unique_users', p.min_unique_users,
    'participant_count', (
      SELECT COUNT(DISTINCT t.user_id)
        FROM public.daily_jackpot_tickets t
       WHERE t.pool_id = p.id
    ),
    'ticket_count', (
      SELECT COUNT(*)
        FROM public.daily_jackpot_tickets t
       WHERE t.pool_id = p.id
    ),
    'draw_scheduled_at', p.draw_scheduled_at,
    'current_user_has_ticket', EXISTS (
      SELECT 1
        FROM public.daily_jackpot_tickets t
       WHERE t.pool_id = p.id
         AND t.user_id = p_user_id
    ),
    'current_user_ticket_count', (
      SELECT COUNT(*)
        FROM public.daily_jackpot_tickets t
       WHERE t.pool_id = p.id
         AND t.user_id = p_user_id
    ),
    'current_user_ticket_number', (
      SELECT t.ticket_number
        FROM public.daily_jackpot_tickets t
       WHERE t.pool_id = p.id
         AND t.user_id = p_user_id
       ORDER BY t.ticket_number
       LIMIT 1
    ),
    'current_user_ticket_numbers', COALESCE((
      SELECT jsonb_agg(t.ticket_number ORDER BY t.ticket_number)
        FROM public.daily_jackpot_tickets t
       WHERE t.pool_id = p.id
         AND t.user_id = p_user_id
    ), '[]'::jsonb),
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
  )
    INTO v_snapshot
    FROM public.daily_jackpot_pools p
   WHERE p.id = p_pool_id;

  RETURN v_snapshot;
END;
$$;

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
    'ticket_price', 100,
    'max_tickets_per_player', 2,
    'min_unique_users', 3,
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

CREATE OR REPLACE FUNCTION public.get_daily_jackpot_state()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
SET lock_timeout = '3s'
AS $$
DECLARE
  v_auto_credited_count INTEGER := 0;
  v_due RECORD;
  v_pool_id UUID;
  v_snapshot JSONB;
  v_today DATE := (timezone('Europe/Warsaw', NOW()))::DATE;
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Zaloguj się';
  END IF;

  v_auto_credited_count :=
    private.auto_credit_unclaimed_daily_jackpot_rewards(v_today);

  v_pool_id := private.sync_daily_jackpot_funding(v_today);

  FOR v_due IN
    SELECT pool_date
      FROM public.daily_jackpot_pools
     WHERE status IN ('collecting', 'locked')
       AND draw_scheduled_at <= NOW()
     ORDER BY pool_date ASC
     LIMIT 5
  LOOP
    PERFORM private.finalize_daily_jackpot_pool(v_due.pool_date, v_user_id);
  END LOOP;

  SELECT id
    INTO v_pool_id
    FROM public.daily_jackpot_pools
   WHERE pool_date = v_today;

  IF v_pool_id IS NULL THEN
    v_snapshot := private.get_empty_daily_jackpot_snapshot(v_today);
  ELSE
    v_snapshot := private.get_daily_jackpot_snapshot(v_pool_id, v_user_id);
  END IF;

  RETURN jsonb_set(v_snapshot, '{maintenance_auto_credited_count}', to_jsonb(v_auto_credited_count), true);
END;
$$;

REVOKE ALL ON FUNCTION private.get_daily_jackpot_snapshot(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.get_empty_daily_jackpot_snapshot(DATE)
  FROM PUBLIC, anon, authenticated;
