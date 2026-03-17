-- Migration: profile avatar support

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'profile-avatars',
  'profile-avatars',
  TRUE,
  300000,
  ARRAY['image/jpeg']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read profile avatars" ON storage.objects;
CREATE POLICY "Public read profile avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-avatars');

DROP POLICY IF EXISTS "Users upload own profile avatar" ON storage.objects;
CREATE POLICY "Users upload own profile avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'profile-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users delete own profile avatar" ON storage.objects;
CREATE POLICY "Users delete own profile avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'profile-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE OR REPLACE FUNCTION public.get_public_profile(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  WITH coupon_units AS (
    SELECT
      c.id AS coupon_id,
      c.user_id,
      CASE
        WHEN COUNT(*) FILTER (WHERE pb.result = 'lost') > 0 THEN 'lost'
        WHEN COUNT(*) > 0
          AND COUNT(*) FILTER (WHERE pb.result IN ('won', 'lost')) = COUNT(*)
          THEN 'won'
        ELSE 'pending'
      END AS unit_result
    FROM public.coupons c
    JOIN public.placed_bets pb ON pb.coupon_id = c.id
    WHERE c.total_odds > 1
      AND c.user_id = p_user_id
    GROUP BY c.id, c.user_id
  ),
  ranking_units AS (
    SELECT cu.unit_result FROM coupon_units cu
    UNION ALL
    SELECT pb.result AS unit_result
    FROM public.placed_bets pb
    LEFT JOIN public.coupons c ON c.id = pb.coupon_id
    WHERE pb.user_id = p_user_id
      AND (pb.coupon_id IS NULL OR COALESCE(c.total_odds, 1) <= 1)
  ),
  ranking_stats AS (
    SELECT
      COUNT(*)                                              AS total_bets,
      COUNT(*) FILTER (WHERE unit_result = 'won')           AS won_bets,
      COUNT(*) FILTER (WHERE unit_result = 'lost')          AS lost_bets,
      COUNT(*) FILTER (WHERE unit_result IN ('won', 'lost')) AS resolved_bets
    FROM ranking_units
  ),
  coupon_profit AS (
    SELECT
      ROUND(
        SUM(
          CASE
            WHEN cu.unit_result = 'won'
              THEN COALESCE(NULLIF(c.payout, 0), ROUND(c.stake * c.total_odds, 2)) - c.stake
            WHEN cu.unit_result = 'lost' THEN -c.stake
            ELSE 0
          END
        ),
        2
      ) AS total_profit
    FROM coupon_units cu
    JOIN public.coupons c ON c.id = cu.coupon_id
  ),
  single_profit AS (
    SELECT
      ROUND(
        SUM(
          CASE
            WHEN pb.result = 'won' THEN COALESCE(pb.payout, 0) - pb.stake
            WHEN pb.result = 'lost' THEN -pb.stake
            ELSE 0
          END
        ),
        2
      ) AS total_profit
    FROM public.placed_bets pb
    LEFT JOIN public.coupons c ON c.id = pb.coupon_id
    WHERE pb.user_id = p_user_id
      AND (pb.coupon_id IS NULL OR COALESCE(c.total_odds, 1) <= 1)
  ),
  profit_stats AS (
    SELECT ROUND(
      COALESCE((SELECT total_profit FROM coupon_profit), 0)
      + COALESCE((SELECT total_profit FROM single_profit), 0),
      2
    ) AS total_profit
  )
  SELECT row_to_json(t) INTO v_result
  FROM (
    SELECT
      p.id,
      p.username,
      p.avatar_url,
      p.current_streak,
      p.longest_streak,
      p.created_at,
      COALESCE(rs.total_bets, 0) AS total_bets,
      COALESCE(rs.won_bets, 0) AS won_bets,
      COALESCE(rs.lost_bets, 0) AS lost_bets,
      CASE
        WHEN COALESCE(rs.resolved_bets, 0) > 0
        THEN ROUND((COALESCE(rs.won_bets, 0)::NUMERIC / rs.resolved_bets) * 100, 1)
        ELSE 0
      END AS win_rate,
      COALESCE(ps.total_profit, 0) AS total_profit
    FROM public.profiles p
    CROSS JOIN ranking_stats rs
    CROSS JOIN profit_stats ps
    WHERE p.id = p_user_id
  ) t;

  RETURN COALESCE(v_result, '{}'::JSON);
END;
$$;
