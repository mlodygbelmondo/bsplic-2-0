-- Migration: Social posts, comments, and reactions
-- Created: 2026-03-16

-- ============================================================
-- 1. social_posts — user-authored text posts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.social_posts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all posts"
  ON public.social_posts FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own posts"
  ON public.social_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts"
  ON public.social_posts FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_social_posts_created ON public.social_posts (created_at DESC);
CREATE INDEX idx_social_posts_user    ON public.social_posts (user_id);

-- ============================================================
-- 2. social_comments — comments on posts or coupons,
--    with optional parent_id for nesting (replies)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.social_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- exactly one target must be set
  post_id     UUID REFERENCES public.social_posts(id) ON DELETE CASCADE,
  coupon_id   UUID REFERENCES public.coupons(id) ON DELETE CASCADE,
  parent_id   UUID REFERENCES public.social_comments(id) ON DELETE CASCADE,
  content     TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- ensure exactly one of post_id / coupon_id is set
  CONSTRAINT comment_target_check CHECK (
    (post_id IS NOT NULL AND coupon_id IS NULL)
    OR (post_id IS NULL AND coupon_id IS NOT NULL)
  )
);

ALTER TABLE public.social_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all comments"
  ON public.social_comments FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own comments"
  ON public.social_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON public.social_comments FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_comments_post      ON public.social_comments (post_id, created_at);
CREATE INDEX idx_comments_coupon    ON public.social_comments (coupon_id, created_at);
CREATE INDEX idx_comments_parent    ON public.social_comments (parent_id);

-- ============================================================
-- 3. social_reactions — emoji reactions on posts, coupons,
--    or comments. One reaction per user per target.
-- ============================================================
CREATE TYPE public.reaction_emoji AS ENUM (
  'like', 'heart', 'laugh', 'wow', 'sad', 'angry'
);

CREATE TABLE IF NOT EXISTS public.social_reactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji       public.reaction_emoji NOT NULL,
  -- exactly one target must be set
  post_id     UUID REFERENCES public.social_posts(id) ON DELETE CASCADE,
  coupon_id   UUID REFERENCES public.coupons(id) ON DELETE CASCADE,
  comment_id  UUID REFERENCES public.social_comments(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- ensure exactly one target is set
  CONSTRAINT reaction_target_check CHECK (
    (CASE WHEN post_id    IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN coupon_id  IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN comment_id IS NOT NULL THEN 1 ELSE 0 END) = 1
  )
);

ALTER TABLE public.social_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all reactions"
  ON public.social_reactions FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own reactions"
  ON public.social_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reactions"
  ON public.social_reactions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reactions"
  ON public.social_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- Unique: one reaction per user per target
CREATE UNIQUE INDEX idx_reactions_user_post
  ON public.social_reactions (user_id, post_id) WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX idx_reactions_user_coupon
  ON public.social_reactions (user_id, coupon_id) WHERE coupon_id IS NOT NULL;
CREATE UNIQUE INDEX idx_reactions_user_comment
  ON public.social_reactions (user_id, comment_id) WHERE comment_id IS NOT NULL;

-- For aggregation queries
CREATE INDEX idx_reactions_post    ON public.social_reactions (post_id)    WHERE post_id IS NOT NULL;
CREATE INDEX idx_reactions_coupon  ON public.social_reactions (coupon_id)  WHERE coupon_id IS NOT NULL;
CREATE INDEX idx_reactions_comment ON public.social_reactions (comment_id) WHERE comment_id IS NOT NULL;

-- ============================================================
-- 4. RPC: create_social_post — creates a post, returns its id
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
BEGIN
  IF char_length(TRIM(p_content)) = 0 THEN
    RAISE EXCEPTION 'Treść posta nie może być pusta';
  END IF;
  IF char_length(p_content) > 500 THEN
    RAISE EXCEPTION 'Post może mieć maksymalnie 500 znaków';
  END IF;

  INSERT INTO public.social_posts (user_id, content)
  VALUES (p_user_id, TRIM(p_content))
  RETURNING id INTO v_post_id;

  RETURN v_post_id;
END;
$$;

