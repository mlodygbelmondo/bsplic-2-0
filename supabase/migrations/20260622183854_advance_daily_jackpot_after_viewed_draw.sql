-- Track replay views per participant and let the home jackpot banner move on
-- to the next pool after a user has watched the finished draw.

CREATE TABLE IF NOT EXISTS public.daily_jackpot_draw_views (
  pool_id UUID NOT NULL REFERENCES public.daily_jackpot_pools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (pool_id, user_id)
);

CREATE INDEX IF NOT EXISTS daily_jackpot_draw_views_user_id_idx
  ON public.daily_jackpot_draw_views(user_id);

ALTER TABLE public.daily_jackpot_draw_views ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.daily_jackpot_draw_views FROM PUBLIC, anon, authenticated;

INSERT INTO public.daily_jackpot_draw_views (pool_id, user_id, viewed_at)
SELECT p.id, p.winner_user_id, p.result_viewed_at
  FROM public.daily_jackpot_pools p
 WHERE p.status = 'drawn'
   AND p.winner_user_id IS NOT NULL
   AND p.result_viewed_at IS NOT NULL
ON CONFLICT (pool_id, user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.reveal_daily_jackpot_draw(p_pool_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_current_user_ticket_count INTEGER := 0;
  v_current_user_viewed_at TIMESTAMPTZ;
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

  IF v_current_user_ticket_count > 0 THEN
    INSERT INTO public.daily_jackpot_draw_views (pool_id, user_id, viewed_at)
    VALUES (v_pool.id, v_user_id, COALESCE(v_pool.result_viewed_at, NOW()))
    ON CONFLICT (pool_id, user_id) DO NOTHING;

    SELECT viewed_at
      INTO v_current_user_viewed_at
      FROM public.daily_jackpot_draw_views
     WHERE pool_id = v_pool.id
       AND user_id = v_user_id;
  END IF;

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
    'result_viewed_at', COALESCE(v_current_user_viewed_at, v_pool.result_viewed_at),
    'reward_claimed_at', v_pool.reward_claimed_at,
    'reward_auto_credited_at', v_pool.reward_auto_credited_at,
    'reward_credit_status', v_pool.reward_credit_status,
    'reward_credit_event_id', v_pool.reward_credit_event_id,
    'participants', v_participants,
    'server_now', NOW()
  );
END;
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
  v_pending_draw_pool_id UUID;
  v_pool_id UUID;
  v_snapshot JSONB;
  v_today DATE := (timezone('Europe/Warsaw', NOW()))::DATE;
  v_user_id UUID := auth.uid();
  v_visible_pool_date DATE;
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

  SELECT p.id
    INTO v_pending_draw_pool_id
    FROM public.daily_jackpot_pools p
   WHERE p.status = 'drawn'
     AND p.pool_date <= v_today
     AND EXISTS (
       SELECT 1
         FROM public.daily_jackpot_tickets t
        WHERE t.pool_id = p.id
          AND t.user_id = v_user_id
     )
     AND NOT EXISTS (
       SELECT 1
         FROM public.daily_jackpot_draw_views viewed
        WHERE viewed.pool_id = p.id
          AND viewed.user_id = v_user_id
     )
     AND NOT (
       p.winner_user_id = v_user_id
       AND p.result_viewed_at IS NOT NULL
     )
   ORDER BY p.pool_date DESC
   LIMIT 1;

  IF v_pending_draw_pool_id IS NOT NULL THEN
    v_snapshot := private.get_daily_jackpot_snapshot(v_pending_draw_pool_id, v_user_id);
    RETURN jsonb_set(v_snapshot, '{maintenance_auto_credited_count}', to_jsonb(v_auto_credited_count), true);
  END IF;

  v_visible_pool_date := v_today;

  IF EXISTS (
    SELECT 1
      FROM public.daily_jackpot_pools p
     WHERE p.pool_date = v_today
       AND p.status IN ('drawn', 'rolled_over', 'cancelled')
       AND p.draw_scheduled_at <= NOW()
  ) THEN
    v_visible_pool_date := v_today + 1;
  END IF;

  v_pool_id := private.sync_daily_jackpot_funding(v_visible_pool_date);

  IF v_pool_id IS NULL THEN
    v_snapshot := private.get_empty_daily_jackpot_snapshot(v_visible_pool_date);
  ELSE
    v_snapshot := private.get_daily_jackpot_snapshot(v_pool_id, v_user_id);
  END IF;

  RETURN jsonb_set(v_snapshot, '{maintenance_auto_credited_count}', to_jsonb(v_auto_credited_count), true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reveal_daily_jackpot_draw(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reveal_daily_jackpot_draw(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_daily_jackpot_state() TO authenticated;

NOTIFY pgrst, 'reload schema';
