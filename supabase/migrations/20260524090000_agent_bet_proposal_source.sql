-- Add source metadata for proposals and guard badge awarding for non-human proposals.

ALTER TABLE public.bet_proposals
  ADD COLUMN IF NOT EXISTS proposal_source TEXT NOT NULL DEFAULT 'human',
  ADD COLUMN IF NOT EXISTS agent_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS agent_duplicate_key TEXT;

ALTER TABLE public.bet_proposals
  DROP CONSTRAINT IF EXISTS bet_proposals_proposal_source_check;

ALTER TABLE public.bet_proposals
  ADD CONSTRAINT bet_proposals_proposal_source_check
  CHECK (proposal_source IN ('human', 'agent'));

CREATE INDEX IF NOT EXISTS idx_bet_proposals_source_status_created
  ON public.bet_proposals (proposal_source, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bet_proposals_agent_duplicate_key_pending
  ON public.bet_proposals (agent_duplicate_key)
  WHERE status = 'pending' AND agent_duplicate_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.check_badge_on_proposal_accept()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.proposal_source, 'human') <> 'human' THEN
    RETURN NEW;
  END IF;

  PERFORM public.award_badge(NEW.user_id, 'pomyslodawca');
  RETURN NEW;
END;
$$;

-- Token-backed agent API access for automated proposal workflows.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS private;

GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS private.agent_api_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  agent_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  scopes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

REVOKE ALL ON private.agent_api_tokens FROM PUBLIC;

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
  v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

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
    SET last_used_at = NOW()
   WHERE id = v_record.id;

  RETURN jsonb_build_object(
    'token_id', v_record.id,
    'agent_user_id', v_record.agent_user_id
  );
END;
$$;

