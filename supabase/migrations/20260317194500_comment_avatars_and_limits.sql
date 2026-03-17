-- Migration: comment avatars in payload + tighter storage limits

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
      WHERE (p_post_id   IS NOT NULL AND sc.post_id   = p_post_id)
         OR (p_coupon_id IS NOT NULL AND sc.coupon_id  = p_coupon_id)
    ) c_row;

  RETURN COALESCE(v_result, '[]'::JSON);
END;
$$;

UPDATE storage.buckets
SET file_size_limit = 90000
WHERE id = 'social-images';

UPDATE storage.buckets
SET file_size_limit = 140000
WHERE id = 'profile-avatars';
