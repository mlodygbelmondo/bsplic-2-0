CREATE OR REPLACE FUNCTION public.create_user_notification(
  p_user_id UUID,
  p_type public.notification_type,
  p_title TEXT,
  p_body TEXT DEFAULT NULL,
  p_actor_user_id UUID DEFAULT NULL,
  p_link_path TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO public.user_notifications (
    user_id,
    actor_user_id,
    type,
    title,
    body,
    link_path,
    metadata
  )
  VALUES (
    p_user_id,
    p_actor_user_id,
    p_type,
    p_title,
    p_body,
    p_link_path,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_user_notification(
  UUID,
  public.notification_type,
  TEXT,
  TEXT,
  UUID,
  TEXT,
  JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_notification(
  UUID,
  public.notification_type,
  TEXT,
  TEXT,
  UUID,
  TEXT,
  JSONB
) TO service_role;

CREATE OR REPLACE FUNCTION public.get_user_notifications(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
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
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Brak dostępu do powiadomień';
  END IF;

  SELECT json_agg(row_to_json(notification_row))
    INTO v_result
  FROM (
    SELECT
      n.id,
      n.user_id,
      n.actor_user_id,
      n.type::TEXT AS type,
      n.title,
      n.body,
      n.link_path,
      n.metadata,
      n.is_read,
      n.read_at,
      n.created_at,
      actor.username AS actor_username
    FROM public.user_notifications n
    LEFT JOIN public.profiles actor ON actor.id = n.actor_user_id
    WHERE n.user_id = p_user_id
    ORDER BY n.created_at DESC
    LIMIT LEAST(GREATEST(p_limit, 1), 100)
    OFFSET GREATEST(p_offset, 0)
  ) notification_row;

  RETURN COALESCE(v_result, '[]'::JSON);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_unread_notifications_count(
  p_user_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Brak dostępu do powiadomień';
  END IF;

  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM public.user_notifications
    WHERE user_id = p_user_id
      AND is_read = FALSE
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_notification_read(
  p_user_id UUID,
  p_notification_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Brak dostępu do powiadomień';
  END IF;

  UPDATE public.user_notifications
  SET
    is_read = TRUE,
    read_at = COALESCE(read_at, NOW())
  WHERE id = p_notification_id
    AND user_id = p_user_id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN COALESCE(v_updated_count, 0) > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(
  p_user_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Brak dostępu do powiadomień';
  END IF;

  UPDATE public.user_notifications
  SET
    is_read = TRUE,
    read_at = COALESCE(read_at, NOW())
  WHERE user_id = p_user_id
    AND is_read = FALSE;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN COALESCE(v_updated_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_social_post(
  p_user_id UUID,
  p_content TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_id UUID;
  v_actor_username TEXT;
  v_content TEXT;
  v_mentions TEXT[];
  v_mentioned_user_id UUID;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Brak dostępu do tworzenia posta';
  END IF;

  v_content := TRIM(COALESCE(p_content, ''));

  IF char_length(v_content) = 0 THEN
    RAISE EXCEPTION 'Treść posta nie może być pusta';
  END IF;
  IF char_length(v_content) > 700 THEN
    RAISE EXCEPTION 'Post może mieć maksymalnie 700 znaków';
  END IF;

  INSERT INTO public.social_posts (user_id, content)
  VALUES (p_user_id, v_content)
  RETURNING id INTO v_post_id;

  SELECT username INTO v_actor_username
  FROM public.profiles
  WHERE id = p_user_id;

  v_mentions := public.extract_mentioned_usernames(v_content);

  IF COALESCE(array_length(v_mentions, 1), 0) > 0 THEN
    FOR v_mentioned_user_id IN
      SELECT DISTINCT p.id
      FROM public.profiles p
      WHERE LOWER(p.username) = ANY(v_mentions)
        AND p.id <> p_user_id
    LOOP
      PERFORM public.create_user_notification(
        v_mentioned_user_id,
        'mention_post'::public.notification_type,
        FORMAT('@%s wspomniał o Tobie', COALESCE(v_actor_username, 'Ktoś')),
        'W poście społecznościowym',
        p_user_id,
        FORMAT('/social?itemType=post&itemId=%s', v_post_id::TEXT),
        jsonb_build_object(
          'source', 'post',
          'post_id', v_post_id
        )
      );
    END LOOP;
  END IF;

  RETURN v_post_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_notifications(UUID, INTEGER, INTEGER) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_unread_notifications_count(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_notification_read(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_all_notifications_read(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_social_post(UUID, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_user_notifications(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unread_notifications_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_social_post(UUID, TEXT) TO authenticated;