-- ============================================================
-- 5. RPC: add_social_comment — adds a comment to a post or coupon
-- ============================================================
CREATE OR REPLACE FUNCTION public.add_social_comment(
  p_user_id   UUID,
  p_content   TEXT,
  p_post_id   UUID DEFAULT NULL,
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
BEGIN
  IF char_length(TRIM(p_content)) = 0 THEN
    RAISE EXCEPTION 'Komentarz nie może być pusty';
  END IF;
  IF char_length(p_content) > 500 THEN
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
  VALUES (p_user_id, TRIM(p_content), p_post_id, p_coupon_id, p_parent_id)
  RETURNING id INTO v_comment_id;

  RETURN v_comment_id;
END;
$$;

-- ============================================================
-- 6. RPC: toggle_reaction — upsert or remove a reaction.
--    If same emoji exists, removes it.
--    If different emoji or no reaction, upserts.
--    Returns the resulting emoji or NULL if removed.
-- ============================================================
CREATE OR REPLACE FUNCTION public.toggle_reaction(
  p_user_id    UUID,
  p_emoji      public.reaction_emoji,
  p_post_id    UUID DEFAULT NULL,
  p_coupon_id  UUID DEFAULT NULL,
  p_comment_id UUID DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_emoji public.reaction_emoji;
  v_existing_id    UUID;
BEGIN
  -- Exactly one target
  IF (CASE WHEN p_post_id    IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN p_coupon_id  IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN p_comment_id IS NOT NULL THEN 1 ELSE 0 END) <> 1 THEN
    RAISE EXCEPTION 'Reakcja musi dotyczyć dokładnie jednego elementu';
  END IF;

  -- Find existing reaction for this user on this target
  SELECT id, emoji INTO v_existing_id, v_existing_emoji
    FROM public.social_reactions
   WHERE user_id = p_user_id
     AND (post_id    IS NOT DISTINCT FROM p_post_id)
     AND (coupon_id  IS NOT DISTINCT FROM p_coupon_id)
     AND (comment_id IS NOT DISTINCT FROM p_comment_id);

  IF v_existing_id IS NOT NULL THEN
    IF v_existing_emoji = p_emoji THEN
      -- Same emoji → remove (toggle off)
      DELETE FROM public.social_reactions WHERE id = v_existing_id;
      RETURN NULL;
    ELSE
      -- Different emoji → update
      UPDATE public.social_reactions
         SET emoji = p_emoji
       WHERE id = v_existing_id;
      RETURN p_emoji::TEXT;
    END IF;
  ELSE
    -- No existing → insert
    INSERT INTO public.social_reactions (user_id, emoji, post_id, coupon_id, comment_id)
    VALUES (p_user_id, p_emoji, p_post_id, p_coupon_id, p_comment_id);
    RETURN p_emoji::TEXT;
  END IF;
END;
$$;

-- ============================================================
-- 7. RPC: get_social_feed — mixed feed of posts + coupons
--    with reaction counts, comment counts, and usernames.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_social_feed(
  p_limit  INTEGER DEFAULT 30,
  p_offset INTEGER DEFAULT 0,
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
  WITH feed_items AS (
    -- Posts
    SELECT
      sp.id,
      'post' AS item_type,
      sp.user_id,
      pr.username,
      sp.content,
      NULL::NUMERIC AS total_odds,
      NULL::NUMERIC AS stake,
      NULL::NUMERIC AS payout,
      NULL::TEXT    AS status,
      NULL::JSON    AS legs,
      sp.created_at
    FROM public.social_posts sp
    JOIN public.profiles pr ON pr.id = sp.user_id

    UNION ALL

    -- Coupons
    SELECT
      c.id,
      'coupon' AS item_type,
      c.user_id,
      pr.username,
      NULL AS content,
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
          ) ORDER BY pb.created_at
        )
        FROM public.placed_bets pb
        LEFT JOIN public.bets b ON b.id = pb.bet_id
        WHERE pb.coupon_id = c.id
      ) AS legs,
      c.created_at
    FROM public.coupons c
    JOIN public.profiles pr ON pr.id = c.user_id
  ),
  ordered_feed AS (
    SELECT * FROM feed_items
    ORDER BY created_at DESC
    LIMIT p_limit OFFSET p_offset
  ),
  with_counts AS (
    SELECT
      f.*,
      (
        SELECT json_object_agg(r.emoji, r.cnt)
        FROM (
          SELECT sr.emoji::TEXT, COUNT(*) AS cnt
          FROM public.social_reactions sr
          WHERE (f.item_type = 'post'   AND sr.post_id   = f.id)
             OR (f.item_type = 'coupon' AND sr.coupon_id  = f.id)
          GROUP BY sr.emoji
        ) r
      ) AS reactions,
      (
        SELECT COUNT(*)
        FROM public.social_comments sc
        WHERE (f.item_type = 'post'   AND sc.post_id   = f.id)
           OR (f.item_type = 'coupon' AND sc.coupon_id  = f.id)
      ) AS comment_count,
      (
        SELECT sr.emoji::TEXT
        FROM public.social_reactions sr
        WHERE sr.user_id = p_user_id
          AND ((f.item_type = 'post'   AND sr.post_id   = f.id)
            OR (f.item_type = 'coupon' AND sr.coupon_id  = f.id))
        LIMIT 1
      ) AS my_reaction
    FROM ordered_feed f
  )
  SELECT json_agg(row_to_json(wc) ORDER BY wc.created_at DESC)
    INTO v_result
    FROM with_counts wc;

  RETURN COALESCE(v_result, '[]'::JSON);
END;
$$;

-- ============================================================
-- 8. RPC: get_comments_for_target — returns flat comment list
--    with usernames and reaction counts, for a post or coupon.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_comments_for_target(
  p_post_id   UUID DEFAULT NULL,
  p_coupon_id UUID DEFAULT NULL,
  p_user_id   UUID DEFAULT NULL
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
  SELECT json_agg(row_to_json(c_row) ORDER BY c_row.created_at)
    INTO v_result
    FROM (
      SELECT
        sc.id,
        sc.user_id,
        pr.username,
        sc.content,
        sc.parent_id,
        sc.created_at,
        (
          SELECT json_object_agg(r.emoji, r.cnt)
          FROM (
            SELECT sr.emoji::TEXT, COUNT(*) AS cnt
            FROM public.social_reactions sr
            WHERE sr.comment_id = sc.id
            GROUP BY sr.emoji
          ) r
        ) AS reactions,
        (
          SELECT sr.emoji::TEXT
          FROM public.social_reactions sr
          WHERE sr.comment_id = sc.id
            AND sr.user_id = p_user_id
          LIMIT 1
        ) AS my_reaction
      FROM public.social_comments sc
      JOIN public.profiles pr ON pr.id = sc.user_id
      WHERE (p_post_id   IS NOT NULL AND sc.post_id   = p_post_id)
         OR (p_coupon_id IS NOT NULL AND sc.coupon_id  = p_coupon_id)
    ) c_row;

  RETURN COALESCE(v_result, '[]'::JSON);
END;
$$;
