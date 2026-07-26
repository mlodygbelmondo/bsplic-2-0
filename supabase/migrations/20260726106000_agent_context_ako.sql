-- Give the agent everything it needs to reason about correlation without
-- re-deriving it every run: event grouping, provenance, and the AKO exclusion
-- pairs that already exist between active markets.

CREATE OR REPLACE FUNCTION public.agent_get_bet_context(
  p_token TEXT,
  p_recent_bet_limit INTEGER DEFAULT 10,
  p_history_limit INTEGER DEFAULT 200
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_recent_bet_limit INTEGER;
  v_history_limit INTEGER;
BEGIN
  PERFORM private.require_agent_scope(p_token, 'read:bets');

  v_recent_bet_limit := LEAST(GREATEST(COALESCE(p_recent_bet_limit, 10), 1), 50);
  v_history_limit := LEAST(GREATEST(COALESCE(p_history_limit, 200), 1), 500);

  RETURN jsonb_build_object(
    'schema', jsonb_build_object(
      'betTypes', jsonb_build_array('single', '12', '1x2', 'multi'),
      'proposalSources', jsonb_build_array('human', 'agent')
    ),
    'categories', COALESCE(
      (
        SELECT jsonb_agg(to_jsonb(c) ORDER BY c.sort_order)
        FROM public.categories c
      ),
      '[]'::JSONB
    ),
    'recentBets', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', b.id,
            'title', b.title,
            'category_id', b.category_id,
            'bet_type', b.bet_type,
            'options', b.options,
            'ends_at', b.ends_at,
            'is_active', b.is_active,
            'created_at', b.created_at,
            'event_key', b.event_key,
            'agent_duplicate_key', b.agent_duplicate_key
          )
          ORDER BY b.created_at DESC
        )
        FROM (
          SELECT id, title, category_id, bet_type, options, ends_at, is_active,
                 created_at, event_key, agent_duplicate_key
          FROM public.bets
          ORDER BY created_at DESC
          LIMIT v_recent_bet_limit
        ) b
      ),
      '[]'::JSONB
    ),
    'historicalBets', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', b.id,
            'title', b.title,
            'category_id', b.category_id,
            'bet_type', b.bet_type,
            'options', b.options,
            'ends_at', b.ends_at,
            'is_active', b.is_active,
            'is_bsplicboost', b.is_bsplicboost,
            'created_at', b.created_at,
            'winning_option', b.winning_option,
            'bet_count', b.bet_count,
            'event_key', b.event_key
          )
          ORDER BY b.created_at DESC
        )
        FROM (
          SELECT id, title, category_id, bet_type, options, ends_at, is_active,
                 is_bsplicboost, created_at, winning_option, bet_count, event_key
          FROM public.bets
          WHERE is_active = false
          ORDER BY created_at DESC
          LIMIT v_history_limit
        ) b
      ),
      '[]'::JSONB
    ),
    'activeBets', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', b.id,
            'title', b.title,
            'category_id', b.category_id,
            'bet_type', b.bet_type,
            'options', b.options,
            'ends_at', b.ends_at,
            'is_active', b.is_active,
            'created_at', b.created_at,
            'event_key', b.event_key,
            'agent_duplicate_key', b.agent_duplicate_key,
            'odds_source', COALESCE(b.agent_metadata -> 'odds_source', 'null'::JSONB)
          )
          ORDER BY b.created_at DESC
        )
        FROM public.bets b
        WHERE b.is_active = true
      ),
      '[]'::JSONB
    ),
    -- Pairs already blocked between currently active markets. Without this the
    -- agent cannot tell whether a correlated pair is handled and would re-derive
    -- correlation on every run.
    'akoExclusions', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'bet_id_a', e.bet_id_a,
            'bet_id_b', e.bet_id_b,
            'title_a', ba.title,
            'title_b', bb.title,
            'reason', e.reason
          )
          ORDER BY ba.title, bb.title
        )
        FROM public.bet_ako_exclusions e
        JOIN public.bets ba ON ba.id = e.bet_id_a
        JOIN public.bets bb ON bb.id = e.bet_id_b
        WHERE ba.is_active = true
          AND bb.is_active = true
      ),
      '[]'::JSONB
    ),
    'pendingProposals', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'title', p.title,
            'category_id', p.category_id,
            'bet_type', p.bet_type,
            'options', p.options,
            'ends_at', p.ends_at,
            'status', p.status,
            'proposal_source', COALESCE(p.proposal_source, 'human'),
            'agent_metadata', COALESCE(p.agent_metadata, '{}'::JSONB),
            'agent_duplicate_key', p.agent_duplicate_key,
            'created_at', p.created_at
          )
          ORDER BY p.created_at DESC
        )
        FROM public.bet_proposals p
        WHERE p.status = 'pending'
      ),
      '[]'::JSONB
    ),
    'recentAcceptedProposals', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'title', p.title,
            'category_id', p.category_id,
            'bet_type', p.bet_type,
            'options', p.options,
            'ends_at', p.ends_at,
            'status', p.status,
            'proposal_source', COALESCE(p.proposal_source, 'human'),
            'agent_metadata', COALESCE(p.agent_metadata, '{}'::JSONB),
            'agent_duplicate_key', p.agent_duplicate_key,
            'created_at', p.created_at
          )
          ORDER BY p.created_at DESC
        )
        FROM (
          SELECT id, title, category_id, bet_type, options, ends_at, status,
                 proposal_source, agent_metadata, agent_duplicate_key, created_at
          FROM public.bet_proposals
          WHERE status = 'accepted'
          ORDER BY created_at DESC
          LIMIT v_history_limit
        ) p
      ),
      '[]'::JSONB
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.agent_get_bet_context(TEXT, INTEGER, INTEGER)
TO anon, authenticated, service_role;
