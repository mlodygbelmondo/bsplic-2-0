-- Autonomous settlement: evidence capture and explicit holds.
--
-- The agent now settles without waiting for approval, so every settlement must
-- leave behind what it was based on, and anything it could not resolve must be
-- recorded as a hold instead of being guessed.
--
-- PostgREST resolves overloads by argument names, so adding a defaulted sixth
-- argument alongside the existing five-argument function would make calls
-- ambiguous. The old signature is dropped and replaced.

DROP FUNCTION IF EXISTS public.agent_settle_bet(TEXT, UUID, TEXT[], TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.agent_settle_bet(
  p_token TEXT,
  p_bet_id UUID,
  p_winning_options TEXT[] DEFAULT ARRAY[]::TEXT[],
  p_mode TEXT DEFAULT 'normal',
  p_scope TEXT DEFAULT 'pending_only',
  p_evidence JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_auth JSONB;
  v_evidence JSONB;
  v_result JSONB;
BEGIN
  v_auth := private.require_agent_scope(p_token, 'settle:bets');

  v_evidence := COALESCE(p_evidence, '{}'::JSONB);
  IF jsonb_typeof(v_evidence) <> 'object' THEN
    v_evidence := '{}'::JSONB;
  END IF;

  v_evidence := v_evidence || jsonb_build_object(
    'mode', COALESCE(p_mode, 'normal'),
    'scope', COALESCE(p_scope, 'pending_only'),
    'winning_options', COALESCE(to_jsonb(p_winning_options), '[]'::JSONB),
    'settled_at', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'settled_by', 'agent'
  );

  -- Record the evidence and clear any prior hold. Settlement maths itself is
  -- untouched and still runs through the canonical private function that
  -- `admin_settle_bet` uses.
  UPDATE public.bets
     SET agent_metadata =
           (COALESCE(agent_metadata, '{}'::JSONB) - 'settlement_hold')
           || jsonb_build_object('settlement', v_evidence)
   WHERE id = p_bet_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono zakładu';
  END IF;

  v_result := private.settle_sportsbook_bet(
    p_bet_id,
    p_winning_options,
    p_mode,
    p_scope,
    (v_auth->>'agent_user_id')::UUID,
    'agent'
  );

  RETURN v_result;
END;
$$;

-- A market the agent could not resolve stays unsettled and carries the reason,
-- so the next run knows it already failed instead of re-deriving and guessing.
CREATE OR REPLACE FUNCTION public.agent_flag_settlement_hold(
  p_token TEXT,
  p_bet_id UUID,
  p_reason TEXT,
  p_run_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_reason TEXT;
  v_attempts INTEGER;
  v_hold JSONB;
BEGIN
  PERFORM private.require_agent_scope(p_token, 'settle:bets');

  v_reason := NULLIF(BTRIM(COALESCE(p_reason, '')), '');
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Powód wstrzymania rozliczenia jest wymagany';
  END IF;

  SELECT COALESCE((agent_metadata -> 'settlement_hold' ->> 'attempts')::INTEGER, 0)
    INTO v_attempts
    FROM public.bets
   WHERE id = p_bet_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono zakładu';
  END IF;

  v_hold := jsonb_build_object(
    'reason', v_reason,
    'attempts', v_attempts + 1,
    'flagged_at', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'run_id', p_run_id
  );

  UPDATE public.bets
     SET agent_metadata = COALESCE(agent_metadata, '{}'::JSONB)
           || jsonb_build_object('settlement_hold', v_hold)
   WHERE id = p_bet_id;

  RETURN jsonb_build_object('bet_id', p_bet_id, 'settlement_hold', v_hold);
END;
$$;

-- Surface holds, event grouping and odds provenance in the settlement context.
CREATE OR REPLACE FUNCTION public.agent_get_pending_settlement_context(
  p_token TEXT,
  p_limit INTEGER DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_limit INTEGER;
BEGIN
  PERFORM private.require_agent_scope(p_token, 'read:settlement');

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);

  RETURN jsonb_build_object(
    'bets', COALESCE(
      (
        WITH settlement_scope AS (
          SELECT
            b.id,
            b.title,
            b.category_id,
            b.options,
            b.ends_at,
            b.winning_option,
            b.event_key,
            b.agent_metadata,
            COUNT(pb.id) AS placed_bet_count,
            COUNT(pb.id) FILTER (WHERE pb.result = 'pending') AS pending_leg_count,
            MAX(pb.created_at) FILTER (WHERE pb.result = 'pending') AS newest_pending_placed_at,
            COUNT(c.id) FILTER (
              WHERE c.status = 'pending'
            ) AS pending_coupon_count
          FROM public.bets b
          LEFT JOIN public.placed_bets pb ON pb.bet_id = b.id
          LEFT JOIN public.coupons c ON c.id = pb.coupon_id
          GROUP BY b.id, b.title, b.category_id, b.options, b.ends_at, b.winning_option,
                   b.event_key, b.agent_metadata
          HAVING COUNT(pb.id) FILTER (WHERE pb.result = 'pending') > 0
             OR COUNT(c.id) FILTER (WHERE c.status = 'pending') > 0
             OR (
               b.winning_option IS NULL
               AND b.ends_at <= NOW()
             )
        )
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'title', s.title,
            'category', (
              SELECT jsonb_build_object(
                'id', c.id,
                'name', c.name,
                'emoji', c.emoji,
                'color', c.color,
                'sort_order', c.sort_order
              )
              FROM public.categories c
              WHERE c.id = s.category_id
            ),
            'options', s.options,
            'ends_at', s.ends_at,
            'winning_option', s.winning_option,
            'event_key', s.event_key,
            'odds_source', COALESCE(s.agent_metadata -> 'odds_source', 'null'::JSONB),
            'settlement_hold', COALESCE(s.agent_metadata -> 'settlement_hold', 'null'::JSONB),
            'placed_bet_count', s.placed_bet_count,
            'pending_leg_count', s.pending_leg_count,
            'pending_coupon_count', s.pending_coupon_count,
            'ended', s.ends_at <= NOW(),
            'newest_pending_placed_at', s.newest_pending_placed_at
          )
          ORDER BY
            (s.ends_at <= NOW()) DESC,
            s.newest_pending_placed_at DESC NULLS LAST,
            s.ends_at DESC
        )
        FROM (
          SELECT *
          FROM settlement_scope s
          ORDER BY
            (s.ends_at <= NOW()) DESC,
            s.newest_pending_placed_at DESC NULLS LAST,
            s.ends_at DESC
          LIMIT v_limit
        ) s
      ),
      '[]'::JSONB
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.agent_settle_bet(TEXT, UUID, TEXT[], TEXT, TEXT, JSONB)
TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agent_flag_settlement_hold(TEXT, UUID, TEXT, UUID)
TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agent_get_pending_settlement_context(TEXT, INTEGER)
TO anon, authenticated, service_role;
