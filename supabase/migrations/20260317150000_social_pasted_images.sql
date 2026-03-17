-- Migration: enable pasted images (1 image marker in post/comment content)

-- ============================================================
-- 1. Allow extra content length for optional image marker
-- ============================================================
ALTER TABLE public.social_posts
  DROP CONSTRAINT IF EXISTS social_posts_content_check;

ALTER TABLE public.social_posts
  ADD CONSTRAINT social_posts_content_check
  CHECK (char_length(content) BETWEEN 1 AND 700);

ALTER TABLE public.social_comments
  DROP CONSTRAINT IF EXISTS social_comments_content_check;

ALTER TABLE public.social_comments
  ADD CONSTRAINT social_comments_content_check
  CHECK (char_length(content) BETWEEN 1 AND 700);

-- ============================================================
-- 2. Update RPC validation limits
-- ============================================================
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

-- ============================================================
-- 3. Storage bucket for social images
-- ============================================================
INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'social-images',
  'social-images',
  TRUE,
  300000,
  ARRAY['image/jpeg']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read social images" ON storage.objects;
CREATE POLICY "Public read social images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'social-images');

DROP POLICY IF EXISTS "Users upload own social images" ON storage.objects;
CREATE POLICY "Users upload own social images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'social-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users delete own social images" ON storage.objects;
CREATE POLICY "Users delete own social images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'social-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
