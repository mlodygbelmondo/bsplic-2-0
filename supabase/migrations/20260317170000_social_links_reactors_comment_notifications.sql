-- Migration: reactors list + comment-on-post notifications

ALTER TYPE public.notification_type
  ADD VALUE IF NOT EXISTS 'comment_post';

CREATE OR REPLACE FUNCTION public.get_reactors_for_target(
  p_post_id UUID DEFAULT NULL,
  p_coupon_id UUID DEFAULT NULL,
  p_comment_id UUID DEFAULT NULL,
  p_emoji public.reaction_emoji DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  IF (CASE WHEN p_post_id IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN p_coupon_id IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN p_comment_id IS NOT NULL THEN 1 ELSE 0 END) <> 1 THEN
    RAISE EXCEPTION 'Należy podać dokładnie jeden cel reakcji';
  END IF;

  SELECT json_agg(row_to_json(r) ORDER BY r.created_at DESC)
    INTO v_result
  FROM (
    SELECT
      sr.user_id,
      p.username,
      sr.emoji::TEXT AS emoji,
      sr.created_at
    FROM public.social_reactions sr
    JOIN public.profiles p ON p.id = sr.user_id
    WHERE (
      (p_post_id IS NOT NULL AND sr.post_id = p_post_id)
      OR (p_coupon_id IS NOT NULL AND sr.coupon_id = p_coupon_id)
      OR (p_comment_id IS NOT NULL AND sr.comment_id = p_comment_id)
    )
    AND (p_emoji IS NULL OR sr.emoji = p_emoji)
  ) r;

  RETURN COALESCE(v_result, '[]'::JSON);
END;
$$;

CREATE OR REPLACE FUNCTION public.add_social_comment(
  p_user_id UUID,
  p_content TEXT,
  p_post_id UUID DEFAULT NULL,
  p_coupon_id UUID DEFAULT NULL,
  p_parent_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comment_id UUID;
  v_actor_username TEXT;
  v_content TEXT;
  v_mentions TEXT[];
  v_mentioned_user_id UUID;
  v_target_item_type TEXT;
  v_target_item_id UUID;
  v_post_owner_id UUID;
BEGIN
  v_content := TRIM(COALESCE(p_content, ''));

  IF char_length(v_content) = 0 THEN
    RAISE EXCEPTION 'Komentarz nie może być pusty';
  END IF;
  IF char_length(v_content) > 700 THEN
    RAISE EXCEPTION 'Komentarz może mieć maksymalnie 700 znaków';
  END IF;

  IF p_post_id IS NULL AND p_coupon_id IS NULL THEN
    RAISE EXCEPTION 'Komentarz musi być przypisany do posta lub kuponu';
  END IF;
  IF p_post_id IS NOT NULL AND p_coupon_id IS NOT NULL THEN
    RAISE EXCEPTION 'Komentarz nie może być przypisany jednocześnie do posta i kuponu';
  END IF;

  INSERT INTO public.social_comments (user_id, content, post_id, coupon_id, parent_id)
  VALUES (p_user_id, v_content, p_post_id, p_coupon_id, p_parent_id)
  RETURNING id INTO v_comment_id;

  SELECT username INTO v_actor_username
  FROM public.profiles
  WHERE id = p_user_id;

  IF p_post_id IS NOT NULL THEN
    SELECT user_id INTO v_post_owner_id
    FROM public.social_posts
    WHERE id = p_post_id;

    IF v_post_owner_id IS NOT NULL AND v_post_owner_id <> p_user_id THEN
      PERFORM public.create_user_notification(
        v_post_owner_id,
        'comment_post'::public.notification_type,
        FORMAT('@%s skomentował Twój post', COALESCE(v_actor_username, 'Ktoś')),
        LEFT(v_content, 120),
        p_user_id,
        FORMAT('/social?itemType=post&itemId=%s', p_post_id::TEXT),
        jsonb_build_object(
          'source', 'comment_post',
          'comment_id', v_comment_id,
          'post_id', p_post_id
        )
      );
    END IF;
  END IF;

  v_target_item_type := CASE WHEN p_post_id IS NOT NULL THEN 'post' ELSE 'coupon' END;
  v_target_item_id := COALESCE(p_post_id, p_coupon_id);
  v_mentions := public.extract_mentioned_usernames(v_content);

  IF COALESCE(array_length(v_mentions, 1), 0) > 0 THEN
    FOR v_mentioned_user_id IN
      SELECT DISTINCT p.id
      FROM public.profiles p
      WHERE LOWER(p.username) = ANY(v_mentions)
        AND p.id <> p_user_id
    LOOP
      IF v_post_owner_id IS NOT NULL AND v_mentioned_user_id = v_post_owner_id THEN
        CONTINUE;
      END IF;

      PERFORM public.create_user_notification(
        v_mentioned_user_id,
        'mention_comment'::public.notification_type,
        FORMAT('@%s wspomniał o Tobie', COALESCE(v_actor_username, 'Ktoś')),
        'W komentarzu',
        p_user_id,
        FORMAT('/social?itemType=%s&itemId=%s', v_target_item_type, v_target_item_id::TEXT),
        jsonb_build_object(
          'source', 'comment',
          'comment_id', v_comment_id,
          'target_item_type', v_target_item_type,
          'target_item_id', v_target_item_id
        )
      );
    END LOOP;
  END IF;

  RETURN v_comment_id;
END;
$$;
