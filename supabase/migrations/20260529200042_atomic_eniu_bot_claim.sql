-- Make Eniu reply claims conflict-aware so concurrent claims resolve cleanly.

CREATE OR REPLACE FUNCTION public.agent_claim_social_bot_reply(
  p_token TEXT,
  p_source_type TEXT,
  p_source_id UUID,
  p_actor_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_source_type TEXT;
  v_source_content TEXT;
  v_source_author_id UUID;
  v_run_id UUID;
  v_response_comment_id UUID;
BEGIN
  PERFORM private.require_agent_scope(p_token, 'create:social');

  v_source_type := LOWER(TRIM(COALESCE(p_source_type, '')));

  IF v_source_type = 'post' THEN
    SELECT content, user_id INTO v_source_content, v_source_author_id
    FROM public.social_posts
    WHERE id = p_source_id;
  ELSIF v_source_type = 'comment' THEN
    SELECT content, user_id INTO v_source_content, v_source_author_id
    FROM public.social_comments
    WHERE id = p_source_id;
  ELSE
    RAISE EXCEPTION 'Invalid social bot source type';
  END IF;

  IF v_source_content IS NULL THEN
    RAISE EXCEPTION 'Social bot source not found';
  END IF;

  IF v_source_author_id IS DISTINCT FROM p_actor_user_id THEN
    RAISE EXCEPTION 'Brak dostępu do wywołania Eniu';
  END IF;

  IF NOT private.social_content_mentions_eniu(v_source_content) THEN
    RETURN jsonb_build_object(
      'status', 'skipped',
      'claimed', false,
      'reason', 'source does not mention Eniu'
    );
  END IF;

  INSERT INTO private.social_bot_runs (source_type, source_id, status)
  VALUES (v_source_type, p_source_id, 'pending')
  ON CONFLICT (source_type, source_id) WHERE source_type IN ('post', 'comment')
  DO NOTHING
  RETURNING id INTO v_run_id;

  IF v_run_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'pending',
      'claimed', true,
      'runId', v_run_id
    );
  END IF;

  UPDATE private.social_bot_runs
  SET status = 'pending',
      error = NULL,
      response_comment_id = NULL,
      updated_at = now()
  WHERE source_type = v_source_type
    AND source_id = p_source_id
    AND status = 'error'
  RETURNING id INTO v_run_id;

  IF v_run_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'pending',
      'claimed', true,
      'runId', v_run_id
    );
  END IF;

  SELECT response_comment_id INTO v_response_comment_id
  FROM private.social_bot_runs
  WHERE source_type = v_source_type
    AND source_id = p_source_id;

  RETURN jsonb_build_object(
    'status', 'skipped',
    'claimed', false,
    'responseCommentId', v_response_comment_id,
    'reason', 'already processed'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.agent_claim_social_bot_reply(TEXT, TEXT, UUID, UUID) TO anon, authenticated, service_role;
