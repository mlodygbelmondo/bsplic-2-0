-- On-demand social bot support for Eniu Bukmacher.

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
    SET last_used_at = now()
   WHERE id = v_record.id;

  RETURN jsonb_build_object(
    'token_id', v_record.id,
    'agent_user_id', v_record.agent_user_id
  );
END;
$$;

REVOKE ALL ON FUNCTION private.require_agent_scope(TEXT, TEXT) FROM PUBLIC;

CREATE TABLE IF NOT EXISTS private.social_bot_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL CHECK (source_type IN ('post', 'comment', 'admin_command')),
  source_id UUID NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'skipped', 'error')),
  response_comment_id UUID REFERENCES public.social_comments(id) ON DELETE SET NULL,
  response_post_id UUID REFERENCES public.social_posts(id) ON DELETE SET NULL,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

REVOKE ALL ON private.social_bot_runs FROM PUBLIC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_social_bot_runs_source_unique
  ON private.social_bot_runs (source_type, source_id)
  WHERE source_type IN ('post', 'comment');

CREATE INDEX IF NOT EXISTS idx_social_bot_runs_created
  ON private.social_bot_runs (created_at DESC);

CREATE OR REPLACE FUNCTION private.social_target_for_comment(
  p_comment_id UUID
)
RETURNS TABLE (
  post_id UUID,
  coupon_id UUID,
  casino_share_id UUID
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT sc.post_id, sc.coupon_id, sc.casino_share_id
  FROM public.social_comments sc
  WHERE sc.id = p_comment_id
$$;

REVOKE ALL ON FUNCTION private.social_target_for_comment(UUID) FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.social_content_mentions_eniu(
  p_content TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(p_content, '') ~* '(^|[^[:alnum:]_-])@eniu($|[^[:alnum:]_-])'
$$;

REVOKE ALL ON FUNCTION private.social_content_mentions_eniu(TEXT) FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.social_user_public_stats(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT jsonb_build_object(
    'username', p.username,
    'currentStreak', p.current_streak,
    'longestStreak', p.longest_streak,
    'socialPosts', (
      SELECT COUNT(*) FROM public.social_posts sp WHERE sp.user_id = p.id
    ),
    'socialComments', (
      SELECT COUNT(*) FROM public.social_comments sc WHERE sc.user_id = p.id
    ),
    'sharedCoupons', (
      SELECT COUNT(*) FROM public.coupons c WHERE c.user_id = p.id
    ),
    'casinoShares', (
      SELECT COUNT(*) FROM public.casino_social_shares cs WHERE cs.user_id = p.id
    )
  )
  FROM public.profiles p
  WHERE p.id = p_user_id
$$;

REVOKE ALL ON FUNCTION private.social_user_public_stats(UUID) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.agent_get_social_context(
  p_token TEXT,
  p_source_type TEXT,
  p_source_id UUID,
  p_comment_limit INTEGER DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_source_type TEXT;
  v_comment_limit INTEGER;
  v_source JSONB;
  v_target JSONB;
  v_comments JSONB;
  v_author_id UUID;
  v_target_post_id UUID;
  v_target_coupon_id UUID;
  v_target_casino_share_id UUID;
BEGIN
  PERFORM private.require_agent_scope(p_token, 'read:social');

  v_source_type := LOWER(TRIM(COALESCE(p_source_type, '')));
  v_comment_limit := LEAST(GREATEST(COALESCE(p_comment_limit, 20), 1), 20);

  IF v_source_type = 'post' THEN
    SELECT sp.user_id, sp.id, NULL::UUID, NULL::UUID
      INTO v_author_id, v_target_post_id, v_target_coupon_id, v_target_casino_share_id
    FROM public.social_posts sp
    WHERE sp.id = p_source_id;

    SELECT jsonb_build_object(
      'type', 'post',
      'id', sp.id,
      'content', sp.content,
      'createdAt', sp.created_at,
      'author', jsonb_build_object(
        'username', p.username,
        'avatarUrl', p.avatar_url
      )
    )
      INTO v_source
    FROM public.social_posts sp
    JOIN public.profiles p ON p.id = sp.user_id
    WHERE sp.id = p_source_id;
  ELSIF v_source_type = 'comment' THEN
    SELECT sc.user_id, sc.post_id, sc.coupon_id, sc.casino_share_id
      INTO v_author_id, v_target_post_id, v_target_coupon_id, v_target_casino_share_id
    FROM public.social_comments sc
    WHERE sc.id = p_source_id;

    SELECT jsonb_build_object(
      'type', 'comment',
      'id', sc.id,
      'content', sc.content,
      'parentId', sc.parent_id,
      'createdAt', sc.created_at,
      'target', jsonb_build_object(
        'postId', sc.post_id,
        'couponId', sc.coupon_id,
        'casinoShareId', sc.casino_share_id
      ),
      'author', jsonb_build_object(
        'username', p.username,
        'avatarUrl', p.avatar_url
      )
    )
      INTO v_source
    FROM public.social_comments sc
    JOIN public.profiles p ON p.id = sc.user_id
    WHERE sc.id = p_source_id;
  ELSE
    RAISE EXCEPTION 'Invalid social bot source type';
  END IF;

  IF v_source IS NULL THEN
    RAISE EXCEPTION 'Social bot source not found';
  END IF;

  IF v_target_post_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'type', 'post',
      'id', sp.id,
      'content', sp.content,
      'createdAt', sp.created_at,
      'author', jsonb_build_object('username', p.username, 'avatarUrl', p.avatar_url)
    )
      INTO v_target
    FROM public.social_posts sp
    JOIN public.profiles p ON p.id = sp.user_id
    WHERE sp.id = v_target_post_id;
  ELSIF v_target_coupon_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'type', 'coupon',
      'id', c.id,
      'status', c.status,
      'totalOdds', c.total_odds,
      'stake', c.stake,
      'payout', c.payout,
      'createdAt', c.created_at,
      'author', jsonb_build_object('username', p.username, 'avatarUrl', p.avatar_url)
    )
      INTO v_target
    FROM public.coupons c
    JOIN public.profiles p ON p.id = c.user_id
    WHERE c.id = v_target_coupon_id;
  ELSE
    SELECT jsonb_build_object(
      'type', 'casino',
      'id', cs.id,
      'content', cs.content,
      'betType', cs.casino_bet_type,
      'betValue', cs.casino_bet_value,
      'stake', cs.casino_stake,
      'payout', cs.casino_payout,
      'roundNumber', cs.casino_round_number,
      'winningNumber', cs.casino_winning_number,
      'winningColor', cs.casino_winning_color,
      'createdAt', cs.created_at,
      'author', jsonb_build_object('username', p.username, 'avatarUrl', p.avatar_url)
    )
      INTO v_target
    FROM public.casino_social_shares cs
    JOIN public.profiles p ON p.id = cs.user_id
    WHERE cs.id = v_target_casino_share_id;
  END IF;

  SELECT COALESCE(jsonb_agg(comment_row.item ORDER BY comment_row.created_at), '[]'::JSONB)
    INTO v_comments
  FROM (
    SELECT
      sc.created_at,
      jsonb_build_object(
        'id', sc.id,
        'content', sc.content,
        'parentId', sc.parent_id,
        'createdAt', sc.created_at,
        'author', jsonb_build_object('username', p.username, 'avatarUrl', p.avatar_url)
      ) AS item
    FROM public.social_comments sc
    JOIN public.profiles p ON p.id = sc.user_id
    WHERE (v_target_post_id IS NOT NULL AND sc.post_id = v_target_post_id)
       OR (v_target_coupon_id IS NOT NULL AND sc.coupon_id = v_target_coupon_id)
       OR (v_target_casino_share_id IS NOT NULL AND sc.casino_share_id = v_target_casino_share_id)
    ORDER BY sc.created_at DESC
    LIMIT v_comment_limit
  ) comment_row;

  RETURN jsonb_build_object(
    'source', v_source,
    'target', v_target,
    'recentComments', v_comments,
    'sourceAuthorStats', private.social_user_public_stats(v_author_id)
  );
END;
$$;

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
  v_existing private.social_bot_runs%ROWTYPE;
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

  SELECT * INTO v_existing
  FROM private.social_bot_runs
  WHERE source_type = v_source_type
    AND source_id = p_source_id;

  IF FOUND THEN
    IF v_existing.status = 'error' THEN
      UPDATE private.social_bot_runs
      SET status = 'pending',
          error = NULL,
          response_comment_id = NULL,
          updated_at = now()
      WHERE id = v_existing.id
      RETURNING id INTO v_run_id;

      RETURN jsonb_build_object(
        'status', 'pending',
        'claimed', true,
        'runId', v_run_id
      );
    END IF;

    RETURN jsonb_build_object(
      'status', 'skipped',
      'claimed', false,
      'responseCommentId', v_existing.response_comment_id,
      'reason', 'already processed'
    );
  END IF;

  INSERT INTO private.social_bot_runs (source_type, source_id, status)
  VALUES (v_source_type, p_source_id, 'pending')
  RETURNING id INTO v_run_id;

  RETURN jsonb_build_object(
    'status', 'pending',
    'claimed', true,
    'runId', v_run_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.agent_add_social_comment(
  p_token TEXT,
  p_source_type TEXT,
  p_source_id UUID,
  p_content TEXT
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

  INSERT INTO public.social_comments (user_id, content, post_id, coupon_id, casino_share_id, parent_id)
  VALUES (
    v_agent_user_id,
    v_content,
    v_post_id,
    v_coupon_id,
    v_casino_share_id,
    CASE WHEN v_source_type = 'comment' THEN p_source_id ELSE NULL END
  )
  RETURNING id INTO v_comment_id;

  UPDATE private.social_bot_runs
  SET status = 'success',
      response_comment_id = v_comment_id,
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
  p_error TEXT
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

  INSERT INTO private.social_bot_runs (source_type, source_id, status, error)
  VALUES (v_source_type, p_source_id, 'error', LEFT(COALESCE(p_error, 'Unknown error'), 500))
  ON CONFLICT (source_type, source_id) WHERE source_type IN ('post', 'comment')
  DO UPDATE SET
    status = 'error',
    error = EXCLUDED.error,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.agent_create_social_post(
  p_token TEXT,
  p_content TEXT
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

  INSERT INTO private.social_bot_runs (source_type, source_id, status, response_post_id)
  VALUES ('admin_command', gen_random_uuid(), 'success', v_post_id)
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

GRANT EXECUTE ON FUNCTION public.agent_get_social_context(TEXT, TEXT, UUID, INTEGER) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agent_claim_social_bot_reply(TEXT, TEXT, UUID, UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agent_add_social_comment(TEXT, TEXT, UUID, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agent_record_social_bot_error(TEXT, TEXT, UUID, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agent_create_social_post(TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_social_bot_runs(INTEGER) TO authenticated;
