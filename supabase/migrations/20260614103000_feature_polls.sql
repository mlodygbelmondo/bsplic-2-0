CREATE TABLE public.feature_polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  allow_other BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT feature_polls_question_not_blank CHECK (btrim(question) <> ''),
  CONSTRAINT feature_polls_expires_after_start CHECK (expires_at > starts_at)
);

CREATE TABLE public.feature_poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES public.feature_polls(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT feature_poll_options_label_not_blank CHECK (btrim(label) <> ''),
  CONSTRAINT feature_poll_options_unique_order UNIQUE (poll_id, sort_order)
);

CREATE TABLE public.feature_poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES public.feature_polls(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  option_id UUID REFERENCES public.feature_poll_options(id) ON DELETE RESTRICT,
  other_text TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT feature_poll_votes_unique_user_poll UNIQUE (poll_id, user_id),
  CONSTRAINT feature_poll_votes_choice_required CHECK (
    (option_id IS NOT NULL AND other_text IS NULL)
    OR (option_id IS NULL AND btrim(COALESCE(other_text, '')) <> '')
  )
);

CREATE UNIQUE INDEX feature_polls_single_active_window_idx
  ON public.feature_polls ((is_active))
  WHERE is_active = TRUE;

CREATE INDEX feature_polls_active_window_idx
  ON public.feature_polls (is_active, starts_at, expires_at);

CREATE INDEX feature_poll_options_poll_id_idx
  ON public.feature_poll_options (poll_id, sort_order);

CREATE INDEX feature_poll_votes_poll_id_idx
  ON public.feature_poll_votes (poll_id);

CREATE INDEX feature_poll_votes_option_id_idx
  ON public.feature_poll_votes (option_id);

ALTER TABLE public.feature_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage feature polls"
  ON public.feature_polls
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage feature poll options"
  ON public.feature_poll_options
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users insert own feature poll votes"
  ON public.feature_poll_votes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view feature poll votes"
  ON public.feature_poll_votes
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.get_available_feature_poll()
RETURNS TABLE (
  id UUID,
  question TEXT,
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
    poll.question,
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
    AND NOW() >= poll.starts_at
    AND NOW() < poll.expires_at
    AND NOT EXISTS (
      SELECT 1
      FROM public.feature_poll_votes AS vote
      WHERE vote.poll_id = poll.id
        AND vote.user_id = v_user_id
    )
  GROUP BY poll.id
  ORDER BY poll.starts_at ASC, poll.created_at ASC
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

  IF NOW() < v_poll.starts_at THEN
    RAISE EXCEPTION 'Głosowanie jeszcze się nie rozpoczęło';
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

CREATE OR REPLACE FUNCTION public.admin_get_feature_polls()
RETURNS TABLE (
  id UUID,
  question TEXT,
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
    poll.question,
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
