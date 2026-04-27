-- Persist casino win shares in the normal Social feed.

CREATE TABLE IF NOT EXISTS public.casino_social_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  roulette_bet_id UUID REFERENCES public.casino_roulette_bets(id) ON DELETE SET NULL,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  casino_bet_type TEXT NOT NULL,
  casino_bet_value TEXT NOT NULL,
  casino_stake NUMERIC NOT NULL CHECK (casino_stake >= 0),
  casino_payout NUMERIC NOT NULL CHECK (casino_payout >= 0),
  casino_round_number INTEGER,
  casino_winning_number INTEGER,
  casino_winning_color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT casino_social_shares_winning_color_check CHECK (
    casino_winning_color IS NULL OR casino_winning_color IN ('red', 'black', 'green')
  )
);

ALTER TABLE public.casino_social_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all casino social shares" ON public.casino_social_shares;
CREATE POLICY "Users can view all casino social shares"
  ON public.casino_social_shares FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert own casino social shares" ON public.casino_social_shares;
CREATE POLICY "Users can insert own casino social shares"
  ON public.casino_social_shares FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own casino social shares" ON public.casino_social_shares;
CREATE POLICY "Users can delete own casino social shares"
  ON public.casino_social_shares FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_casino_social_shares_created
  ON public.casino_social_shares (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_casino_social_shares_user_created
  ON public.casino_social_shares (user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_casino_social_shares_roulette_bet_unique
  ON public.casino_social_shares (roulette_bet_id)
  WHERE roulette_bet_id IS NOT NULL;

ALTER TABLE public.social_comments
  ADD COLUMN IF NOT EXISTS casino_share_id UUID REFERENCES public.casino_social_shares(id) ON DELETE CASCADE;

ALTER TABLE public.social_reactions
  ADD COLUMN IF NOT EXISTS casino_share_id UUID REFERENCES public.casino_social_shares(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'comment_target_check'
      AND conrelid = 'public.social_comments'::regclass
  ) THEN
    ALTER TABLE public.social_comments DROP CONSTRAINT comment_target_check;
  END IF;

  ALTER TABLE public.social_comments
    ADD CONSTRAINT comment_target_check CHECK (
      (CASE WHEN post_id IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN coupon_id IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN casino_share_id IS NOT NULL THEN 1 ELSE 0 END) = 1
    );
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reaction_target_check'
      AND conrelid = 'public.social_reactions'::regclass
  ) THEN
    ALTER TABLE public.social_reactions DROP CONSTRAINT reaction_target_check;
  END IF;

  ALTER TABLE public.social_reactions
    ADD CONSTRAINT reaction_target_check CHECK (
      (CASE WHEN post_id IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN coupon_id IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN casino_share_id IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN comment_id IS NOT NULL THEN 1 ELSE 0 END) = 1
    );
END $$;

CREATE INDEX IF NOT EXISTS idx_comments_casino_share
  ON public.social_comments (casino_share_id, created_at)
  WHERE casino_share_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_reactions_user_casino_share
  ON public.social_reactions (user_id, casino_share_id)
  WHERE casino_share_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reactions_casino_share
  ON public.social_reactions (casino_share_id)
  WHERE casino_share_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_casino_social_share(
  p_user_id UUID,
  p_roulette_bet_id UUID,
  p_content TEXT,
  p_casino_bet_type TEXT,
  p_casino_bet_value TEXT,
  p_casino_stake NUMERIC,
  p_casino_payout NUMERIC,
  p_casino_round_number INTEGER DEFAULT NULL,
  p_casino_winning_number INTEGER DEFAULT NULL,
  p_casino_winning_color TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_share_id UUID;
  v_content TEXT;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Nie możesz udostępnić wygranej innego użytkownika';
  END IF;

  v_content := TRIM(COALESCE(p_content, ''));

  IF char_length(v_content) = 0 THEN
    RAISE EXCEPTION 'Treść udostępnienia nie może być pusta';
  END IF;
  IF char_length(v_content) > 500 THEN
    RAISE EXCEPTION 'Udostępnienie może mieć maksymalnie 500 znaków';
  END IF;

  IF p_roulette_bet_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.casino_roulette_bets b
    WHERE b.id = p_roulette_bet_id
      AND b.user_id = p_user_id
      AND b.is_win = TRUE
      AND b.payout > 0
  ) THEN
    RAISE EXCEPTION 'Możesz udostępnić tylko własną wygraną';
  END IF;

  INSERT INTO public.casino_social_shares (
    user_id,
    roulette_bet_id,
    content,
    casino_bet_type,
    casino_bet_value,
    casino_stake,
    casino_payout,
    casino_round_number,
    casino_winning_number,
    casino_winning_color
  )
  VALUES (
    p_user_id,
    p_roulette_bet_id,
    v_content,
    p_casino_bet_type,
    p_casino_bet_value,
    ROUND(p_casino_stake, 2),
    ROUND(p_casino_payout, 2),
    p_casino_round_number,
    p_casino_winning_number,
    p_casino_winning_color
  )
  ON CONFLICT (roulette_bet_id) WHERE (roulette_bet_id IS NOT NULL) DO UPDATE
    SET content = EXCLUDED.content
  RETURNING id INTO v_share_id;

  RETURN v_share_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_social_feed(
  p_limit INTEGER DEFAULT 30,
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
    SELECT
      sp.id,
      'post'::TEXT AS item_type,
      sp.user_id,
      pr.username,
      pr.avatar_url,
      sp.content,
      NULL::NUMERIC AS total_odds,
      NULL::NUMERIC AS stake,
      NULL::NUMERIC AS payout,
      NULL::TEXT AS status,
      NULL::JSON AS legs,
      NULL::TEXT AS casino_bet_type,
      NULL::TEXT AS casino_bet_value,
      NULL::NUMERIC AS casino_stake,
      NULL::NUMERIC AS casino_payout,
      NULL::INTEGER AS casino_round_number,
      NULL::INTEGER AS casino_winning_number,
      NULL::TEXT AS casino_winning_color,
      sp.created_at
    FROM public.social_posts sp
    JOIN public.profiles pr ON pr.id = sp.user_id

    UNION ALL

    SELECT
      c.id,
      'coupon'::TEXT AS item_type,
      c.user_id,
      pr.username,
      pr.avatar_url,
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
          ) ORDER BY pb.created_at
        )
        FROM public.placed_bets pb
        LEFT JOIN public.bets b ON b.id = pb.bet_id
        WHERE pb.coupon_id = c.id
      ) AS legs,
      NULL::TEXT AS casino_bet_type,
      NULL::TEXT AS casino_bet_value,
      NULL::NUMERIC AS casino_stake,
      NULL::NUMERIC AS casino_payout,
      NULL::INTEGER AS casino_round_number,
      NULL::INTEGER AS casino_winning_number,
      NULL::TEXT AS casino_winning_color,
      c.created_at
    FROM public.coupons c
    JOIN public.profiles pr ON pr.id = c.user_id

    UNION ALL

    SELECT
      cs.id,
      'casino'::TEXT AS item_type,
      cs.user_id,
      pr.username,
      pr.avatar_url,
      cs.content,
      NULL::NUMERIC AS total_odds,
      cs.casino_stake AS stake,
      cs.casino_payout AS payout,
      'won'::TEXT AS status,
      NULL::JSON AS legs,
      cs.casino_bet_type,
      cs.casino_bet_value,
      cs.casino_stake,
      cs.casino_payout,
      cs.casino_round_number,
      cs.casino_winning_number,
      cs.casino_winning_color,
      cs.created_at
    FROM public.casino_social_shares cs
    JOIN public.profiles pr ON pr.id = cs.user_id
  ),
  ordered_feed AS (
    SELECT * FROM feed_items
    ORDER BY created_at DESC
    LIMIT GREATEST(COALESCE(p_limit, 30), 1)
    OFFSET GREATEST(COALESCE(p_offset, 0), 0)
  ),
  with_counts AS (
    SELECT
      f.*,
      (
        SELECT json_object_agg(r.emoji, r.cnt)
        FROM (
          SELECT sr.emoji::TEXT, COUNT(*) AS cnt
          FROM public.social_reactions sr
          WHERE (f.item_type = 'post' AND sr.post_id = f.id)
             OR (f.item_type = 'coupon' AND sr.coupon_id = f.id)
             OR (f.item_type = 'casino' AND sr.casino_share_id = f.id)
          GROUP BY sr.emoji
        ) r
      ) AS reactions,
      (
        SELECT COUNT(*)
        FROM public.social_comments sc
        WHERE (f.item_type = 'post' AND sc.post_id = f.id)
           OR (f.item_type = 'coupon' AND sc.coupon_id = f.id)
           OR (f.item_type = 'casino' AND sc.casino_share_id = f.id)
      ) AS comment_count,
      (
        SELECT sr.emoji::TEXT
        FROM public.social_reactions sr
        WHERE sr.user_id = p_user_id
          AND ((f.item_type = 'post' AND sr.post_id = f.id)
            OR (f.item_type = 'coupon' AND sr.coupon_id = f.id)
            OR (f.item_type = 'casino' AND sr.casino_share_id = f.id))
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
  IF p_item_type NOT IN ('post', 'coupon', 'casino') THEN
    RAISE EXCEPTION 'Nieprawidłowy typ elementu social';
  END IF;

  WITH item_data AS (
    SELECT
      sp.id,
      'post'::TEXT AS item_type,
      sp.user_id,
      pr.username,
      pr.avatar_url,
      sp.content,
      NULL::NUMERIC AS total_odds,
      NULL::NUMERIC AS stake,
      NULL::NUMERIC AS payout,
      NULL::TEXT AS status,
      NULL::JSON AS legs,
      NULL::TEXT AS casino_bet_type,
      NULL::TEXT AS casino_bet_value,
      NULL::NUMERIC AS casino_stake,
      NULL::NUMERIC AS casino_payout,
      NULL::INTEGER AS casino_round_number,
      NULL::INTEGER AS casino_winning_number,
      NULL::TEXT AS casino_winning_color,
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
      pr.avatar_url,
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
          ) ORDER BY pb.created_at
        )
        FROM public.placed_bets pb
        LEFT JOIN public.bets b ON b.id = pb.bet_id
        WHERE pb.coupon_id = c.id
      ) AS legs,
      NULL::TEXT AS casino_bet_type,
      NULL::TEXT AS casino_bet_value,
      NULL::NUMERIC AS casino_stake,
      NULL::NUMERIC AS casino_payout,
      NULL::INTEGER AS casino_round_number,
      NULL::INTEGER AS casino_winning_number,
      NULL::TEXT AS casino_winning_color,
      c.created_at
    FROM public.coupons c
    JOIN public.profiles pr ON pr.id = c.user_id
    WHERE p_item_type = 'coupon'
      AND c.id = p_item_id

    UNION ALL

    SELECT
      cs.id,
      'casino'::TEXT AS item_type,
      cs.user_id,
      pr.username,
      pr.avatar_url,
      cs.content,
      NULL::NUMERIC AS total_odds,
      cs.casino_stake AS stake,
      cs.casino_payout AS payout,
      'won'::TEXT AS status,
      NULL::JSON AS legs,
      cs.casino_bet_type,
      cs.casino_bet_value,
      cs.casino_stake,
      cs.casino_payout,
      cs.casino_round_number,
      cs.casino_winning_number,
      cs.casino_winning_color,
      cs.created_at
    FROM public.casino_social_shares cs
    JOIN public.profiles pr ON pr.id = cs.user_id
    WHERE p_item_type = 'casino'
      AND cs.id = p_item_id
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
             OR (i.item_type = 'casino' AND sr.casino_share_id = i.id)
          GROUP BY sr.emoji
        ) r
      ) AS reactions,
      (
        SELECT COUNT(*)
        FROM public.social_comments sc
        WHERE (i.item_type = 'post' AND sc.post_id = i.id)
           OR (i.item_type = 'coupon' AND sc.coupon_id = i.id)
           OR (i.item_type = 'casino' AND sc.casino_share_id = i.id)
      ) AS comment_count,
      (
        SELECT sr.emoji::TEXT
        FROM public.social_reactions sr
        WHERE sr.user_id = p_user_id
          AND ((i.item_type = 'post' AND sr.post_id = i.id)
            OR (i.item_type = 'coupon' AND sr.coupon_id = i.id)
            OR (i.item_type = 'casino' AND sr.casino_share_id = i.id))
        LIMIT 1
      ) AS my_reaction
    FROM item_data i
  )
  SELECT row_to_json(with_counts)
    INTO v_result
  FROM with_counts
  LIMIT 1;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_comments_for_target(
  p_post_id UUID DEFAULT NULL,
  p_coupon_id UUID DEFAULT NULL,
  p_casino_share_id UUID DEFAULT NULL,
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
  IF (CASE WHEN p_post_id IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN p_coupon_id IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN p_casino_share_id IS NOT NULL THEN 1 ELSE 0 END) <> 1 THEN
    RAISE EXCEPTION 'Należy podać dokładnie jeden cel komentarzy';
  END IF;

  SELECT json_agg(row_to_json(c_row) ORDER BY c_row.created_at)
    INTO v_result
  FROM (
    SELECT
      sc.id,
      sc.user_id,
      pr.username,
      pr.avatar_url,
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
    WHERE (p_post_id IS NOT NULL AND sc.post_id = p_post_id)
       OR (p_coupon_id IS NOT NULL AND sc.coupon_id = p_coupon_id)
       OR (p_casino_share_id IS NOT NULL AND sc.casino_share_id = p_casino_share_id)
  ) c_row;

  RETURN COALESCE(v_result, '[]'::JSON);
END;
$$;

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

CREATE OR REPLACE FUNCTION public.get_reactors_for_target(
  p_post_id UUID DEFAULT NULL,
  p_coupon_id UUID DEFAULT NULL,
  p_casino_share_id UUID DEFAULT NULL,
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
      CASE WHEN p_casino_share_id IS NOT NULL THEN 1 ELSE 0 END +
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
      OR (p_casino_share_id IS NOT NULL AND sr.casino_share_id = p_casino_share_id)
      OR (p_comment_id IS NOT NULL AND sr.comment_id = p_comment_id)
    )
    AND (p_emoji IS NULL OR sr.emoji = p_emoji)
  ) r;

  RETURN COALESCE(v_result, '[]'::JSON);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_casino_social_share(UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, INTEGER, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_casino_social_share(UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, INTEGER, INTEGER, TEXT) TO authenticated;
