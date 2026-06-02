-- Make earned badges publicly readable while keeping badge writes server-controlled.

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Badges viewable by everyone" ON public.badges;
DROP POLICY IF EXISTS "Public badges are readable" ON public.badges;

CREATE POLICY "Public badges are readable"
ON public.badges
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = badges.user_id
  )
);

GRANT SELECT ON TABLE public.badges TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.badges FROM anon, authenticated;
