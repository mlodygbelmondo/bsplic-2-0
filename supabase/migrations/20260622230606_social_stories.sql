CREATE TABLE IF NOT EXISTS public.social_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  CONSTRAINT social_stories_content_check
    CHECK (char_length(trim(content)) BETWEEN 1 AND 700)
);

CREATE INDEX IF NOT EXISTS idx_social_stories_expires_created
  ON public.social_stories (expires_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_stories_user_created
  ON public.social_stories (user_id, created_at DESC);

ALTER TABLE public.social_stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active stories" ON public.social_stories;
CREATE POLICY "Anyone can view active stories"
  ON public.social_stories
  FOR SELECT
  TO anon, authenticated
  USING (expires_at > NOW());

DROP POLICY IF EXISTS "Users create own stories" ON public.social_stories;
CREATE POLICY "Users create own stories"
  ON public.social_stories
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND created_at >= NOW() - INTERVAL '1 minute'
    AND created_at <= NOW() + INTERVAL '1 minute'
    AND expires_at > NOW()
    AND expires_at <= NOW() + INTERVAL '24 hours' + INTERVAL '1 minute'
    AND expires_at <= created_at + INTERVAL '24 hours' + INTERVAL '1 minute'
  );

GRANT SELECT ON public.social_stories TO anon, authenticated;
GRANT INSERT ON public.social_stories TO authenticated;

CREATE OR REPLACE FUNCTION public.get_active_social_stories()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  username TEXT,
  avatar_url TEXT,
  content TEXT,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.user_id,
    p.username,
    p.avatar_url,
    s.content,
    s.created_at,
    s.expires_at
  FROM public.social_stories s
  JOIN public.profiles p ON p.id = s.user_id
  WHERE s.expires_at > NOW()
  ORDER BY s.created_at DESC
  LIMIT 60;
$$;

CREATE OR REPLACE FUNCTION public.create_social_story(
  p_user_id UUID,
  p_content TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_story_id UUID;
  v_content TEXT;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Brak dostępu do tworzenia relacji';
  END IF;

  v_content := trim(coalesce(p_content, ''));

  IF char_length(v_content) = 0 THEN
    RAISE EXCEPTION 'Relacja nie może być pusta';
  END IF;

  IF char_length(v_content) > 700 THEN
    RAISE EXCEPTION 'Relacja może mieć maksymalnie 700 znaków';
  END IF;

  INSERT INTO public.social_stories (user_id, content)
  VALUES (p_user_id, v_content)
  RETURNING id INTO v_story_id;

  RETURN v_story_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_active_social_stories() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_social_story(UUID, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_active_social_stories() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_social_story(UUID, TEXT) TO authenticated;
