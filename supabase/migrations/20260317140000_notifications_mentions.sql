-- Migration: reusable notifications + @mentions + coupon win notifications

-- ============================================================
-- 1. Notification types and table
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'notification_type'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.notification_type AS ENUM (
      'mention_post',
      'mention_comment',
      'coupon_won'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type public.notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link_path TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_created
  ON public.user_notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_unread
  ON public.user_notifications (user_id, is_read)
  WHERE is_read = FALSE;

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.user_notifications;
CREATE POLICY "Users can view own notifications"
  ON public.user_notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.user_notifications;
CREATE POLICY "Users can update own notifications"
  ON public.user_notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 2. Notification helper RPCs
-- ============================================================
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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.user_notifications
  WHERE user_id = p_user_id
    AND is_read = FALSE;
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

-- ============================================================
-- 3. Mention helpers
-- ============================================================
CREATE OR REPLACE FUNCTION public.extract_mentioned_usernames(
  p_content TEXT
)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(array_agg(DISTINCT LOWER((m)[2])), ARRAY[]::TEXT[])
  FROM regexp_matches(
    COALESCE(p_content, ''),
    '(^|[[:space:]])@([[:alnum:]_.-]{2,32})',
    'g'
  ) AS m;
$$;

CREATE OR REPLACE FUNCTION public.search_mention_users(
  p_query TEXT,
  p_current_user_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 6
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
  v_query TEXT;
BEGIN
  v_query := TRIM(COALESCE(p_query, ''));

  IF char_length(v_query) = 0 THEN
    RETURN '[]'::JSON;
  END IF;

  SELECT json_agg(row_to_json(user_row))
    INTO v_result
  FROM (
    SELECT
      p.id,
      p.username
    FROM public.profiles p
    WHERE LOWER(p.username) LIKE LOWER(v_query) || '%'
      AND (p_current_user_id IS NULL OR p.id <> p_current_user_id)
    ORDER BY
      CASE WHEN LOWER(p.username) = LOWER(v_query) THEN 0 ELSE 1 END,
      char_length(p.username),
      p.username
    LIMIT LEAST(GREATEST(p_limit, 1), 10)
  ) user_row;

  RETURN COALESCE(v_result, '[]'::JSON);
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.profiles
    GROUP BY LOWER(username)
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Wykryto zduplikowane nazwy użytkowników (case-insensitive). Ujednolić nicki przed włączeniem wzmianek @.';
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_lower_unique
  ON public.profiles (LOWER(username));

-- ============================================================
-- 4. Feed single-item helper
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_social_feed_item(
  p_item_type TEXT,
  p_item_id UUID,
  p_user_id UUID DEFAULT NULL
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
  IF p_item_type NOT IN ('post', 'coupon') THEN
    RAISE EXCEPTION 'Nieprawidłowy typ elementu social';
  END IF;

  WITH item_data AS (
    SELECT
      sp.id,
      'post'::TEXT AS item_type,
      sp.user_id,
      pr.username,
      sp.content,
      NULL::NUMERIC AS total_odds,
      NULL::NUMERIC AS stake,
      NULL::NUMERIC AS payout,
      NULL::TEXT AS status,
      NULL::JSON AS legs,
      sp.created_at
    FROM public.social_posts sp
    JOIN public.profiles pr ON pr.id = sp.user_id
    WHERE p_item_type = 'post'
      AND sp.id = p_item_id

    UNION ALL

    SELECT
      c.id,
      'coupon'::TEXT AS item_type,
      c.user_id,
      pr.username,
      NULL::TEXT AS content,
      c.total_odds,
      c.stake,
      c.payout,
      c.status::TEXT,
      (
        SELECT json_agg(
          json_build_object(
            'id', pb.id,
            'bet_id', pb.bet_id,
            'selected_option', pb.selected_option,
            'odds_at_time', pb.odds_at_time,
            'result', pb.result,
            'bet_title', b.title
          )
          ORDER BY pb.created_at
        )
        FROM public.placed_bets pb
        LEFT JOIN public.bets b ON b.id = pb.bet_id
        WHERE pb.coupon_id = c.id
      ) AS legs,
      c.created_at
    FROM public.coupons c
    JOIN public.profiles pr ON pr.id = c.user_id
    WHERE p_item_type = 'coupon'
      AND c.id = p_item_id
  ),
  with_counts AS (
    SELECT
      i.*,
      (
        SELECT json_object_agg(r.emoji, r.cnt)
        FROM (
          SELECT sr.emoji::TEXT, COUNT(*) AS cnt
          FROM public.social_reactions sr
          WHERE (i.item_type = 'post' AND sr.post_id = i.id)
             OR (i.item_type = 'coupon' AND sr.coupon_id = i.id)
          GROUP BY sr.emoji
        ) r
      ) AS reactions,
      (
        SELECT COUNT(*)
        FROM public.social_comments sc
        WHERE (i.item_type = 'post' AND sc.post_id = i.id)
           OR (i.item_type = 'coupon' AND sc.coupon_id = i.id)
      ) AS comment_count,
      (
        SELECT sr.emoji::TEXT
        FROM public.social_reactions sr
        WHERE sr.user_id = p_user_id
          AND ((i.item_type = 'post' AND sr.post_id = i.id)
            OR (i.item_type = 'coupon' AND sr.coupon_id = i.id))
        LIMIT 1
      ) AS my_reaction
    FROM item_data i
  )
  SELECT row_to_json(wc)
    INTO v_result
  FROM with_counts wc
  LIMIT 1;

  RETURN v_result;
END;
$$;

-- ============================================================
-- 5. Mentions in post/comment creation
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
  IF char_length(v_content) > 500 THEN
    RAISE EXCEPTION 'Post może mieć maksymalnie 500 znaków';
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
  IF char_length(v_content) > 500 THEN
    RAISE EXCEPTION 'Komentarz może mieć maksymalnie 500 znaków';
  END IF;

  -- Exactly one target
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
-- 6. Coupon win notification trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_coupon_won()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'won' AND OLD.status IS DISTINCT FROM 'won' THEN
    PERFORM public.create_user_notification(
      NEW.user_id,
      'coupon_won'::public.notification_type,
      'Twój kupon jest wygrany!',
      FORMAT('Kupon został rozliczony. Wypłata: %s zł', ROUND(COALESCE(NEW.payout, 0), 2)),
      NULL,
      FORMAT('/social?itemType=coupon&itemId=%s', NEW.id::TEXT),
      jsonb_build_object(
        'coupon_id', NEW.id,
        'payout', NEW.payout,
        'stake', NEW.stake,
        'total_odds', NEW.total_odds
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_coupon_won ON public.coupons;
CREATE TRIGGER trg_notify_coupon_won
  AFTER UPDATE ON public.coupons
  FOR EACH ROW
  WHEN (NEW.status = 'won' AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.notify_coupon_won();

-- ============================================================
-- 7. Realtime for notifications table
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'user_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;
  END IF;
END
$$;
