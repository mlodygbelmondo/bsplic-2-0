-- Store sanitized OpenCodeGo/OpenRouter response diagnostics for Eniu runs.

ALTER TABLE private.social_bot_runs ADD COLUMN IF NOT EXISTS provider_diagnostic JSONB;

DROP FUNCTION IF EXISTS public.agent_add_social_comment(TEXT, TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS public.agent_record_social_bot_error(TEXT, TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS public.agent_create_social_post(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.agent_add_social_comment(
  p_token TEXT,
  p_source_type TEXT,
  p_source_id UUID,
  p_content TEXT,
  p_provider_diagnostic JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_agent_data JSONB;
  v_agent_user_id UUID;
  v_source_type TEXT;
  v_content TEXT;
  v_existing private.social_bot_runs%ROWTYPE;
  v_comment_id UUID;
  v_post_id UUID;
  v_coupon_id UUID;
  v_casino_share_id UUID;
  v_previous_auth_sub TEXT;
BEGIN
  v_agent_data := private.require_agent_scope(p_token, 'create:social');
  v_agent_user_id := (v_agent_data ->> 'agent_user_id')::UUID;
  v_source_type := LOWER(TRIM(COALESCE(p_source_type, '')));
  v_content := LEFT(TRIM(COALESCE(p_content, '')), 700);

  IF v_source_type NOT IN ('post', 'comment') THEN
    RAISE EXCEPTION 'Invalid social bot source type';
  END IF;

  IF char_length(v_content) = 0 THEN
    RAISE EXCEPTION 'Bot comment cannot be empty';
  END IF;

  SELECT * INTO v_existing
  FROM private.social_bot_runs
  WHERE source_type = v_source_type
    AND source_id = p_source_id;

  IF FOUND AND v_existing.status <> 'pending' THEN
    RETURN jsonb_build_object(
      'status', 'skipped',
      'responseCommentId', v_existing.response_comment_id,
      'reason', 'already processed'
    );
  ELSIF NOT FOUND THEN
    INSERT INTO private.social_bot_runs (source_type, source_id, status)
    VALUES (v_source_type, p_source_id, 'pending')
    RETURNING * INTO v_existing;
  END IF;

  IF v_source_type = 'post' THEN
    v_post_id := p_source_id;
  ELSE
    SELECT post_id, coupon_id, casino_share_id
      INTO v_post_id, v_coupon_id, v_casino_share_id
    FROM private.social_target_for_comment(p_source_id);

    IF v_post_id IS NULL AND v_coupon_id IS NULL AND v_casino_share_id IS NULL THEN
      RAISE EXCEPTION 'Source comment target not found';
    END IF;
  END IF;

  v_previous_auth_sub := current_setting('request.jwt.claim.sub', true);
  PERFORM set_config('request.jwt.claim.sub', v_agent_user_id::TEXT, true);

  SELECT public.add_social_comment(
    v_agent_user_id,
    v_content,
    v_post_id,
    v_coupon_id,
    v_casino_share_id,
    CASE WHEN v_source_type = 'comment' THEN p_source_id ELSE NULL END
  )
  INTO v_comment_id;

  PERFORM set_config('request.jwt.claim.sub', COALESCE(v_previous_auth_sub, ''), true);

  UPDATE private.social_bot_runs
  SET status = 'success',
      response_comment_id = v_comment_id,
      provider_diagnostic = p_provider_diagnostic,
      updated_at = now()
  WHERE id = v_existing.id;

  RETURN jsonb_build_object(
    'status', 'success',
    'responseCommentId', v_comment_id
  );
EXCEPTION
  WHEN OTHERS THEN
    IF v_existing.id IS NOT NULL THEN
      UPDATE private.social_bot_runs
      SET status = 'error',
          error = LEFT(SQLERRM, 500),
          provider_diagnostic = p_provider_diagnostic,
          updated_at = now()
      WHERE id = v_existing.id;
    END IF;
    RAISE;
END;
$$;

CREATE OR REPLACE FUNCTION public.agent_record_social_bot_error(
  p_token TEXT,
  p_source_type TEXT,
  p_source_id UUID,
  p_error TEXT,
  p_provider_diagnostic JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_source_type TEXT;
BEGIN
  PERFORM private.require_agent_scope(p_token, 'create:social');
  v_source_type := LOWER(TRIM(COALESCE(p_source_type, '')));

  IF v_source_type NOT IN ('post', 'comment') THEN
    RETURN;
  END IF;

  INSERT INTO private.social_bot_runs (
    source_type,
    source_id,
    status,
    error,
    provider_diagnostic
  )
  VALUES (
    v_source_type,
    p_source_id,
    'error',
    LEFT(COALESCE(p_error, 'Unknown error'), 500),
    p_provider_diagnostic
  )
  ON CONFLICT (source_type, source_id) WHERE source_type IN ('post', 'comment')
  DO UPDATE SET
    status = 'error',
    error = EXCLUDED.error,
    provider_diagnostic = EXCLUDED.provider_diagnostic,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.agent_create_social_post(
  p_token TEXT,
  p_content TEXT,
  p_provider_diagnostic JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_agent_data JSONB;
  v_agent_user_id UUID;
  v_content TEXT;
  v_post_id UUID;
  v_run_id UUID;
BEGIN
  v_agent_data := private.require_agent_scope(p_token, 'create:social');
  v_agent_user_id := (v_agent_data ->> 'agent_user_id')::UUID;
  v_content := LEFT(TRIM(COALESCE(p_content, '')), 700);

  IF char_length(v_content) = 0 THEN
    RAISE EXCEPTION 'Bot post cannot be empty';
  END IF;

  INSERT INTO public.social_posts (user_id, content)
  VALUES (v_agent_user_id, v_content)
  RETURNING id INTO v_post_id;

  INSERT INTO private.social_bot_runs (
    source_type,
    source_id,
    status,
    response_post_id,
    provider_diagnostic
  )
  VALUES ('admin_command', gen_random_uuid(), 'success', v_post_id, p_provider_diagnostic)
  RETURNING id INTO v_run_id;

  RETURN jsonb_build_object(
    'status', 'success',
    'postId', v_post_id,
    'runId', v_run_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_social_bot_runs(
  p_limit INTEGER DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_limit INTEGER;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Brak dostępu do logów Eniu';
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'sourceType', r.source_type,
          'sourceId', r.source_id,
          'status', r.status,
          'responseCommentId', r.response_comment_id,
          'responsePostId', r.response_post_id,
          'error', r.error,
          'providerDiagnostic', r.provider_diagnostic,
          'createdAt', r.created_at,
          'updatedAt', r.updated_at
        )
        ORDER BY r.created_at DESC
      )
      FROM (
        SELECT *
        FROM private.social_bot_runs
        ORDER BY created_at DESC
        LIMIT v_limit
      ) r
    ),
    '[]'::JSONB
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.agent_add_social_comment(TEXT, TEXT, UUID, TEXT, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agent_record_social_bot_error(TEXT, TEXT, UUID, TEXT, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agent_create_social_post(TEXT, TEXT, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_social_bot_runs(INTEGER) TO authenticated;
