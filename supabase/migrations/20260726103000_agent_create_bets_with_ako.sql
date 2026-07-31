-- Rewrite direct agent bet creation:
--   * persist agent_duplicate_key / agent_metadata / event_key (provenance)
--   * use the corrected duplicate rule from private.agent_find_duplicate
--   * create AKO exclusions in the same call, resolving targets created in the
--     same request by caller-supplied `ako_ref`
--
-- Per-bet input gains: event_key, ako_ref, ako_exclusions[].
-- The function signature is unchanged, so PostgREST routing and existing
-- callers are unaffected.

CREATE OR REPLACE FUNCTION private.agent_resolve_ako_target(
  p_target JSONB,
  p_ref_map JSONB
)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_ref TEXT;
  v_bet_id_raw TEXT;
  v_bet_id UUID;
  v_key TEXT;
BEGIN
  IF p_target IS NULL OR jsonb_typeof(p_target) <> 'object' THEN
    RETURN NULL;
  END IF;

  v_ref := NULLIF(BTRIM(p_target ->> 'ref'), '');
  IF v_ref IS NOT NULL AND p_ref_map ? v_ref THEN
    RETURN (p_ref_map ->> v_ref)::UUID;
  END IF;

  v_bet_id_raw := NULLIF(BTRIM(p_target ->> 'betId'), '');
  IF v_bet_id_raw IS NOT NULL THEN
    BEGIN
      v_bet_id := v_bet_id_raw::UUID;
    EXCEPTION WHEN OTHERS THEN
      v_bet_id := NULL;
    END;

    IF v_bet_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.bets WHERE id = v_bet_id) THEN
      RETURN v_bet_id;
    END IF;
  END IF;

  v_key := NULLIF(BTRIM(p_target ->> 'agent_duplicate_key'), '');
  IF v_key IS NOT NULL THEN
    SELECT id INTO v_bet_id
      FROM public.bets
     WHERE agent_duplicate_key = v_key
     LIMIT 1;

    IF v_bet_id IS NOT NULL THEN
      RETURN v_bet_id;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION private.agent_resolve_ako_target(JSONB, JSONB) FROM PUBLIC;

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
  v_auth JSONB;
  v_actor UUID;
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
  v_agent_metadata JSONB;
  v_event_key TEXT;
  v_ako_ref TEXT;
  v_ako_exclusions JSONB;
  v_duplicate_reason TEXT;
  v_existing_bet_id UUID;
  v_is_live BOOLEAN;
  v_is_bsplicboost BOOLEAN;
  v_bet_id UUID;
  v_processed_count INTEGER := 0;
  v_created JSONB := '[]'::JSONB;
  v_skipped JSONB := '[]'::JSONB;
  v_errors JSONB := '[]'::JSONB;
  v_ako_created JSONB := '[]'::JSONB;
  v_ako_unresolved JSONB := '[]'::JSONB;
  v_ref_map JSONB := '{}'::JSONB;
  v_ako_plan JSONB := '[]'::JSONB;
  v_plan JSONB;
  v_target JSONB;
  v_target_bet_id UUID;
  v_seen_request_keys TEXT[] := ARRAY[]::TEXT[];
  v_category_id_valid BOOLEAN;
