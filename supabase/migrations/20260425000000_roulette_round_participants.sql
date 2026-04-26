DROP FUNCTION IF EXISTS public.get_roulette_round_participants(UUID);

CREATE OR REPLACE FUNCTION public.get_roulette_round_participants(p_round_id UUID)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  avatar_url TEXT,
  total_stake NUMERIC,
  bet_count BIGINT,
  bets JSONB
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.user_id,
    p.username,
    p.avatar_url,
    COALESCE(SUM(b.stake), 0) AS total_stake,
    COUNT(*) AS bet_count,
    jsonb_agg(
      jsonb_build_object(
        'bet_type', b.bet_type,
        'bet_value', b.bet_value,
        'stake', b.stake
      )
      ORDER BY b.created_at ASC
    ) AS bets
  FROM public.casino_roulette_bets AS b
  JOIN public.casino_roulette_rounds AS r ON r.id = b.round_id
  JOIN public.profiles AS p ON p.id = b.user_id
  WHERE auth.uid() IS NOT NULL
    AND r.id = p_round_id
  GROUP BY b.user_id, p.username, p.avatar_url
  ORDER BY total_stake DESC, bet_count DESC, p.username ASC;
$$;

REVOKE EXECUTE ON FUNCTION public.get_roulette_round_participants(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_roulette_round_participants(UUID) TO authenticated;