REVOKE ALL ON FUNCTION private.require_agent_scope(TEXT, TEXT) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.agent_get_bet_context(
  p_token TEXT,
  p_recent_bet_limit INTEGER DEFAULT 10,
  p_history_limit INTEGER DEFAULT 200
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_recent_bet_limit INTEGER;
  v_history_limit INTEGER;
BEGIN
  PERFORM private.require_agent_scope(p_token, 'read:bets');

  v_recent_bet_limit := LEAST(GREATEST(COALESCE(p_recent_bet_limit, 10), 1), 50);
  v_history_limit := LEAST(GREATEST(COALESCE(p_history_limit, 200), 1), 500);

  RETURN jsonb_build_object(
    'schema', jsonb_build_object(
      'betTypes', jsonb_build_array('single', '12', '1x2', 'multi'),
      'proposalSources', jsonb_build_array('human', 'agent')
    ),
    'categories', COALESCE(
      (
        SELECT jsonb_agg(to_jsonb(c) ORDER BY c.sort_order)
        FROM public.categories c
      ),
      '[]'::jsonb
    ),
    'recentBets', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', b.id,
            'title', b.title,
            'category_id', b.category_id,
            'bet_type', b.bet_type,
            'options', b.options,
            'ends_at', b.ends_at,
            'is_active', b.is_active,
            'created_at', b.created_at
          )
          ORDER BY b.created_at DESC
        )
        FROM (
          SELECT id, title, category_id, bet_type, options, ends_at, is_active, created_at
          FROM public.bets
          ORDER BY created_at DESC
          LIMIT v_recent_bet_limit
        ) b
      ),
      '[]'::jsonb
    ),
    'historicalBets', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', b.id,
            'title', b.title,
            'category_id', b.category_id,
            'bet_type', b.bet_type,
            'options', b.options,
            'ends_at', b.ends_at,
            'is_active', b.is_active,
            'is_bsplicboost', b.is_bsplicboost,
            'created_at', b.created_at,
            'winning_option', b.winning_option,
            'bet_count', b.bet_count
          )
          ORDER BY b.created_at DESC
        )
        FROM (
          SELECT id, title, category_id, bet_type, options, ends_at, is_active, is_bsplicboost, created_at, winning_option, bet_count
          FROM public.bets
          WHERE is_active = false
          ORDER BY created_at DESC
          LIMIT v_history_limit
        ) b
      ),
      '[]'::jsonb
    ),
    'activeBets', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', b.id,
            'title', b.title,
            'category_id', b.category_id,
            'bet_type', b.bet_type,
            'options', b.options,
            'ends_at', b.ends_at,
            'is_active', b.is_active,
            'created_at', b.created_at
          )
          ORDER BY b.created_at DESC
        )
        FROM public.bets b
        WHERE b.is_active = true
      ),
      '[]'::jsonb
    ),
    'pendingProposals', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'title', p.title,
            'category_id', p.category_id,
            'bet_type', p.bet_type,
            'options', p.options,
            'ends_at', p.ends_at,
            'status', p.status,
            'proposal_source', COALESCE(p.proposal_source, 'human'),
            'agent_metadata', COALESCE(p.agent_metadata, '{}'::jsonb),
            'agent_duplicate_key', p.agent_duplicate_key,
            'created_at', p.created_at
          )
          ORDER BY p.created_at DESC
        )
        FROM public.bet_proposals p
        WHERE p.status = 'pending'
      ),
      '[]'::jsonb
    ),
    'recentAcceptedProposals', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'title', p.title,
            'category_id', p.category_id,
            'bet_type', p.bet_type,
            'options', p.options,
            'ends_at', p.ends_at,
            'status', p.status,
            'proposal_source', COALESCE(p.proposal_source, 'human'),
            'agent_metadata', COALESCE(p.agent_metadata, '{}'::jsonb),
            'agent_duplicate_key', p.agent_duplicate_key,
            'created_at', p.created_at
          )
          ORDER BY p.created_at DESC
        )
        FROM (
          SELECT id, title, category_id, bet_type, options, ends_at, status, proposal_source, agent_metadata, agent_duplicate_key, created_at
          FROM public.bet_proposals
          WHERE status = 'accepted'
          ORDER BY created_at DESC
          LIMIT v_history_limit
        ) p
      ),
      '[]'::jsonb
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.agent_get_bet_context(TEXT, INTEGER, INTEGER)
TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.agent_normalize_text(p_value TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT lower(regexp_replace(btrim(COALESCE(p_value, '')), '\\s+', ' ', 'g'));
$$;

CREATE OR REPLACE FUNCTION private.agent_option_signature(p_options JSONB)
RETURNS TEXT
LANGUAGE SQL
AS $$
  SELECT COALESCE(
    string_agg(
      private.agent_normalize_text(option_value ->> 'name'),
      '|' ORDER BY private.agent_normalize_text(option_value ->> 'name')
    ),
    ''
  )
  FROM jsonb_array_elements(COALESCE(p_options, '[]'::jsonb)) AS option_value
  WHERE option_value ->> 'name' IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION private.agent_normalize_text(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.agent_option_signature(JSONB) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.agent_create_bet_proposals(
  p_token TEXT,
  p_proposals JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_agent_data JSONB;
  v_agent_user_id UUID;
  v_item JSONB;
  v_idx INTEGER;
  v_title TEXT;
  v_title_norm TEXT;
  v_category_id_raw TEXT;
  v_category_id UUID;
  v_bet_type TEXT;
  v_ends_at_raw TEXT;
  v_ends_at TIMESTAMPTZ;
  v_agent_duplicate_key_raw TEXT;
  v_agent_duplicate_key TEXT;
  v_agent_metadata JSONB;
  v_options JSONB;
  v_option JSONB;
  v_option_name TEXT;
  v_option_odds NUMERIC;
  v_option_objects JSONB;
  v_min_options INTEGER;
  v_option_signature TEXT;
  v_created_item UUID;
  v_created_count INTEGER;
  v_processed_count INTEGER;
  v_created JSONB := '[]'::JSONB;
  v_skipped JSONB := '[]'::JSONB;
  v_errors JSONB := '[]'::JSONB;
  v_seen_keys TEXT[] := ARRAY[]::TEXT[];
  v_seen_keys_len INTEGER;
  v_category_id_valid BOOLEAN;
BEGIN
  v_agent_data := private.require_agent_scope(p_token, 'create:proposals');
  v_agent_user_id := (v_agent_data ->> 'agent_user_id')::UUID;

  IF jsonb_typeof(p_proposals) IS DISTINCT FROM 'array' THEN
    RETURN jsonb_build_object(
      'created', '[]'::JSONB,
      'skipped', '[]'::JSONB,
      'errors', jsonb_build_array(jsonb_build_object('reason', 'p_proposals must be a JSON array'))
    );
  END IF;

  v_created_count := 0;
  v_processed_count := 0;

  FOR v_idx IN 0..(jsonb_array_length(p_proposals) - 1)
  LOOP
    v_item := p_proposals -> v_idx;

    IF v_processed_count >= 25 THEN
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'index', v_idx + 1,
        'reason', 'batch limit exceeded (max 25 proposals per request)'
      ));
      CONTINUE;
    END IF;

    v_processed_count := v_processed_count + 1;

    v_created_item := NULL;
    v_title := NULL;
    v_title_norm := NULL;
    v_category_id_raw := NULL;
    v_category_id := NULL;
    v_bet_type := NULL;
    v_ends_at_raw := NULL;
    v_ends_at := NULL;
    v_agent_duplicate_key_raw := NULL;
    v_agent_duplicate_key := NULL;
    v_agent_metadata := NULL;
    v_options := NULL;
    v_option_objects := '[]'::JSONB;
    v_option_signature := NULL;
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

    v_agent_metadata := COALESCE(v_item -> 'agent_metadata', '{}'::JSONB);
    IF jsonb_typeof(v_agent_metadata) IS DISTINCT FROM 'object' THEN
      v_agent_metadata := '{}'::JSONB;
    END IF;

    v_agent_duplicate_key_raw := NULLIF(BTRIM(v_item ->> 'agent_duplicate_key'), '');
    IF v_agent_duplicate_key_raw IS NOT NULL THEN
      v_agent_duplicate_key := v_agent_duplicate_key_raw;
    END IF;

    IF v_agent_duplicate_key IS NOT NULL THEN
      IF v_agent_duplicate_key = ANY(v_seen_keys) THEN
        v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
          'title', v_title,
          'agent_duplicate_key', v_agent_duplicate_key,
          'reason', 'duplicate key in request'
        ));
        CONTINUE;
      END IF;

      IF EXISTS (
        SELECT 1
        FROM public.bet_proposals p
        WHERE p.agent_duplicate_key = v_agent_duplicate_key
          AND p.status = 'pending'
      ) THEN
        v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
          'title', v_title,
          'agent_duplicate_key', v_agent_duplicate_key,
          'reason', 'duplicate proposal key'
        ));
        CONTINUE;
      END IF;

      v_seen_keys := array_append(v_seen_keys, v_agent_duplicate_key);
    END IF;

    v_option_signature := private.agent_option_signature(v_option_objects);

    IF EXISTS (
      SELECT 1
      FROM public.bets b
      WHERE b.bet_type = v_bet_type
        AND (
          COALESCE(private.agent_normalize_text(b.title), '') = v_title_norm
          OR private.agent_option_signature(b.options) = v_option_signature
        )
        AND b.ends_at IS NOT NULL
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
        AND p.id IS NOT NULL
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
      INSERT INTO public.bet_proposals (
        user_id,
        title,
        category_id,
        bet_type,
        options,
        status,
        ends_at,
        proposal_source,
        agent_metadata,
        agent_duplicate_key
      )
      VALUES (
        v_agent_user_id,
        v_title,
        v_category_id,
        v_bet_type,
        v_option_objects::JSONB,
        'pending',
        v_ends_at,
        'agent',
        v_agent_metadata,
        v_agent_duplicate_key
      )
      RETURNING id INTO v_created_item;

      v_created := v_created || jsonb_build_array(jsonb_build_object(
        'id', v_created_item,
        'title', v_title,
        'agent_duplicate_key', v_agent_duplicate_key
      ));
      v_created_count := v_created_count + 1;
    EXCEPTION
      WHEN unique_violation THEN
        v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
          'title', v_title,
          'agent_duplicate_key', v_agent_duplicate_key,
          'reason', 'duplicate proposal key'
        ));
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

