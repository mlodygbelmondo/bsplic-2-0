-- Include ended, unresolved markets in agent settlement context even when
-- nobody placed a bet. These markets still need winning_option/is_active
-- updates so they disappear from the public board and stay correct in history.

CREATE OR REPLACE FUNCTION public.agent_get_pending_settlement_context(
  p_token TEXT,
  p_limit INTEGER DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_limit INTEGER;
BEGIN
  PERFORM private.require_agent_scope(p_token, 'read:settlement');

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);

  RETURN jsonb_build_object(
    'bets', COALESCE(
      (
        WITH settlement_scope AS (
          SELECT
            b.id,
            b.title,
            b.category_id,
            b.options,
            b.ends_at,
            b.winning_option,
            COUNT(pb.id) AS placed_bet_count,
            COUNT(pb.id) FILTER (WHERE pb.result = 'pending') AS pending_leg_count,
            MAX(pb.created_at) FILTER (WHERE pb.result = 'pending') AS newest_pending_placed_at,
            COUNT(c.id) FILTER (
              WHERE c.status = 'pending'
            ) AS pending_coupon_count
          FROM public.bets b
          LEFT JOIN public.placed_bets pb ON pb.bet_id = b.id
          LEFT JOIN public.coupons c ON c.id = pb.coupon_id
          GROUP BY b.id, b.title, b.category_id, b.options, b.ends_at, b.winning_option
          HAVING COUNT(pb.id) FILTER (WHERE pb.result = 'pending') > 0
             OR COUNT(c.id) FILTER (WHERE c.status = 'pending') > 0
             OR (
               b.winning_option IS NULL
               AND b.ends_at <= NOW()
             )
        )
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'title', s.title,
            'category', (
              SELECT jsonb_build_object(
                'id', c.id,
                'name', c.name,
                'emoji', c.emoji,
                'color', c.color,
                'sort_order', c.sort_order
              )
              FROM public.categories c
              WHERE c.id = s.category_id
            ),
            'options', s.options,
            'ends_at', s.ends_at,
            'winning_option', s.winning_option,
            'placed_bet_count', s.placed_bet_count,
            'pending_leg_count', s.pending_leg_count,
            'pending_coupon_count', s.pending_coupon_count,
            'ended', s.ends_at <= NOW(),
            'newest_pending_placed_at', s.newest_pending_placed_at
          )
          ORDER BY
            (s.ends_at <= NOW()) DESC,
            s.newest_pending_placed_at DESC NULLS LAST,
            s.ends_at DESC
        )
        FROM (
          SELECT *
          FROM settlement_scope s
          ORDER BY
            (s.ends_at <= NOW()) DESC,
            s.newest_pending_placed_at DESC NULLS LAST,
            s.ends_at DESC
          LIMIT v_limit
        ) s
      ),
      '[]'::jsonb
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.agent_get_pending_settlement_context(TEXT, INTEGER)
TO anon, authenticated, service_role;
