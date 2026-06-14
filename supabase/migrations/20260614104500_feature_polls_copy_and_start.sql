ALTER TABLE public.feature_polls
  ADD COLUMN title TEXT NOT NULL DEFAULT 'Głosowanie',
  ADD COLUMN title_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN description TEXT NOT NULL DEFAULT 'Odpowiedz na jedno pytanie, żeby kontynuować.',
  ADD COLUMN description_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN question_enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.feature_polls
  ALTER COLUMN starts_at DROP NOT NULL;

ALTER TABLE public.feature_polls
  DROP CONSTRAINT IF EXISTS feature_polls_expires_after_start;

ALTER TABLE public.feature_polls
  ADD CONSTRAINT feature_polls_expires_after_start CHECK (
    starts_at IS NULL OR expires_at > starts_at
  ),
  ADD CONSTRAINT feature_polls_title_required_when_enabled CHECK (
    title_enabled IS NOT TRUE OR btrim(title) <> ''
  ),
  ADD CONSTRAINT feature_polls_description_required_when_enabled CHECK (
    description_enabled IS NOT TRUE OR btrim(description) <> ''
  );

DROP INDEX IF EXISTS public.feature_polls_active_window_idx;

CREATE INDEX feature_polls_active_window_idx
  ON public.feature_polls (is_active, expires_at);

DROP FUNCTION IF EXISTS public.get_available_feature_poll();

CREATE OR REPLACE FUNCTION public.get_available_feature_poll()
RETURNS TABLE (
  id UUID,
  title TEXT,
  title_enabled BOOLEAN,
  description TEXT,
  description_enabled BOOLEAN,
  question TEXT,
  question_enabled BOOLEAN,
  allow_other BOOLEAN,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  options JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Musisz być zalogowany';
  END IF;

  RETURN QUERY
  SELECT
    poll.id,
    poll.title,
    poll.title_enabled,
    poll.description,
    poll.description_enabled,
    poll.question,
    poll.question_enabled,
    poll.allow_other,
    poll.starts_at,
    poll.expires_at,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', option_row.id,
          'label', option_row.label,
          'sort_order', option_row.sort_order
        )
        ORDER BY option_row.sort_order ASC, option_row.created_at ASC
      ) FILTER (WHERE option_row.id IS NOT NULL),
      '[]'::jsonb
    ) AS options
  FROM public.feature_polls AS poll
  LEFT JOIN public.feature_poll_options AS option_row
    ON option_row.poll_id = poll.id
  WHERE poll.is_active = TRUE
    AND NOW() < poll.expires_at
    AND NOT EXISTS (
      SELECT 1
      FROM public.feature_poll_votes AS vote
      WHERE vote.poll_id = poll.id
        AND vote.user_id = v_user_id
    )
  GROUP BY poll.id
  ORDER BY poll.created_at ASC
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_feature_poll_vote(
  p_poll_id UUID,
  p_option_id UUID DEFAULT NULL,
  p_other_text TEXT DEFAULT NULL
)
RETURNS TABLE (
  poll_id UUID,
  submitted_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_poll public.feature_polls%ROWTYPE;
  v_other_text TEXT := NULLIF(btrim(COALESCE(p_other_text, '')), '');
  v_submitted_at TIMESTAMPTZ := NOW();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Musisz być zalogowany';
  END IF;

  IF p_poll_id IS NULL THEN
    RAISE EXCEPTION 'Nieprawidłowe głosowanie';
  END IF;

  SELECT poll.*
    INTO v_poll
    FROM public.feature_polls AS poll
   WHERE poll.id = p_poll_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono głosowania';
  END IF;

  IF v_poll.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Głosowanie nie jest aktywne';
  END IF;

  IF NOW() >= v_poll.expires_at THEN
    RAISE EXCEPTION 'Głosowanie zakończone';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.feature_poll_votes AS vote
    WHERE vote.poll_id = p_poll_id
      AND vote.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Głos został już oddany';
  END IF;

  IF p_option_id IS NOT NULL THEN
    PERFORM 1
      FROM public.feature_poll_options AS option_row
     WHERE option_row.id = p_option_id
       AND option_row.poll_id = p_poll_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Nieprawidłowa opcja odpowiedzi';
    END IF;

    v_other_text := NULL;
  ELSE
    IF v_poll.allow_other IS NOT TRUE THEN
      RAISE EXCEPTION 'Własna odpowiedź nie jest dostępna';
    END IF;

    IF v_other_text IS NULL THEN
      RAISE EXCEPTION 'Wpisz swoją propozycję';
    END IF;
  END IF;

  INSERT INTO public.feature_poll_votes (
    poll_id,
    user_id,
    option_id,
    other_text,
    submitted_at
  )
  VALUES (
    p_poll_id,
    v_user_id,
    p_option_id,
    v_other_text,
    v_submitted_at
  );

  RETURN QUERY
  SELECT p_poll_id, v_submitted_at;
END;
$$;

DROP FUNCTION IF EXISTS public.admin_get_feature_polls();

CREATE OR REPLACE FUNCTION public.admin_get_feature_polls()
RETURNS TABLE (
  id UUID,
  title TEXT,
  title_enabled BOOLEAN,
  description TEXT,
  description_enabled BOOLEAN,
  question TEXT,
  question_enabled BOOLEAN,
  allow_other BOOLEAN,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  total_votes BIGINT,
  options JSONB,
  other_responses JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Brak uprawnień administratora';
  END IF;

  RETURN QUERY
  SELECT
    poll.id,
    poll.title,
    poll.title_enabled,
    poll.description,
    poll.description_enabled,
    poll.question,
    poll.question_enabled,
    poll.allow_other,
    poll.starts_at,
    poll.expires_at,
    poll.is_active,
    poll.created_at,
    poll.updated_at,
    COUNT(vote.id) AS total_votes,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', option_row.id,
            'label', option_row.label,
            'sort_order', option_row.sort_order,
            'vote_count', (
              SELECT COUNT(*)
              FROM public.feature_poll_votes AS option_vote
              WHERE option_vote.option_id = option_row.id
            )
          )
          ORDER BY option_row.sort_order ASC, option_row.created_at ASC
        )
        FROM public.feature_poll_options AS option_row
        WHERE option_row.poll_id = poll.id
      ),
      '[]'::jsonb
    ) AS options,
    COALESCE(
      jsonb_agg(vote.other_text ORDER BY vote.submitted_at ASC)
        FILTER (WHERE vote.other_text IS NOT NULL),
      '[]'::jsonb
    ) AS other_responses
  FROM public.feature_polls AS poll
  LEFT JOIN public.feature_poll_votes AS vote
    ON vote.poll_id = poll.id
  GROUP BY poll.id
  ORDER BY poll.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_available_feature_poll() TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_feature_poll_vote(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_feature_polls() TO authenticated;
