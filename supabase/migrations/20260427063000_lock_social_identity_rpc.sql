CREATE OR REPLACE FUNCTION public.add_social_comment(
  p_user_id UUID,
  p_content TEXT,
  p_post_id UUID DEFAULT NULL,
  p_coupon_id UUID DEFAULT NULL,
  p_casino_share_id UUID DEFAULT NULL,
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
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Brak dostępu do komentarza';
  END IF;

  v_content := TRIM(COALESCE(p_content, ''));

  IF char_length(v_content) = 0 THEN
    RAISE EXCEPTION 'Komentarz nie może być pusty';
  END IF;
  IF char_length(v_content) > 700 THEN
    RAISE EXCEPTION 'Komentarz może mieć maksymalnie 700 znaków';
  END IF;

  IF (CASE WHEN p_post_id IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN p_coupon_id IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN p_casino_share_id IS NOT NULL THEN 1 ELSE 0 END) <> 1 THEN
    RAISE EXCEPTION 'Komentarz musi być przypisany do dokładnie jednego elementu';
  END IF;

  INSERT INTO public.social_comments (user_id, content, post_id, coupon_id, casino_share_id, parent_id)
  VALUES (p_user_id, v_content, p_post_id, p_coupon_id, p_casino_share_id, p_parent_id)
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

  v_target_item_type := CASE
    WHEN p_post_id IS NOT NULL THEN 'post'
    WHEN p_coupon_id IS NOT NULL THEN 'coupon'
    ELSE 'casino'
  END;
  v_target_item_id := COALESCE(p_post_id, p_coupon_id, p_casino_share_id);
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

CREATE OR REPLACE FUNCTION public.toggle_reaction(
  p_user_id UUID,
  p_emoji public.reaction_emoji,
  p_post_id UUID DEFAULT NULL,
  p_coupon_id UUID DEFAULT NULL,
  p_casino_share_id UUID DEFAULT NULL,
  p_comment_id UUID DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_emoji public.reaction_emoji;
  v_existing_id UUID;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Brak dostępu do reakcji';
  END IF;

  IF (CASE WHEN p_post_id IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN p_coupon_id IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN p_casino_share_id IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN p_comment_id IS NOT NULL THEN 1 ELSE 0 END) <> 1 THEN
    RAISE EXCEPTION 'Reakcja musi dotyczyć dokładnie jednego elementu';
  END IF;

  SELECT id, emoji INTO v_existing_id, v_existing_emoji
  FROM public.social_reactions
  WHERE user_id = p_user_id
    AND (post_id IS NOT DISTINCT FROM p_post_id)
    AND (coupon_id IS NOT DISTINCT FROM p_coupon_id)
    AND (casino_share_id IS NOT DISTINCT FROM p_casino_share_id)
    AND (comment_id IS NOT DISTINCT FROM p_comment_id);

  IF v_existing_id IS NOT NULL THEN
    IF v_existing_emoji = p_emoji THEN
      DELETE FROM public.social_reactions WHERE id = v_existing_id;
      RETURN NULL;
    END IF;

    UPDATE public.social_reactions
    SET emoji = p_emoji
    WHERE id = v_existing_id;
    RETURN p_emoji::TEXT;
  END IF;

  INSERT INTO public.social_reactions (user_id, emoji, post_id, coupon_id, casino_share_id, comment_id)
  VALUES (p_user_id, p_emoji, p_post_id, p_coupon_id, p_casino_share_id, p_comment_id);
  RETURN p_emoji::TEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.add_social_comment(UUID, TEXT, UUID, UUID, UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.toggle_reaction(UUID, public.reaction_emoji, UUID, UUID, UUID, UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.add_social_comment(UUID, TEXT, UUID, UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_reaction(UUID, public.reaction_emoji, UUID, UUID, UUID, UUID) TO authenticated;
