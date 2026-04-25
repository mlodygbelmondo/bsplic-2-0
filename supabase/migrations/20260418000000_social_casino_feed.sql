-- Migration: Add casino shares to social feed
-- Created: 2026-04-18

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
      NULL::TEXT    AS casino_bet_type,
      NULL::TEXT    AS casino_bet_value,
      NULL::NUMERIC AS casino_stake,
      NULL::NUMERIC AS casino_payout,
      NULL::BIGINT  AS casino_round_number,
      NULL::INTEGER AS casino_winning_number,
      NULL::TEXT    AS casino_winning_color,
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
      NULL::TEXT    AS casino_bet_type,
      NULL::TEXT    AS casino_bet_value,
      NULL::NUMERIC AS casino_stake,
      NULL::NUMERIC AS casino_payout,
      NULL::BIGINT  AS casino_round_number,
      NULL::INTEGER AS casino_winning_number,
      NULL::TEXT    AS casino_winning_color,
      c.created_at
    FROM public.coupons c
    JOIN public.profiles pr ON pr.id = c.user_id

    UNION ALL

    -- Roulette Rounds
    SELECT
      cb.id,
      'casino' AS item_type,
      cb.user_id,
      pr.username,
      pr.avatar_url,
      NULL AS content,
      NULL::NUMERIC AS total_odds,
      cb.stake,
      cb.payout,
      'won' AS status,
      NULL::JSON AS legs,
      cb.bet_type AS casino_bet_type,
      cb.bet_value AS casino_bet_value,
      cb.stake AS casino_stake,
      cb.payout AS casino_payout,
      cr.round_number AS casino_round_number,
      cr.winning_number AS casino_winning_number,
      cr.winning_color AS casino_winning_color,
      cb.settled_at AS created_at
    FROM public.casino_roulette_bets cb
    JOIN public.casino_roulette_rounds cr ON cr.id = cb.round_id
    JOIN public.profiles pr ON pr.id = cb.user_id
    WHERE cb.is_win = true

    UNION ALL

    -- Single Player Casino Rounds
    SELECT
      cr.id,
      'casino' AS item_type,
      cr.user_id,
      pr.username,
      pr.avatar_url,
      NULL AS content,
      NULL::NUMERIC AS total_odds,
      cr.stake,
      cr.payout,
      'won' AS status,
      NULL::JSON AS legs,
      cr.bet_type AS casino_bet_type,
      cr.bet_value AS casino_bet_value,
      cr.stake AS casino_stake,
      cr.payout AS casino_payout,
      NULL::BIGINT AS casino_round_number,
      cr.winning_number AS casino_winning_number,
      cr.winning_color AS casino_winning_color,
      cr.created_at
    FROM public.casino_rounds cr
    JOIN public.profiles pr ON pr.id = cr.user_id
    WHERE cr.payout > 0
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