BEGIN
  v_auth := private.require_agent_scope(p_token, 'create:bets');
  v_actor := (v_auth ->> 'agent_user_id')::UUID;

  IF jsonb_typeof(p_bets) IS DISTINCT FROM 'array' THEN
    RETURN jsonb_build_object(
      'created', '[]'::JSONB,
      'skipped', '[]'::JSONB,
      'errors', jsonb_build_array(jsonb_build_object('reason', 'p_bets must be a JSON array')),
      'ako_created', '[]'::JSONB,
      'ako_unresolved', '[]'::JSONB
    );
  END IF;

  ---------------------------------------------------------------------------
  -- Pass 1: validate and insert bets, building the ako_ref -> bet id map.
  ---------------------------------------------------------------------------
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
    v_agent_metadata := NULL;
    v_event_key := NULL;
    v_ako_ref := NULL;
    v_ako_exclusions := NULL;
    v_duplicate_reason := NULL;
    v_existing_bet_id := NULL;
    v_bet_id := NULL;
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
    IF v_bet_type IS NULL OR v_bet_type NOT IN ('single', '12', '1x2', 'multi') THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'title', v_title,
        'reason', 'invalid bet_type'
      ));
      CONTINUE;
    END IF;

    v_options := v_item -> 'options';
    IF jsonb_typeof(v_options) IS DISTINCT FROM 'array' OR jsonb_array_length(COALESCE(v_options, '[]'::JSONB)) = 0 THEN
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

      IF v_option_odds IS NULL OR v_option_odds <= 0 THEN
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
    v_event_key := NULLIF(BTRIM(v_item ->> 'event_key'), '');
    v_ako_ref := NULLIF(BTRIM(v_item ->> 'ako_ref'), '');

    v_agent_metadata := COALESCE(v_item -> 'agent_metadata', '{}'::JSONB);
    IF jsonb_typeof(v_agent_metadata) IS DISTINCT FROM 'object' THEN
      v_agent_metadata := '{}'::JSONB;
    END IF;
    IF v_event_key IS NOT NULL THEN
      v_agent_metadata := v_agent_metadata || jsonb_build_object('event_key', v_event_key);
    END IF;

    v_ako_exclusions := v_item -> 'ako_exclusions';
    IF jsonb_typeof(v_ako_exclusions) IS DISTINCT FROM 'array' THEN
      v_ako_exclusions := '[]'::JSONB;
    END IF;

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

    v_duplicate_reason := private.agent_find_duplicate(
      v_bet_type,
      v_title_norm,
      v_option_signature,
      v_ends_at,
      v_agent_duplicate_key,
      NULL
    );

    IF v_duplicate_reason IS NOT NULL THEN
      -- A market skipped because it already exists is still a valid AKO
      -- exclusion target, and its own exclusions still need wiring. This keeps
      -- a re-run after a partial failure self-healing instead of leaving
      -- correlated markets unlinked.
      IF v_agent_duplicate_key IS NOT NULL THEN
        SELECT id INTO v_existing_bet_id
          FROM public.bets
         WHERE agent_duplicate_key = v_agent_duplicate_key
         LIMIT 1;
      END IF;

      IF v_existing_bet_id IS NOT NULL THEN
        IF v_ako_ref IS NOT NULL THEN
          v_ref_map := v_ref_map || jsonb_build_object(v_ako_ref, v_existing_bet_id);
        END IF;

        IF jsonb_array_length(v_ako_exclusions) > 0 THEN
          v_ako_plan := v_ako_plan || jsonb_build_array(jsonb_build_object(
            'bet_id', v_existing_bet_id,
            'title', v_title,
            'ako_ref', v_ako_ref,
            'exclusions', v_ako_exclusions
          ));
        END IF;
      END IF;

      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'title', v_title,
        'agent_duplicate_key', v_agent_duplicate_key,
        'existing_bet_id', v_existing_bet_id,
        'reason', v_duplicate_reason
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
        is_bsplicboost,
        agent_duplicate_key,
        agent_metadata,
        event_key
      )
      VALUES (
        v_title,
        v_category_id,
        v_bet_type,
        v_option_objects::JSONB,
        v_ends_at,
        v_is_live,
        v_is_bsplicboost,
        v_agent_duplicate_key,
        v_agent_metadata,
        v_event_key
      )
      RETURNING id INTO v_bet_id;

      IF v_ako_ref IS NOT NULL THEN
        v_ref_map := v_ref_map || jsonb_build_object(v_ako_ref, v_bet_id);
      END IF;

      IF jsonb_array_length(v_ako_exclusions) > 0 THEN
        v_ako_plan := v_ako_plan || jsonb_build_array(jsonb_build_object(
          'bet_id', v_bet_id,
          'title', v_title,
          'ako_ref', v_ako_ref,
          'exclusions', v_ako_exclusions
        ));
      END IF;

      v_created := v_created || jsonb_build_array(jsonb_build_object(
        'id', v_bet_id,
        'title', v_title,
        'agent_duplicate_key', v_agent_duplicate_key,
        'event_key', v_event_key,
        'ako_ref', v_ako_ref
      ));
    EXCEPTION
      WHEN unique_violation THEN
        v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
          'title', v_title,
          'agent_duplicate_key', v_agent_duplicate_key,
          'reason', 'duplicate agent_duplicate_key on existing bet'
        ));
      WHEN OTHERS THEN
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'title', v_title,
          'agent_duplicate_key', v_agent_duplicate_key,
          'reason', format('insert failed: %s', SQLERRM)
        ));
    END;
  END LOOP;

  ---------------------------------------------------------------------------
  -- Pass 2: wire AKO exclusions now that every bet in the request has an id.
  ---------------------------------------------------------------------------
  FOR v_plan IN SELECT * FROM jsonb_array_elements(v_ako_plan)
  LOOP
    FOR v_target IN SELECT * FROM jsonb_array_elements(v_plan -> 'exclusions')
    LOOP
      v_target_bet_id := private.agent_resolve_ako_target(v_target, v_ref_map);

      IF v_target_bet_id IS NULL THEN
        v_ako_unresolved := v_ako_unresolved || jsonb_build_array(jsonb_build_object(
          'bet_id', v_plan ->> 'bet_id',
          'title', v_plan ->> 'title',
          'target', v_target,
          'reason', 'exclusion target could not be resolved'
        ));
        CONTINUE;
      END IF;

      IF v_target_bet_id = (v_plan ->> 'bet_id')::UUID THEN
        v_ako_unresolved := v_ako_unresolved || jsonb_build_array(jsonb_build_object(
          'bet_id', v_plan ->> 'bet_id',
          'title', v_plan ->> 'title',
          'target', v_target,
          'reason', 'exclusion target is the bet itself'
        ));
        CONTINUE;
      END IF;

      BEGIN
        PERFORM private.add_bet_ako_exclusion(
          (v_plan ->> 'bet_id')::UUID,
          v_target_bet_id,
          v_target ->> 'reason',
          v_actor
        );

        v_ako_created := v_ako_created || jsonb_build_array(jsonb_build_object(
          'bet_id_a', v_plan ->> 'bet_id',
          'bet_id_b', v_target_bet_id,
          'reason', v_target ->> 'reason'
        ));
      EXCEPTION WHEN OTHERS THEN
        v_ako_unresolved := v_ako_unresolved || jsonb_build_array(jsonb_build_object(
          'bet_id', v_plan ->> 'bet_id',
          'title', v_plan ->> 'title',
          'target', v_target,
          'reason', format('exclusion insert failed: %s', SQLERRM)
        ));
      END;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'created', v_created,
    'skipped', v_skipped,
    'errors', v_errors,
    'ako_created', v_ako_created,
    'ako_unresolved', v_ako_unresolved
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.agent_create_bets(TEXT, JSONB)
TO anon, authenticated, service_role;
