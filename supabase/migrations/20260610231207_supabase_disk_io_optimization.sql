-- Disk IO optimization slice:
-- - Keep Realtime publication only for browser-subscribed tables.
-- - Collapse roulette table reads into one snapshot RPC.
-- - Move roulette advancement to a privileged scheduled path.
-- - Add retention for append-only Social invalidation rows.
-- - Move admin dashboard summary reads behind one aggregate RPC.
--
-- Rollback publication membership if an external subscriber depends on removed
-- tables:
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.placed_bets;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.bet_proposals;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.casino_roulette_bets;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.social_posts;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.social_comments;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.social_reactions;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.casino_social_shares;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'placed_bets'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.placed_bets;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'bet_proposals'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.bet_proposals;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'casino_roulette_bets'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.casino_roulette_bets;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'social_posts'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.social_posts;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'social_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.social_comments;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'social_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.social_reactions;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'casino_social_shares'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.casino_social_shares;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'bets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bets;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'categories'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'casino_roulette_rounds'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.casino_roulette_rounds;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'social_realtime_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.social_realtime_events;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'user_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;
  END IF;
END
$$;

ALTER TABLE public.user_notifications REPLICA IDENTITY FULL;

CREATE OR REPLACE FUNCTION public.get_roulette_table_snapshot(
  p_table_key TEXT DEFAULT 'main',
  p_recent_spins_limit INTEGER DEFAULT 10,
  p_recent_wins_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  current_round JSONB,
  recent_spins JSONB,
  recent_wins JSONB,
  active_bets JSONB,
  round_participants JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Wymagane uwierzytelnienie';
  END IF;

  RETURN QUERY
  WITH current_round_row AS MATERIALIZED (
    SELECT
      r.id,
      r.table_key,
      r.round_number,
      r.phase,
      r.betting_opens_at,
      r.betting_closes_at,
      r.spin_started_at,
      r.settled_at,
      r.winning_number,
      r.winning_color,
      r.created_at
    FROM public.casino_roulette_rounds AS r
    WHERE r.table_key = p_table_key
    ORDER BY r.round_number DESC
    LIMIT 1
  ),
  recent_spin_rows AS (
    SELECT
      r.id,
      r.table_key,
      r.round_number,
      r.phase,
      r.betting_opens_at,
      r.betting_closes_at,
      r.spin_started_at,
      r.settled_at,
      r.winning_number,
      r.winning_color,
      r.created_at
    FROM public.casino_roulette_rounds AS r
    WHERE r.table_key = p_table_key
      AND r.phase = 'settled'
    ORDER BY r.round_number DESC
    LIMIT LEAST(GREATEST(COALESCE(p_recent_spins_limit, 10), 1), 50)
  ),
  recent_win_rows AS (
    SELECT
      b.id,
      b.round_id,
      b.user_id,
      p.username,
      p.avatar_url,
      b.bet_type,
      b.bet_value,
      b.stake,
      b.payout,
      b.is_win,
      b.created_at,
      b.settled_at,
      r.round_number
    FROM public.casino_roulette_bets AS b
    JOIN public.casino_roulette_rounds AS r ON r.id = b.round_id
    JOIN public.profiles AS p ON p.id = b.user_id
    WHERE r.table_key = p_table_key
      AND b.is_win = TRUE
      AND b.payout > 0
    ORDER BY COALESCE(b.settled_at, b.created_at) DESC
    LIMIT LEAST(GREATEST(COALESCE(p_recent_wins_limit, 20), 1), 100)
  ),
  active_bet_rows AS (
    SELECT
      b.id,
      b.round_id,
      b.user_id,
      b.bet_type,
      b.bet_value,
      b.stake,
      b.payout,
      b.is_win,
      b.created_at,
      b.settled_at
    FROM public.casino_roulette_bets AS b
    WHERE b.round_id = (SELECT c.id FROM current_round_row AS c)
      AND b.user_id = auth.uid()
    ORDER BY b.created_at DESC
  ),
  participant_rows AS (
    SELECT
      b.user_id,
      p.username,
      p.avatar_url,
      SUM(b.stake) AS total_stake,
      COUNT(*)::INTEGER AS bet_count,
      jsonb_agg(
        jsonb_build_object(
          'bet_type', b.bet_type,
          'bet_value', b.bet_value,
          'stake', b.stake
        )
        ORDER BY b.created_at DESC
      ) AS bets
    FROM public.casino_roulette_bets AS b
    JOIN public.profiles AS p ON p.id = b.user_id
    WHERE b.round_id = (SELECT c.id FROM current_round_row AS c)
    GROUP BY b.user_id, p.username, p.avatar_url
    ORDER BY SUM(b.stake) DESC, p.username ASC
    LIMIT 20
  )
  SELECT
    COALESCE((SELECT to_jsonb(current_round_row) FROM current_round_row), 'null'::jsonb),
    COALESCE((SELECT jsonb_agg(to_jsonb(recent_spin_rows) ORDER BY recent_spin_rows.round_number DESC) FROM recent_spin_rows), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(to_jsonb(recent_win_rows) ORDER BY COALESCE(recent_win_rows.settled_at, recent_win_rows.created_at) DESC) FROM recent_win_rows), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(to_jsonb(active_bet_rows) ORDER BY active_bet_rows.created_at DESC) FROM active_bet_rows), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(to_jsonb(participant_rows) ORDER BY participant_rows.total_stake DESC, participant_rows.username ASC) FROM participant_rows), '[]'::jsonb);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_roulette_table_snapshot(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_roulette_table_snapshot(TEXT, INTEGER, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.advance_roulette_round_if_due(p_table_key TEXT DEFAULT 'main')
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_round public.casino_roulette_rounds%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_next_round_number BIGINT;
  v_winning_number INTEGER;
  v_winning_color TEXT;
  v_reveal_duration INTERVAL := INTERVAL '6 seconds';
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('roulette:' || COALESCE(p_table_key, 'main'))) THEN
    RETURN;
  END IF;

  SELECT * INTO v_round
  FROM public.casino_roulette_rounds AS r
  WHERE r.table_key = p_table_key
  ORDER BY r.round_number DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.casino_roulette_rounds (
      table_key,
      round_number,
      phase,
      betting_opens_at,
      betting_closes_at
    )
    VALUES (
      p_table_key,
      1,
      'waiting',
      v_now,
      v_now + INTERVAL '15 seconds'
    );
    RETURN;
  END IF;

  IF v_round.phase = 'waiting' AND v_now >= v_round.betting_closes_at THEN
    v_winning_number := FLOOR(random() * 37)::INTEGER;
    v_winning_color := public.get_roulette_color(v_winning_number);

    UPDATE public.casino_roulette_rounds AS r
    SET phase = 'spinning',
        spin_started_at = v_now,
        winning_number = v_winning_number,
        winning_color = v_winning_color
    WHERE r.id = v_round.id;

    RETURN;
  END IF;

  IF v_round.phase = 'spinning'
     AND v_round.spin_started_at IS NOT NULL
     AND v_now >= v_round.spin_started_at + v_reveal_duration THEN
    UPDATE public.casino_roulette_bets AS b
    SET
      is_win = CASE
        WHEN b.bet_type = 'straight' THEN v_round.winning_number = b.bet_value::INTEGER
        WHEN b.bet_type = 'color' THEN v_round.winning_color = b.bet_value
        WHEN b.bet_type = 'parity' THEN v_round.winning_number <> 0 AND (
          (b.bet_value = 'even' AND MOD(v_round.winning_number, 2) = 0) OR
          (b.bet_value = 'odd' AND MOD(v_round.winning_number, 2) = 1)
        )
        WHEN b.bet_type = 'range' THEN (
          (b.bet_value = 'low' AND v_round.winning_number BETWEEN 1 AND 18) OR
          (b.bet_value = 'high' AND v_round.winning_number BETWEEN 19 AND 36)
        )
        ELSE FALSE
      END,
      payout = CASE
        WHEN b.bet_type = 'straight' AND v_round.winning_number = b.bet_value::INTEGER THEN ROUND(b.stake * 36, 2)
        WHEN b.bet_type = 'color' AND v_round.winning_color = b.bet_value THEN ROUND(b.stake * 2, 2)
        WHEN b.bet_type = 'parity' AND v_round.winning_number <> 0 AND (
          (b.bet_value = 'even' AND MOD(v_round.winning_number, 2) = 0) OR
          (b.bet_value = 'odd' AND MOD(v_round.winning_number, 2) = 1)
        ) THEN ROUND(b.stake * 2, 2)
        WHEN b.bet_type = 'range' AND (
          (b.bet_value = 'low' AND v_round.winning_number BETWEEN 1 AND 18) OR
          (b.bet_value = 'high' AND v_round.winning_number BETWEEN 19 AND 36)
        ) THEN ROUND(b.stake * 2, 2)
        ELSE 0
      END,
      settled_at = v_now
    WHERE b.round_id = v_round.id;

    UPDATE public.profiles AS p
    SET balance = ROUND(p.balance + payouts.total_payout, 2)
    FROM (
      SELECT b.user_id, COALESCE(SUM(b.payout), 0) AS total_payout
      FROM public.casino_roulette_bets AS b
      WHERE b.round_id = v_round.id
      GROUP BY b.user_id
    ) AS payouts
    WHERE p.id = payouts.user_id;

    UPDATE public.casino_roulette_rounds AS r
    SET phase = 'settled',
        settled_at = v_now
    WHERE r.id = v_round.id;

    SELECT COALESCE(MAX(r.round_number), 0) + 1
    INTO v_next_round_number
    FROM public.casino_roulette_rounds AS r
    WHERE r.table_key = p_table_key;

    INSERT INTO public.casino_roulette_rounds (
      table_key,
      round_number,
      phase,
      betting_opens_at,
      betting_closes_at
    )
    VALUES (
      p_table_key,
      v_next_round_number,
      'waiting',
      v_now,
      v_now + INTERVAL '15 seconds'
    );
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.advance_roulette_round_if_due(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.advance_roulette_round_if_due(TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.delete_old_social_realtime_events()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM public.social_realtime_events
  WHERE created_at < NOW() - INTERVAL '2 days';

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_old_social_realtime_events() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_old_social_realtime_events() TO service_role;

CREATE OR REPLACE FUNCTION public.admin_get_dashboard_summary()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_bets BIGINT := 0;
  v_total_pool NUMERIC := 0;
  v_pending_proposals BIGINT := 0;
  v_active_bets BIGINT := 0;
  v_resolved_today BIGINT := 0;
  v_top_category TEXT;
  v_recent_activity JSONB := '[]'::jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Brak uprawnień administratora';
  END IF;

  SELECT COUNT(*), COALESCE(SUM(pb.stake), 0)
  INTO v_total_bets, v_total_pool
  FROM public.placed_bets AS pb;

  SELECT COUNT(*)
  INTO v_pending_proposals
  FROM public.bet_proposals AS bp
  WHERE bp.status = 'pending';

  SELECT COUNT(*)
  INTO v_active_bets
  FROM public.bets AS b
  WHERE b.is_active = TRUE;

  SELECT COUNT(*)
  INTO v_resolved_today
  FROM public.bets AS b
  WHERE b.winning_option IS NOT NULL
    AND b.created_at >= (
      date_trunc('day', NOW() AT TIME ZONE 'Europe/Warsaw')
      AT TIME ZONE 'Europe/Warsaw'
    );

  SELECT CONCAT(c.emoji, ' ', c.name)
  INTO v_top_category
  FROM public.bets AS b
  JOIN public.categories AS c ON c.id = b.category_id
  WHERE b.is_active = TRUE
    AND b.category_id IS NOT NULL
  GROUP BY c.id, c.emoji, c.name
  ORDER BY COUNT(*) DESC, c.sort_order ASC, c.name ASC
  LIMIT 1;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', recent.id,
      'title', recent.title,
      'winning_option', recent.winning_option,
      'resolved_at', recent.created_at
    )
    ORDER BY recent.created_at DESC
  ), '[]'::jsonb)
  INTO v_recent_activity
  FROM (
    SELECT b.id, b.title, b.winning_option, b.created_at
    FROM public.bets AS b
    WHERE b.winning_option IS NOT NULL
    ORDER BY b.created_at DESC
    LIMIT 5
  ) AS recent;

  RETURN jsonb_build_object(
    'stats', jsonb_build_object(
      'total_bets', v_total_bets,
      'total_pool', v_total_pool,
      'pending_proposals', v_pending_proposals,
      'active_bets', v_active_bets,
      'resolved_today', v_resolved_today,
      'top_category', v_top_category
    ),
    'recent_activity', v_recent_activity
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_get_dashboard_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_dashboard_summary() TO authenticated;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $$
BEGIN
  IF to_regnamespace('cron') IS NOT NULL THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname IN (
      'bsplic-roulette-advance-main',
      'bsplic-social-realtime-events-retention'
    );

    PERFORM cron.schedule(
      'bsplic-roulette-advance-main',
      '*/5 * * * * *',
      $job$SELECT public.advance_roulette_round_if_due('main');$job$
    );

    PERFORM cron.schedule(
      'bsplic-social-realtime-events-retention',
      '15 3 * * *',
      $job$SELECT public.delete_old_social_realtime_events();$job$
    );
  END IF;
END
$$;