GRANT EXECUTE ON FUNCTION public.agent_create_bet_proposals(TEXT, JSONB)
TO anon, authenticated, service_role;

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
            COUNT(pb.id) AS placed_bet_count,
            COUNT(*) FILTER (WHERE pb.result = 'pending') AS pending_leg_count,
            MAX(pb.created_at) FILTER (WHERE pb.result = 'pending') AS newest_pending_placed_at,
            COUNT(*) FILTER (
              WHERE c.status = 'pending'
            ) AS pending_coupon_count
          FROM public.bets b
          JOIN public.placed_bets pb ON pb.bet_id = b.id
          LEFT JOIN public.coupons c ON c.id = pb.coupon_id
          GROUP BY b.id, b.title, b.category_id, b.options, b.ends_at, b.winning_option
          HAVING COUNT(*) FILTER (WHERE pb.result = 'pending') > 0
             OR COUNT(*) FILTER (WHERE c.status = 'pending') > 0
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
            'placed_bet_count', s.placed_bet_count,
            'pending_leg_count', s.pending_leg_count,
            'ended', s.ends_at <= NOW(),
            'newest_pending_placed_at', s.newest_pending_placed_at
          )
          ORDER BY s.newest_pending_placed_at DESC, s.ends_at DESC
        )
        FROM (
          SELECT *
          FROM settlement_scope s
          ORDER BY s.newest_pending_placed_at DESC, s.ends_at DESC
          LIMIT v_limit
        ) s
      ),
      '[]'::jsonb
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.agent_get_pending_settlement_context(TEXT, INTEGER)
TO anon, authenticated, service_role;
