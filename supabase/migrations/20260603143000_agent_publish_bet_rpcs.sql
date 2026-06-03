-- Add reviewed agent publishing and direct agent bet creation RPCs.

CREATE OR REPLACE FUNCTION public.agent_accept_bet_proposals(
  p_token TEXT,
  p_proposal_ids UUID[],
  p_is_live BOOLEAN DEFAULT false,
  p_is_bsplicboost BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_proposal_id UUID;
  v_proposal public.bet_proposals%ROWTYPE;
  v_bet_id UUID;
  v_idx INTEGER := 0;
  v_processed_count INTEGER := 0;
  v_accepted JSONB := '[]'::JSONB;
  v_skipped JSONB := '[]'::JSONB;
  v_errors JSONB := '[]'::JSONB;
  v_title_norm TEXT;
  v_option_signature TEXT;
BEGIN
  PERFORM private.require_agent_scope(p_token, 'accept:proposals');

  IF p_proposal_ids IS NULL OR array_length(p_proposal_ids, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'accepted', '[]'::JSONB,
      'skipped', '[]'::JSONB,
      'errors', jsonb_build_array(jsonb_build_object('reason', 'p_proposal_ids must contain at least one proposal id'))
    );
  END IF;

  FOREACH v_proposal_id IN ARRAY p_proposal_ids
  LOOP
    v_idx := v_idx + 1;

    IF v_processed_count >= 25 THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'proposal_id', v_proposal_id,
        'reason', 'batch limit exceeded (max 25 proposals per request)'
      ));
      CONTINUE;
    END IF;

    v_processed_count := v_processed_count + 1;

    SELECT *
      INTO v_proposal
      FROM public.bet_proposals
     WHERE id = v_proposal_id
     FOR UPDATE;

    IF NOT FOUND THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'proposal_id', v_proposal_id,
        'reason', 'proposal not found'
      ));
      CONTINUE;
    END IF;

    IF v_proposal.status <> 'pending' THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'proposal_id', v_proposal.id,
        'title', v_proposal.title,
        'reason', format('proposal status is %s', v_proposal.status)
      ));
      CONTINUE;
    END IF;

    IF COALESCE(v_proposal.proposal_source, 'human') <> 'agent' THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'proposal_id', v_proposal.id,
        'title', v_proposal.title,
        'reason', 'only agent proposals can be accepted by this RPC'
      ));
      CONTINUE;
    END IF;

    IF v_proposal.ends_at IS NULL THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'proposal_id', v_proposal.id,
        'title', v_proposal.title,
        'reason', 'proposal is missing ends_at'
      ));
      CONTINUE;
    END IF;

    v_title_norm := private.agent_normalize_text(v_proposal.title);
    v_option_signature := private.agent_option_signature(v_proposal.options);

    IF EXISTS (
      SELECT 1
      FROM public.bets b
      WHERE b.bet_type = v_proposal.bet_type
        AND (
          COALESCE(private.agent_normalize_text(b.title), '') = v_title_norm
          OR private.agent_option_signature(b.options) = v_option_signature
        )
        AND b.ends_at BETWEEN (v_proposal.ends_at - INTERVAL '24 hours') AND (v_proposal.ends_at + INTERVAL '24 hours')
    ) THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'proposal_id', v_proposal.id,
        'title', v_proposal.title,
        'agent_duplicate_key', v_proposal.agent_duplicate_key,
        'reason', 'approximate duplicate against existing bet'
      ));
      CONTINUE;
    END IF;

    BEGIN
      INSERT INTO public.bets (
        title,
        category_id,
        bet_type,
        options,
        ends_at,
        is_live,
        is_bsplicboost
      )
      VALUES (
        v_proposal.title,
        v_proposal.category_id,
        v_proposal.bet_type,
        v_proposal.options,
        v_proposal.ends_at,
        COALESCE(p_is_live, false),
        COALESCE(p_is_bsplicboost, false)
      )
      RETURNING id INTO v_bet_id;

      UPDATE public.bet_proposals
         SET status = 'accepted'
       WHERE id = v_proposal.id;

      v_accepted := v_accepted || jsonb_build_array(jsonb_build_object(
        'proposal_id', v_proposal.id,
        'bet_id', v_bet_id,
        'title', v_proposal.title,
        'agent_duplicate_key', v_proposal.agent_duplicate_key
      ));
    EXCEPTION
      WHEN OTHERS THEN
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'proposal_id', v_proposal.id,
          'title', v_proposal.title,
          'agent_duplicate_key', v_proposal.agent_duplicate_key,
          'reason', format('accept failed: %s', SQLERRM)
        ));
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'accepted', v_accepted,
    'skipped', v_skipped,
    'errors', v_errors
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.agent_accept_bet_proposals(TEXT, UUID[], BOOLEAN, BOOLEAN)
TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.agent_create_bets(
  p_token TEXT,
  p_bets JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_item JSONB;
  v_idx INTEGER;
  v_title TEXT;
  v_title_norm TEXT;
  v_category_id_raw TEXT;
  v_category_id UUID;
  v_bet_type TEXT;
  v_ends_at_raw TEXT;
  v_ends_at TIMESTAMPTZ;
  v_options JSONB;
  v_option JSONB;
  v_option_name TEXT;
  v_option_odds NUMERIC;
  v_option_objects JSONB;
  v_min_options INTEGER;
  v_option_signature TEXT;
  v_request_key TEXT;
  v_agent_duplicate_key TEXT;
  v_is_live BOOLEAN;
  v_is_bsplicboost BOOLEAN;
  v_bet_id UUID;
  v_processed_count INTEGER := 0;
  v_created JSONB := '[]'::JSONB;
  v_skipped JSONB := '[]'::JSONB;
  v_errors JSONB := '[]'::JSONB;
  v_seen_request_keys TEXT[] := ARRAY[]::TEXT[];
  v_category_id_valid BOOLEAN;
BEGIN
  PERFORM private.require_agent_scope(p_token, 'create:bets');

  IF jsonb_typeof(p_bets) IS DISTINCT FROM 'array' THEN
    RETURN jsonb_build_object(
      'created', '[]'::JSONB,
      'skipped', '[]'::JSONB,
      'errors', jsonb_build_array(jsonb_build_object('reason', 'p_bets must be a JSON array'))
    );
  END IF;

  FOR v_idx IN 0..(jsonb_array_length(p_bets) - 1)
  LOOP
    v_item := p_bets -> v_idx;

    IF v_processed_count >= 25 THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'index', v_idx + 1,
        'reason', 'batch limit exceeded (max 25 bets per request)'
      ));
      CONTINUE;
    END IF;

    v_processed_count := v_processed_count + 1;

    v_title := NULL;
    v_title_norm := NULL;
    v_category_id_raw := NULL;
    v_category_id := NULL;
    v_bet_type := NULL;
    v_ends_at_raw := NULL;
    v_ends_at := NULL;
    v_options := NULL;
    v_option_objects := '[]'::JSONB;
    v_option_signature := NULL;
    v_request_key := NULL;
    v_agent_duplicate_key := NULL;
    v_is_live := false;
    v_is_bsplicboost := false;
    v_category_id_valid := true;

    v_title := NULLIF(BTRIM(v_item ->> 'title'), '');
    IF v_title IS NULL THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'index', v_idx + 1,
        'reason', 'missing or blank title'
      ));
      CONTINUE;
    END IF;
    v_title_norm := private.agent_normalize_text(v_title);

    v_bet_type := v_item ->> 'bet_type';
    IF v_bet_type NOT IN ('single', '12', '1x2', 'multi') THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'title', v_title,
        'reason', 'invalid bet_type'
      ));
      CONTINUE;
    END IF;

    v_options := v_item -> 'options';
    IF jsonb_typeof(v_options) IS DISTINCT FROM 'array' OR jsonb_array_length(COALESCE(v_options, '[]'::jsonb)) = 0 THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'title', v_title,
        'reason', 'options must be a non-empty array'
      ));
      CONTINUE;
    END IF;

    IF v_bet_type = 'single' THEN
      v_min_options := 1;
    ELSE
      v_min_options := 2;
    END IF;

    IF jsonb_array_length(v_options) < v_min_options THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'title', v_title,
        'reason', format('insufficient options (minimum %s)', v_min_options)
      ));
      CONTINUE;
    END IF;

    BEGIN
      v_ends_at_raw := v_item ->> 'ends_at';
      IF NULLIF(BTRIM(COALESCE(v_ends_at_raw, '')), '') IS NULL THEN
        RAISE EXCEPTION 'missing ends_at';
      END IF;

      v_ends_at := v_ends_at_raw::TIMESTAMPTZ;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'title', v_title,
        'reason', 'invalid ends_at'
      ));
      CONTINUE;
    END;

    v_category_id_raw := NULLIF(BTRIM(v_item ->> 'category_id'), '');
    IF v_category_id_raw IS NOT NULL THEN
      BEGIN
        v_category_id := v_category_id_raw::UUID;
      EXCEPTION WHEN OTHERS THEN
        v_category_id_valid := false;
      END;

      IF NOT v_category_id_valid THEN
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'title', v_title,
          'reason', 'invalid category_id'
        ));
        CONTINUE;
      END IF;
    END IF;

    BEGIN
      v_is_live := COALESCE((v_item ->> 'is_live')::BOOLEAN, false);
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'title', v_title,
        'reason', 'invalid is_live'
      ));
      CONTINUE;
    END;

    BEGIN
      v_is_bsplicboost := COALESCE((v_item ->> 'is_bsplicboost')::BOOLEAN, false);
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'title', v_title,
        'reason', 'invalid is_bsplicboost'
      ));
      CONTINUE;
    END;

    FOR v_option IN SELECT * FROM jsonb_array_elements(v_options)
    LOOP
      v_option_name := NULLIF(BTRIM(v_option ->> 'name'), '');
      IF v_option_name IS NULL THEN
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'title', v_title,
          'reason', 'option is missing name'
        ));
        v_option_objects := NULL;
        EXIT;
      END IF;

      BEGIN
        v_option_odds := (v_option ->> 'odds')::NUMERIC;
      EXCEPTION WHEN OTHERS THEN
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'title', v_title,
          'reason', 'option has invalid odds'
        ));
        v_option_objects := NULL;
        EXIT;
      END;

      IF v_option_odds <= 0 THEN
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'title', v_title,
          'reason', 'option has non-positive odds'
        ));
        v_option_objects := NULL;
        EXIT;
      END IF;

      v_option_objects := v_option_objects || jsonb_build_array(
        jsonb_build_object('name', v_option_name, 'odds', v_option_odds)
      );
    END LOOP;

    IF v_option_objects IS NULL THEN
      CONTINUE;
    END IF;

    v_agent_duplicate_key := NULLIF(BTRIM(v_item ->> 'agent_duplicate_key'), '');
    v_option_signature := private.agent_option_signature(v_option_objects);
    v_request_key := concat_ws(
      ':',
      v_bet_type,
      v_title_norm,
      to_char(v_ends_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI'),
      v_option_signature
    );

    IF v_request_key = ANY(v_seen_request_keys) THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'title', v_title,
        'agent_duplicate_key', v_agent_duplicate_key,
        'reason', 'duplicate bet in request'
      ));
      CONTINUE;
    END IF;
    v_seen_request_keys := array_append(v_seen_request_keys, v_request_key);

    IF EXISTS (
      SELECT 1
      FROM public.bets b
      WHERE b.bet_type = v_bet_type
        AND (
          COALESCE(private.agent_normalize_text(b.title), '') = v_title_norm
          OR private.agent_option_signature(b.options) = v_option_signature
        )
        AND b.ends_at BETWEEN (v_ends_at - INTERVAL '24 hours') AND (v_ends_at + INTERVAL '24 hours')
    ) THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'title', v_title,
        'agent_duplicate_key', v_agent_duplicate_key,
        'reason', 'approximate duplicate against existing bet'
      ));
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.bet_proposals p
      WHERE p.status = 'pending'
        AND p.bet_type = v_bet_type
        AND (
          COALESCE(private.agent_normalize_text(p.title), '') = v_title_norm
          OR private.agent_option_signature(p.options) = v_option_signature
        )
        AND p.ends_at IS NOT NULL
        AND p.ends_at BETWEEN (v_ends_at - INTERVAL '24 hours') AND (v_ends_at + INTERVAL '24 hours')
    ) THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'title', v_title,
        'agent_duplicate_key', v_agent_duplicate_key,
        'reason', 'approximate duplicate against pending proposals'
      ));
      CONTINUE;
    END IF;

    BEGIN
      INSERT INTO public.bets (
        title,
        category_id,
        bet_type,
        options,
        ends_at,
        is_live,
        is_bsplicboost
      )
      VALUES (
        v_title,
        v_category_id,
        v_bet_type,
        v_option_objects::JSONB,
        v_ends_at,
        v_is_live,
        v_is_bsplicboost
      )
      RETURNING id INTO v_bet_id;

      v_created := v_created || jsonb_build_array(jsonb_build_object(
        'id', v_bet_id,
        'title', v_title,
        'agent_duplicate_key', v_agent_duplicate_key
      ));
    EXCEPTION
      WHEN OTHERS THEN
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'title', v_title,
          'agent_duplicate_key', v_agent_duplicate_key,
          'reason', format('insert failed: %s', SQLERRM)
        ));
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'created', v_created,
    'skipped', v_skipped,
    'errors', v_errors
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.agent_create_bets(TEXT, JSONB)
TO anon, authenticated, service_role;
