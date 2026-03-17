-- Migration: include profile avatar in social feed payloads

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
    SELECT
      sp.id,
      'post' AS item_type,
      sp.user_id,
      pr.username,
      pr.avatar_url,
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

    SELECT
      c.id,
      'coupon' AS item_type,
      c.user_id,
      pr.username,
      pr.avatar_url,
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
      pr.avatar_url,
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
