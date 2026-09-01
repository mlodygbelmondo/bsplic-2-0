-- Make the unattended settlement scan pageable and enforce same-event AKO
-- exclusions even when correlated markets are created in separate calls.

DROP FUNCTION IF EXISTS public.agent_get_pending_settlement_context(TEXT, INTEGER);

CREATE OR REPLACE FUNCTION public.agent_get_pending_settlement_context(
  p_token TEXT,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_limit INTEGER;
  v_offset INTEGER;
  v_bets JSONB;
  v_fetched INTEGER;
BEGIN
  PERFORM private.require_agent_scope(p_token, 'read:settlement');

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  v_offset := GREATEST(COALESCE(p_offset, 0), 0);

  WITH settlement_scope AS (
    SELECT
      b.id,
      b.title,
      b.category_id,
      b.options,
      b.ends_at,
      b.winning_option,
      b.event_key,
      b.agent_metadata,
      COUNT(pb.id) AS placed_bet_count,
      COUNT(pb.id) FILTER (WHERE pb.result = 'pending') AS pending_leg_count,
      MAX(pb.created_at) FILTER (WHERE pb.result = 'pending') AS newest_pending_placed_at,
      COUNT(c.id) FILTER (WHERE c.status = 'pending') AS pending_coupon_count
    FROM public.bets b
    LEFT JOIN public.placed_bets pb ON pb.bet_id = b.id
    LEFT JOIN public.coupons c ON c.id = pb.coupon_id
    GROUP BY b.id, b.title, b.category_id, b.options, b.ends_at, b.winning_option,
             b.event_key, b.agent_metadata
    HAVING COUNT(pb.id) FILTER (WHERE pb.result = 'pending') > 0
       OR COUNT(c.id) FILTER (WHERE c.status = 'pending') > 0
       OR (b.winning_option IS NULL AND b.ends_at <= NOW())
  ), page AS (
    SELECT *
    FROM settlement_scope s
    ORDER BY
      (s.ends_at <= NOW()) DESC,
      s.newest_pending_placed_at DESC NULLS LAST,
      s.ends_at DESC,
      s.id
    LIMIT v_limit + 1
    OFFSET v_offset
  ), numbered AS (
    SELECT page.*, ROW_NUMBER() OVER (
      ORDER BY
        (page.ends_at <= NOW()) DESC,
        page.newest_pending_placed_at DESC NULLS LAST,
        page.ends_at DESC,
        page.id
    ) AS page_row
    FROM page
  )
  SELECT
    COALESCE(
      jsonb_agg(
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
          'event_key', s.event_key,
          'odds_source', COALESCE(s.agent_metadata -> 'odds_source', 'null'::JSONB),
          'settlement_hold', COALESCE(s.agent_metadata -> 'settlement_hold', 'null'::JSONB),
          'placed_bet_count', s.placed_bet_count,
          'pending_leg_count', s.pending_leg_count,
          'pending_coupon_count', s.pending_coupon_count,
          'ended', s.ends_at <= NOW(),
          'newest_pending_placed_at', s.newest_pending_placed_at
        )
        ORDER BY s.page_row
      ) FILTER (WHERE s.page_row <= v_limit),
      '[]'::JSONB
    ),
    COUNT(*)
  INTO v_bets, v_fetched
  FROM numbered s;

  RETURN jsonb_build_object(
    'bets', v_bets,
    'offset', v_offset,
    'next_offset', v_offset + LEAST(v_fetched, v_limit),
    'has_more', v_fetched > v_limit
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.agent_get_pending_settlement_context(TEXT, INTEGER, INTEGER)
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agent_get_pending_settlement_context(TEXT, INTEGER, INTEGER)
TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.ensure_same_event_ako_exclusions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NEW.is_active IS NOT TRUE OR NULLIF(BTRIM(NEW.event_key), '') IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.bet_ako_exclusions (bet_id_a, bet_id_b, reason, created_by)
  SELECT
    LEAST(NEW.id, other.id),
    GREATEST(NEW.id, other.id),
    'ten sam event_key',
    NULL
  FROM public.bets other
  WHERE other.id <> NEW.id
    AND other.is_active = true
    AND other.event_key = NEW.event_key
  ON CONFLICT (LEAST(bet_id_a, bet_id_b), GREATEST(bet_id_a, bet_id_b))
  DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.ensure_same_event_ako_exclusions() FROM PUBLIC;

DROP TRIGGER IF EXISTS ensure_same_event_ako_exclusions ON public.bets;
CREATE TRIGGER ensure_same_event_ako_exclusions
AFTER INSERT OR UPDATE OF event_key, is_active ON public.bets
FOR EACH ROW
EXECUTE FUNCTION private.ensure_same_event_ako_exclusions();

INSERT INTO public.bet_ako_exclusions (bet_id_a, bet_id_b, reason, created_by)
SELECT LEAST(a.id, b.id), GREATEST(a.id, b.id), 'ten sam event_key', NULL
FROM public.bets a
JOIN public.bets b ON b.event_key = a.event_key AND b.id > a.id
WHERE a.is_active = true
  AND b.is_active = true
  AND NULLIF(BTRIM(a.event_key), '') IS NOT NULL
ON CONFLICT (LEAST(bet_id_a, bet_id_b), GREATEST(bet_id_a, bet_id_b))
DO NOTHING;
