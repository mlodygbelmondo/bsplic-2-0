-- Restore the draw reveal RPC in production where the historical migration is
-- marked as applied but the function is missing from pg_proc/PostgREST.

CREATE OR REPLACE FUNCTION public.reveal_daily_jackpot_draw(p_pool_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_current_user_ticket_count INTEGER := 0;
  v_participant_count INTEGER := 0;
  v_participants JSONB := '[]'::JSONB;
  v_pool public.daily_jackpot_pools%ROWTYPE;
  v_ticket_count INTEGER := 0;
  v_user_id UUID := auth.uid();
  v_winner_avatar_url TEXT;
  v_winner_username TEXT;
  v_winning_ticket_number INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Zaloguj się';
  END IF;

  SELECT *
    INTO v_pool
    FROM public.daily_jackpot_pools
   WHERE id = p_pool_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pula Jackpot nie istnieje';
  END IF;

  IF v_pool.status <> 'drawn' THEN
    RAISE EXCEPTION 'Losowanie nie jest jeszcze gotowe';
  END IF;

  IF v_pool.winner_user_id = v_user_id THEN
    UPDATE public.daily_jackpot_pools
       SET result_viewed_at = COALESCE(result_viewed_at, NOW()),
           updated_at = NOW()
     WHERE id = v_pool.id
     RETURNING * INTO v_pool;
  END IF;

  SELECT COUNT(DISTINCT user_id), COUNT(*)
    INTO v_participant_count, v_ticket_count
    FROM public.daily_jackpot_tickets
   WHERE pool_id = v_pool.id;

  SELECT COUNT(*)
    INTO v_current_user_ticket_count
    FROM public.daily_jackpot_tickets
   WHERE pool_id = v_pool.id
     AND user_id = v_user_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'user_id', participant_rows.user_id,
      'username', COALESCE(profile.username, 'Gracz'),
      'avatar_url', profile.avatar_url,
      'ticket_numbers', participant_rows.ticket_numbers,
      'ticket_count', participant_rows.ticket_count
    )
    ORDER BY participant_rows.first_ticket_number
  ), '[]'::JSONB)
    INTO v_participants
    FROM (
      SELECT
        t.user_id,
        MIN(t.ticket_number) AS first_ticket_number,
        ARRAY_AGG(t.ticket_number ORDER BY t.ticket_number) AS ticket_numbers,
        COUNT(*)::INTEGER AS ticket_count
      FROM public.daily_jackpot_tickets t
      WHERE t.pool_id = v_pool.id
      GROUP BY t.user_id
    ) participant_rows
    JOIN public.profiles profile ON profile.id = participant_rows.user_id;

  SELECT winner.username, winner.avatar_url, winning_ticket.ticket_number
    INTO v_winner_username, v_winner_avatar_url, v_winning_ticket_number
    FROM public.daily_jackpot_pools p
    LEFT JOIN public.profiles winner ON winner.id = p.winner_user_id
    LEFT JOIN public.daily_jackpot_tickets winning_ticket
      ON winning_ticket.id = p.winning_ticket_id
   WHERE p.id = v_pool.id;

  RETURN jsonb_build_object(
    'pool_id', v_pool.id,
    'pool_date', v_pool.pool_date,
    'status', v_pool.status,
    'prize_amount', v_pool.prize_amount,
    'ticket_price', v_pool.ticket_price,
    'min_unique_users', v_pool.min_unique_users,
    'participant_count', v_participant_count,
    'ticket_count', v_ticket_count,
    'draw_scheduled_at', v_pool.draw_scheduled_at,
    'drawn_at', v_pool.drawn_at,
    'winner_user_id', v_pool.winner_user_id,
    'winner_username', v_winner_username,
    'winner_avatar_url', v_winner_avatar_url,
    'winning_ticket_number', v_winning_ticket_number,
    'current_user_has_ticket', v_current_user_ticket_count > 0,
    'current_user_ticket_count', v_current_user_ticket_count,
    'current_user_is_winner', v_pool.winner_user_id = v_user_id,
    'result_viewed_at', v_pool.result_viewed_at,
    'reward_claimed_at', v_pool.reward_claimed_at,
    'reward_auto_credited_at', v_pool.reward_auto_credited_at,
    'reward_credit_status', v_pool.reward_credit_status,
    'reward_credit_event_id', v_pool.reward_credit_event_id,
    'participants', v_participants,
    'server_now', NOW()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reveal_daily_jackpot_draw(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_daily_jackpot_result_viewed(UUID) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.reveal_daily_jackpot_draw(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
