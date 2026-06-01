-- Move sportsbook settlement into one deterministic backend path.
-- Admin UI and approved agent automations should call these wrappers instead of
-- reimplementing balance/coupon settlement client-side.

CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.sportsbook_settlement_leg_result(
  p_mode TEXT,
  p_selected_option TEXT,
  p_winning_options TEXT[]
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_mode = 'force_lost' THEN 'lost'
    WHEN p_mode = 'refund' THEN 'refund'
    WHEN p_selected_option = ANY(COALESCE(p_winning_options, ARRAY[]::TEXT[])) THEN 'won'
    ELSE 'lost'
  END;
$$;

CREATE OR REPLACE FUNCTION private.sportsbook_settlement_leg_payout(
  p_mode TEXT,
  p_result TEXT,
  p_stake NUMERIC,
  p_odds_at_time NUMERIC
)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_mode = 'refund' THEN ROUND(COALESCE(p_stake, 0), 2)
    WHEN p_result = 'won' THEN ROUND(COALESCE(p_stake, 0) * COALESCE(p_odds_at_time, 0), 2)
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION private.sportsbook_settlement_leg_impact(
  p_result TEXT,
  p_payout NUMERIC
)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_result IN ('won', 'refund') THEN ROUND(COALESCE(p_payout, 0), 2)
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION private.sportsbook_settlement_coupon_impact(
  p_stake NUMERIC,
  p_total_odds NUMERIC,
  p_status TEXT,
  p_payout NUMERIC
)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_status = 'won'
      THEN ROUND(COALESCE(NULLIF(p_payout, 0), COALESCE(p_stake, 0) * COALESCE(p_total_odds, 0)), 2)
    WHEN p_status = 'refund'
      THEN ROUND(COALESCE(NULLIF(p_payout, 0), COALESCE(p_stake, 0)), 2)
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION private.sportsbook_settlement_credit_delta(
  p_previous_leg_result TEXT,
  p_previous_leg_payout NUMERIC,
  p_next_leg_result TEXT,
  p_next_leg_payout NUMERIC,
  p_coupon_before_stake NUMERIC,
  p_coupon_before_total_odds NUMERIC,
  p_coupon_before_status TEXT,
  p_coupon_before_payout NUMERIC,
  p_coupon_after_stake NUMERIC,
  p_coupon_after_total_odds NUMERIC,
  p_coupon_after_status TEXT,
  p_coupon_after_payout NUMERIC
)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ROUND(
    CASE
      WHEN p_coupon_before_status IS NULL
        AND p_coupon_after_status IS NULL
        THEN private.sportsbook_settlement_leg_impact(p_next_leg_result, p_next_leg_payout)
           - private.sportsbook_settlement_leg_impact(p_previous_leg_result, p_previous_leg_payout)
      WHEN COALESCE(p_coupon_before_total_odds, 1) <= 1
        AND COALESCE(p_coupon_after_total_odds, 1) <= 1
        THEN private.sportsbook_settlement_leg_impact(p_next_leg_result, p_next_leg_payout)
           - private.sportsbook_settlement_leg_impact(p_previous_leg_result, p_previous_leg_payout)
      ELSE private.sportsbook_settlement_coupon_impact(
             p_coupon_after_stake,
             p_coupon_after_total_odds,
             p_coupon_after_status,
             p_coupon_after_payout
           )
         - private.sportsbook_settlement_coupon_impact(
             p_coupon_before_stake,
             p_coupon_before_total_odds,
             p_coupon_before_status,
             p_coupon_before_payout
           )
    END,
    2
  );
$$;

CREATE OR REPLACE FUNCTION private.sportsbook_settlement_add_credit(
  p_credits JSONB,
  p_user_id UUID,
  p_amount NUMERIC
)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN ROUND(COALESCE(p_amount, 0), 2) = 0 THEN COALESCE(p_credits, '{}'::jsonb)
    ELSE jsonb_set(
      COALESCE(p_credits, '{}'::jsonb),
      ARRAY[p_user_id::TEXT],
      to_jsonb(
        ROUND(
          COALESCE((COALESCE(p_credits, '{}'::jsonb)->>(p_user_id::TEXT))::NUMERIC, 0)
          + COALESCE(p_amount, 0),
          2
        )
      ),
      true
    )
  END;
$$;

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
  v_delta NUMERIC;
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

    v_next_leg_result := private.sportsbook_settlement_leg_result(
      v_mode,
      v_placed.selected_option,
      v_winners
    );
    v_next_leg_payout := private.sportsbook_settlement_leg_payout(
      v_mode,
      v_next_leg_result,
      v_placed.stake,
      v_placed.odds_at_time
    );

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

    v_delta := private.sportsbook_settlement_credit_delta(
      v_previous_leg_result,
      v_previous_leg_payout,
      v_next_leg_result,
      v_next_leg_payout,
      v_coupon_before_stake,
      v_coupon_before_total_odds,
      v_coupon_before_status,
      v_coupon_before_payout,
      v_coupon_after_stake,
      v_coupon_after_total_odds,
      v_coupon_after_status,
      v_coupon_after_payout
    );

    v_credits := private.sportsbook_settlement_add_credit(
      v_credits,
      v_placed.user_id,
      v_delta
    );

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

REVOKE ALL ON FUNCTION private.settle_sportsbook_bet(UUID, TEXT[], TEXT, TEXT, UUID, TEXT) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.admin_settle_bet(
  p_bet_id UUID,
  p_winning_options TEXT[] DEFAULT ARRAY[]::TEXT[],
  p_mode TEXT DEFAULT 'normal',
  p_scope TEXT DEFAULT 'pending_only'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Brak uprawnień';
  END IF;

  RETURN private.settle_sportsbook_bet(
    p_bet_id,
    p_winning_options,
    p_mode,
    p_scope,
    auth.uid(),
    'admin'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_settle_bet(UUID, TEXT[], TEXT, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.agent_settle_bet(
  p_token TEXT,
  p_bet_id UUID,
  p_winning_options TEXT[] DEFAULT ARRAY[]::TEXT[],
  p_mode TEXT DEFAULT 'normal',
  p_scope TEXT DEFAULT 'pending_only'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_auth JSONB;
BEGIN
  v_auth := private.require_agent_scope(p_token, 'settle:bets');

  RETURN private.settle_sportsbook_bet(
    p_bet_id,
    p_winning_options,
    p_mode,
    p_scope,
    (v_auth->>'agent_user_id')::UUID,
    'agent'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.agent_settle_bet(TEXT, UUID, TEXT[], TEXT, TEXT)
TO anon, authenticated, service_role;
