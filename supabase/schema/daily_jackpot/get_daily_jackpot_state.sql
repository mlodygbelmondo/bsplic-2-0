-- Canonical current definition (public schema). Mirror of the newest migration;
-- kept in sync by jackpotLifecycleConsolidation.test.ts. Change via a fresh migration.

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
   WHERE p.status IN ('drawn', 'rolled_over')
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
