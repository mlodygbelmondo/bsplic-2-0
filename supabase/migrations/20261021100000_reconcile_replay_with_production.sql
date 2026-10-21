-- Make a fresh replay of the migrations match production.
--
-- Several older migration files were edited after production had already
-- applied them, so `supabase db reset` built different functions than the
-- ones production runs. Every definition below is copied verbatim from
-- production, which makes this migration a no-op there.
--
-- - settle_sportsbook_bet: production runs the inline version; the
--   private.sportsbook_settlement_* helpers from the edited 20260524172000
--   file never reached it.
-- - require_agent_scope, update_user_streak: same behaviour, production text.
-- - admin_finalize_daily_jackpot: finalize_daily_jackpot_if_due no longer
--   exists, so the replayed version could not run; production calls the
--   private finalizer and is not executable by anon.
-- - claim_daily_jackpot_reward, credit_daily_jackpot_reward: production
--   never got the "reveal before claim" check. Claiming credits the reward
--   and marks the result as viewed.

CREATE OR REPLACE FUNCTION private.settle_sportsbook_bet(
  p_bet_id UUID,
  p_winning_options TEXT[] DEFAULT ARRAY[]::TEXT[],
  p_mode TEXT DEFAULT 'normal',
  p_scope TEXT DEFAULT 'pending_only',
  p_actor_user_id UUID DEFAULT NULL,
  p_actor_source TEXT DEFAULT 'admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_bet public.bets%ROWTYPE;
  v_mode TEXT := COALESCE(p_mode, 'normal');
  v_scope TEXT := COALESCE(p_scope, 'pending_only');
  v_actor_source TEXT := COALESCE(NULLIF(BTRIM(p_actor_source), ''), 'admin');
  v_winners TEXT[];
  v_allowed_options TEXT[];
  v_unknown_winners TEXT[];
  v_winning_option_for_db TEXT;
  v_placed RECORD;
  v_coupon_before_stake NUMERIC;
  v_coupon_before_total_odds NUMERIC;
  v_coupon_before_status TEXT;
  v_coupon_before_payout NUMERIC;
  v_coupon_after_stake NUMERIC;
  v_coupon_after_total_odds NUMERIC;
  v_coupon_after_status TEXT;
  v_coupon_after_payout NUMERIC;
  v_previous_leg_result TEXT;
  v_previous_leg_payout NUMERIC;
  v_next_leg_result TEXT;
  v_next_leg_payout NUMERIC;
  v_before_impact NUMERIC;
  v_after_impact NUMERIC;
  v_delta NUMERIC;
  v_existing_credit NUMERIC;
  v_credits JSONB := '{}'::jsonb;
  v_credit RECORD;
  v_credit_amount NUMERIC;
  v_credit_rows JSONB := '[]'::jsonb;
  v_updated_leg_count INTEGER := 0;
  v_skipped_leg_count INTEGER := 0;
BEGIN
  IF v_mode NOT IN ('normal', 'refund', 'force_lost') THEN
    RAISE EXCEPTION 'Nieznany tryb rozliczenia: %', v_mode;
  END IF;

  IF v_scope NOT IN ('pending_only', 'all') THEN
    RAISE EXCEPTION 'Nieznany zakres rozliczenia: %', v_scope;
  END IF;

  SELECT *
    INTO v_bet
    FROM public.bets
   WHERE id = p_bet_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono zakładu';
  END IF;

  SELECT COALESCE(array_agg(winner ORDER BY ord), ARRAY[]::TEXT[])
    INTO v_winners
    FROM unnest(COALESCE(p_winning_options, ARRAY[]::TEXT[])) WITH ORDINALITY AS input(winner, ord)
   WHERE BTRIM(COALESCE(winner, '')) <> '';

  IF v_mode = 'normal' AND COALESCE(array_length(v_winners, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Wybierz co najmniej jedną zwycięską opcję';
  END IF;

  SELECT COALESCE(array_agg(option_name), ARRAY[]::TEXT[])
    INTO v_allowed_options
    FROM (
      SELECT option_value->>'name' AS option_name
        FROM jsonb_array_elements(COALESCE(v_bet.options, '[]'::jsonb)) AS option_value
       WHERE option_value ? 'name'
         AND BTRIM(COALESCE(option_value->>'name', '')) <> ''
    ) options;

  IF v_mode = 'normal' THEN
    SELECT COALESCE(array_agg(winner), ARRAY[]::TEXT[])
      INTO v_unknown_winners
      FROM unnest(v_winners) AS input(winner)
     WHERE NOT winner = ANY(v_allowed_options);

    IF COALESCE(array_length(v_unknown_winners, 1), 0) > 0 THEN
      RAISE EXCEPTION 'Nieznana zwycięska opcja: %', array_to_string(v_unknown_winners, ', ');
    END IF;
  END IF;

  IF v_mode = 'refund' THEN
    v_winning_option_for_db := '__refund__';
  ELSIF v_mode = 'force_lost' THEN
    v_winning_option_for_db := '__all_lost__';
  ELSIF COALESCE(array_length(v_winners, 1), 0) = 1 THEN
    v_winning_option_for_db := v_winners[1];
  ELSE
    v_winning_option_for_db := to_jsonb(v_winners)::TEXT;
  END IF;

  UPDATE public.bets
     SET winning_option = v_winning_option_for_db,
         is_active = false
   WHERE id = p_bet_id;

  FOR v_placed IN
    SELECT *
      FROM public.placed_bets
     WHERE bet_id = p_bet_id
     ORDER BY created_at ASC, id ASC
     FOR UPDATE
  LOOP
    IF v_scope = 'pending_only' AND v_placed.result <> 'pending' THEN
      v_skipped_leg_count := v_skipped_leg_count + 1;
      CONTINUE;
    END IF;

    v_previous_leg_result := CASE
      WHEN v_placed.result IN ('won', 'lost', 'refund') THEN v_placed.result
      ELSE 'pending'
    END;
    v_previous_leg_payout := ROUND(COALESCE(v_placed.payout, 0), 2);

    v_coupon_before_stake := NULL;
    v_coupon_before_total_odds := NULL;
    v_coupon_before_status := NULL;
    v_coupon_before_payout := NULL;
    IF v_placed.coupon_id IS NOT NULL THEN
      SELECT stake, total_odds, status, payout
        INTO v_coupon_before_stake,
             v_coupon_before_total_odds,
             v_coupon_before_status,
             v_coupon_before_payout
        FROM public.coupons
       WHERE id = v_placed.coupon_id
       FOR UPDATE;
    END IF;

    IF v_mode = 'force_lost' THEN
      v_next_leg_result := 'lost';
      v_next_leg_payout := 0;
    ELSIF v_mode = 'refund' THEN
      v_next_leg_result := 'refund';
      v_next_leg_payout := ROUND(COALESCE(v_placed.stake, 0), 2);
    ELSIF v_placed.selected_option = ANY(v_winners) THEN
      v_next_leg_result := 'won';
      v_next_leg_payout := ROUND(COALESCE(v_placed.stake, 0) * COALESCE(v_placed.odds_at_time, 0), 2);
    ELSE
      v_next_leg_result := 'lost';
      v_next_leg_payout := 0;
    END IF;

    UPDATE public.placed_bets
       SET result = v_next_leg_result,
           payout = v_next_leg_payout
     WHERE id = v_placed.id;

    v_coupon_after_stake := NULL;
    v_coupon_after_total_odds := NULL;
    v_coupon_after_status := NULL;
    v_coupon_after_payout := NULL;
    IF v_placed.coupon_id IS NOT NULL THEN
      SELECT stake, total_odds, status, payout
        INTO v_coupon_after_stake,
             v_coupon_after_total_odds,
             v_coupon_after_status,
             v_coupon_after_payout
        FROM public.coupons
       WHERE id = v_placed.coupon_id;
    END IF;

    IF v_placed.coupon_id IS NULL
      OR (
        COALESCE(v_coupon_before_total_odds, 1) <= 1
        AND COALESCE(v_coupon_after_total_odds, 1) <= 1
      )
    THEN
      v_before_impact := CASE
        WHEN v_previous_leg_result IN ('won', 'refund') THEN ROUND(v_previous_leg_payout, 2)
        ELSE 0
      END;
      v_after_impact := CASE
        WHEN v_next_leg_result IN ('won', 'refund') THEN ROUND(v_next_leg_payout, 2)
        ELSE 0
      END;
    ELSE
      v_before_impact := CASE
        WHEN v_coupon_before_status = 'won'
          THEN ROUND(COALESCE(NULLIF(v_coupon_before_payout, 0), v_coupon_before_stake * v_coupon_before_total_odds), 2)
        WHEN v_coupon_before_status = 'refund'
          THEN ROUND(COALESCE(NULLIF(v_coupon_before_payout, 0), v_coupon_before_stake), 2)
        ELSE 0
      END;
      v_after_impact := CASE
        WHEN v_coupon_after_status = 'won'
          THEN ROUND(COALESCE(NULLIF(v_coupon_after_payout, 0), v_coupon_after_stake * v_coupon_after_total_odds), 2)
        WHEN v_coupon_after_status = 'refund'
          THEN ROUND(COALESCE(NULLIF(v_coupon_after_payout, 0), v_coupon_after_stake), 2)
        ELSE 0
      END;
    END IF;

    v_delta := ROUND(v_after_impact - v_before_impact, 2);

    IF v_delta <> 0 THEN
      v_existing_credit := COALESCE((v_credits->>(v_placed.user_id::TEXT))::NUMERIC, 0);
      v_credits := jsonb_set(
        v_credits,
        ARRAY[v_placed.user_id::TEXT],
        to_jsonb(ROUND(v_existing_credit + v_delta, 2)),
        true
      );
    END IF;

    v_updated_leg_count := v_updated_leg_count + 1;
  END LOOP;

  FOR v_credit IN
    SELECT key AS user_id, value AS amount
      FROM jsonb_each_text(v_credits)
     ORDER BY key
  LOOP
    v_credit_amount := ROUND((v_credit.amount)::NUMERIC, 2);
    IF v_credit_amount = 0 THEN
      CONTINUE;
    END IF;

    UPDATE public.profiles
       SET balance = ROUND(balance + v_credit_amount, 2)
     WHERE id = (v_credit.user_id)::UUID;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Nie znaleziono profilu do rozliczenia';
    END IF;

    v_credit_rows := v_credit_rows || jsonb_build_array(jsonb_build_object(
      'user_id', v_credit.user_id,
      'amount', v_credit_amount
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'bet_id', p_bet_id,
    'bet_title', v_bet.title,
    'mode', v_mode,
    'scope', v_scope,
    'actor_source', v_actor_source,
    'actor_user_id', p_actor_user_id,
    'is_correction', v_bet.winning_option IS NOT NULL,
    'winning_option', v_winning_option_for_db,
    'winning_options', to_jsonb(v_winners),
    'updated_leg_count', v_updated_leg_count,
    'skipped_leg_count', v_skipped_leg_count,
    'credits', v_credit_rows,
    'settled_at', NOW()
  );
END;
$$;

DROP FUNCTION IF EXISTS private.sportsbook_settlement_add_credit(JSONB, UUID, NUMERIC);
DROP FUNCTION IF EXISTS private.sportsbook_settlement_credit_delta(
  TEXT, NUMERIC, TEXT, NUMERIC,
  NUMERIC, NUMERIC, TEXT, NUMERIC,
  NUMERIC, NUMERIC, TEXT, NUMERIC
);
DROP FUNCTION IF EXISTS private.sportsbook_settlement_coupon_impact(NUMERIC, NUMERIC, TEXT, NUMERIC);
DROP FUNCTION IF EXISTS private.sportsbook_settlement_leg_impact(TEXT, NUMERIC);
DROP FUNCTION IF EXISTS private.sportsbook_settlement_leg_payout(TEXT, TEXT, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS private.sportsbook_settlement_leg_result(TEXT, TEXT, TEXT[]);

CREATE OR REPLACE FUNCTION private.require_agent_scope(
  p_token TEXT,
  p_scope TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public
AS $$
DECLARE
  v_token_hash TEXT;
  v_record private.agent_api_tokens%ROWTYPE;
BEGIN
  v_token_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  SELECT *
    INTO v_record
    FROM private.agent_api_tokens
   WHERE token_hash = v_token_hash
     AND is_active = true
     AND p_scope = ANY(scopes);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unauthorized agent token';
  END IF;

  UPDATE private.agent_api_tokens
    SET last_used_at = now()
   WHERE id = v_record.id;

  RETURN jsonb_build_object(
    'token_id', v_record.id,
    'agent_user_id', v_record.agent_user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_user_streak()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_bet_date  DATE;
  v_current_streak INTEGER;
  v_longest_streak INTEGER;
  v_today          DATE := CURRENT_DATE;
BEGIN
  SELECT last_bet_date, current_streak, longest_streak
    INTO v_last_bet_date, v_current_streak, v_longest_streak
    FROM public.profiles
   WHERE id = NEW.user_id;

  IF v_last_bet_date = v_today THEN
    RETURN NEW;
  END IF;

  IF v_last_bet_date = v_today - 1 THEN
    v_current_streak := v_current_streak + 1;
  ELSE
    v_current_streak := 1;
  END IF;

  v_longest_streak := GREATEST(v_longest_streak, v_current_streak);

  UPDATE public.profiles
     SET current_streak  = v_current_streak,
         longest_streak  = v_longest_streak,
         last_bet_date   = v_today
   WHERE id = NEW.user_id;

  IF v_current_streak >= 7 THEN
    PERFORM public.award_badge(NEW.user_id, 'staly_bywalec');
  END IF;

  IF v_current_streak >= 30 THEN
    PERFORM public.award_badge(NEW.user_id, 'legenda');
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_finalize_daily_jackpot(p_pool_date DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Brak uprawnień administratora';
  END IF;

  RETURN private.finalize_daily_jackpot_pool(p_pool_date, auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION public.admin_finalize_daily_jackpot(DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_finalize_daily_jackpot(DATE) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.credit_daily_jackpot_reward(
  p_pool_id UUID,
  p_credit_mode TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_already_credited BOOLEAN := false;
  v_balance_after NUMERIC := 0;
  v_event_id UUID;
  v_next_status TEXT;
  v_now TIMESTAMPTZ := NOW();
  v_pool public.daily_jackpot_pools%ROWTYPE;
BEGIN
  IF p_credit_mode NOT IN ('claimed', 'auto_credited') THEN
    RAISE EXCEPTION 'Nieprawidłowy tryb kredytowania Jackpot';
  END IF;

  SELECT *
    INTO v_pool
    FROM public.daily_jackpot_pools
   WHERE id = p_pool_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pula Jackpot nie istnieje';
  END IF;

  IF v_pool.status <> 'drawn'
     OR v_pool.winner_user_id IS NULL
     OR v_pool.prize_amount <= 0 THEN
    RAISE EXCEPTION 'Ta pula Jackpot nie ma nagrody do odebrania';
  END IF;

  IF v_pool.reward_credit_status IN ('claimed', 'auto_credited') THEN
    v_already_credited := true;

    SELECT balance
      INTO v_balance_after
      FROM public.profiles
     WHERE id = v_pool.winner_user_id;

    RETURN jsonb_build_object(
      'pool_id', v_pool.id,
      'amount', v_pool.prize_amount,
      'balance_after', COALESCE(v_balance_after, 0),
      'reward_credit_status', v_pool.reward_credit_status,
      'reward_claimed_at', v_pool.reward_claimed_at,
      'reward_auto_credited_at', v_pool.reward_auto_credited_at,
      'already_credited', v_already_credited
    );
  END IF;

  v_next_status := CASE
    WHEN p_credit_mode = 'auto_credited' THEN 'auto_credited'
    ELSE 'claimed'
  END;

  INSERT INTO public.daily_jackpot_events (pool_id, event_type, payload)
  VALUES (
    v_pool.id,
    CASE
      WHEN p_credit_mode = 'auto_credited'
        THEN 'reward_auto_credited'
      ELSE 'reward_claimed'
    END,
    jsonb_build_object(
      'winner_user_id', v_pool.winner_user_id,
      'amount', v_pool.prize_amount,
      'credit_mode', p_credit_mode
    )
  )
  RETURNING id INTO v_event_id;

  UPDATE public.profiles
     SET balance = ROUND(balance + v_pool.prize_amount, 2)
   WHERE id = v_pool.winner_user_id
   RETURNING balance INTO v_balance_after;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono profilu zwycięzcy';
  END IF;

  UPDATE public.daily_jackpot_pools
     SET reward_credit_status = v_next_status,
         reward_claimed_at = CASE
           WHEN p_credit_mode = 'claimed'
             THEN COALESCE(reward_claimed_at, v_now)
           ELSE reward_claimed_at
         END,
         reward_auto_credited_at = CASE
           WHEN p_credit_mode = 'auto_credited'
             THEN COALESCE(reward_auto_credited_at, v_now)
           ELSE reward_auto_credited_at
         END,
         result_viewed_at = CASE
           WHEN p_credit_mode = 'claimed'
             THEN COALESCE(result_viewed_at, v_now)
           ELSE result_viewed_at
         END,
         reward_credit_event_id = v_event_id,
         updated_at = v_now
   WHERE id = v_pool.id
   RETURNING * INTO v_pool;

  RETURN jsonb_build_object(
    'pool_id', v_pool.id,
    'amount', v_pool.prize_amount,
    'balance_after', v_balance_after,
    'reward_credit_status', v_pool.reward_credit_status,
    'reward_claimed_at', v_pool.reward_claimed_at,
    'reward_auto_credited_at', v_pool.reward_auto_credited_at,
    'already_credited', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_daily_jackpot_reward(p_pool_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_pool public.daily_jackpot_pools%ROWTYPE;
  v_user_id UUID := auth.uid();
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

  IF v_pool.winner_user_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'To nie jest Twoja nagroda Jackpot';
  END IF;

  RETURN private.credit_daily_jackpot_reward(p_pool_id, 'claimed');
END;
$$;
