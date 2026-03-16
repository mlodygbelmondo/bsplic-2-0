-- Add bet_id to coupon leg payload for profile/social RPCs.

CREATE OR REPLACE FUNCTION public.get_user_coupon_history(
  p_user_id UUID,
  p_limit   INTEGER DEFAULT 50,
  p_offset  INTEGER DEFAULT 0
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
  SELECT json_agg(row_to_json(c_row))
    INTO v_result
    FROM (
      SELECT
        c.id,
        c.total_odds,
        c.stake,
        c.payout,
        c.status,
        c.created_at,
        (
          SELECT json_agg(
                   json_build_object(
                     'id', pb.id,
                     'bet_id', pb.bet_id,
                     'selected_option', pb.selected_option,
                     'odds_at_time', pb.odds_at_time,
                     'leg_stake', pb.stake,
                     'leg_payout', pb.payout,
                     'result', pb.result,
                     'bet_title', b.title
                   )
                   ORDER BY pb.created_at
                 )
          FROM public.placed_bets pb
          LEFT JOIN public.bets b ON b.id = pb.bet_id
          WHERE pb.coupon_id = c.id
        ) AS legs
      FROM public.coupons c
      WHERE c.user_id = p_user_id
      ORDER BY c.created_at DESC
      LIMIT p_limit
      OFFSET p_offset
    ) c_row;

  RETURN COALESCE(v_result, '[]'::JSON);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_social_coupon_feed(
  p_limit   INTEGER DEFAULT 30,
  p_offset  INTEGER DEFAULT 0
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
  SELECT json_agg(row_to_json(c_row))
    INTO v_result
    FROM (
      SELECT
        c.id,
        c.user_id,
        p.username,
        c.total_odds,
        c.stake,
        c.payout,
        c.status,
        c.created_at,
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
        ) AS legs
      FROM public.coupons c
      JOIN public.profiles p ON p.id = c.user_id
      ORDER BY c.created_at DESC
      LIMIT p_limit
      OFFSET p_offset
    ) c_row;

  RETURN COALESCE(v_result, '[]'::JSON);
END;
$$;
