-- Add proposal-only review capabilities for moderators.

CREATE POLICY "Moderators can view pending proposals"
ON public.bet_proposals
FOR SELECT
TO authenticated
USING (
  status = 'pending'
  AND public.has_role(auth.uid(), 'moderator')
);

CREATE OR REPLACE FUNCTION public.review_bet_proposal(
  p_proposal_id UUID,
  p_status TEXT,
  p_title TEXT DEFAULT NULL,
  p_category_id UUID DEFAULT NULL,
  p_bet_type TEXT DEFAULT NULL,
  p_options JSONB DEFAULT NULL,
  p_ends_at TIMESTAMPTZ DEFAULT NULL,
  p_is_bsplicboost BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposal public.bet_proposals%ROWTYPE;
  v_title TEXT;
  v_category_id UUID;
  v_bet_type TEXT;
  v_options JSONB;
  v_ends_at TIMESTAMPTZ;
  v_bet_id UUID;
  v_option_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions' USING ERRCODE = '42501';
  END IF;

  SELECT *
    INTO v_proposal
    FROM public.bet_proposals
   WHERE id = p_proposal_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposal not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_proposal.status <> 'pending' THEN
    RAISE EXCEPTION 'Proposal is already %', v_proposal.status
      USING ERRCODE = '23514';
  END IF;

  IF p_status = 'rejected' THEN
    UPDATE public.bet_proposals
       SET status = 'rejected'
     WHERE id = v_proposal.id;

    RETURN jsonb_build_object(
      'proposal_id', v_proposal.id,
      'status', 'rejected'
    );
  END IF;

  IF p_status <> 'accepted' THEN
    RAISE EXCEPTION 'Unsupported proposal review status: %', p_status
      USING ERRCODE = '22023';
  END IF;

  v_title := NULLIF(BTRIM(COALESCE(p_title, v_proposal.title)), '');
  v_category_id := COALESCE(p_category_id, v_proposal.category_id);
  v_bet_type := COALESCE(p_bet_type, v_proposal.bet_type);
  v_options := COALESCE(p_options, v_proposal.options);
  v_ends_at := COALESCE(p_ends_at, v_proposal.ends_at);

  IF v_title IS NULL THEN
    RAISE EXCEPTION 'Title is required' USING ERRCODE = '23514';
  END IF;

  IF v_bet_type NOT IN ('single', '12', '1x2', 'multi') THEN
    RAISE EXCEPTION 'Unsupported bet type: %', v_bet_type
      USING ERRCODE = '23514';
  END IF;

  IF jsonb_typeof(v_options) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Options must be a JSON array' USING ERRCODE = '23514';
  END IF;

  SELECT jsonb_array_length(v_options) INTO v_option_count;

  IF (
    (v_bet_type = 'single' AND v_option_count <> 1)
    OR (v_bet_type = '12' AND v_option_count <> 2)
    OR (v_bet_type = '1x2' AND v_option_count <> 3)
    OR (v_bet_type = 'multi' AND v_option_count < 2)
  ) THEN
    RAISE EXCEPTION 'Invalid option count for bet type %', v_bet_type
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_options) AS option(value)
    WHERE jsonb_typeof(option.value) IS DISTINCT FROM 'object'
       OR NULLIF(BTRIM(option.value ->> 'name'), '') IS NULL
       OR CASE
            WHEN (option.value ->> 'odds') ~ '^[0-9]+(\.[0-9]+)?$'
              THEN (option.value ->> 'odds')::NUMERIC <= 0
            ELSE true
          END
  ) THEN
    RAISE EXCEPTION 'Options must include non-empty names and positive numeric odds'
      USING ERRCODE = '23514';
  END IF;

  SELECT jsonb_agg(
           jsonb_build_object(
             'name', BTRIM(option.value ->> 'name'),
             'odds', (option.value ->> 'odds')::NUMERIC
           )
           ORDER BY option.ord
         )
    INTO v_options
    FROM jsonb_array_elements(v_options) WITH ORDINALITY AS option(value, ord);

  IF v_ends_at IS NULL THEN
    RAISE EXCEPTION 'End date is required' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.bets (
    title,
    category_id,
    bet_type,
    options,
    ends_at,
    is_bsplicboost
  )
  VALUES (
    v_title,
    v_category_id,
    v_bet_type,
    v_options,
    v_ends_at,
    COALESCE(p_is_bsplicboost, false)
  )
  RETURNING id INTO v_bet_id;

  UPDATE public.bet_proposals
     SET status = 'accepted',
         title = v_title,
         category_id = v_category_id,
         bet_type = v_bet_type,
         options = v_options,
         ends_at = v_ends_at
   WHERE id = v_proposal.id;

  RETURN jsonb_build_object(
    'proposal_id', v_proposal.id,
    'bet_id', v_bet_id,
    'status', 'accepted'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.review_bet_proposal(
  UUID,
  TEXT,
  TEXT,
  UUID,
  TEXT,
  JSONB,
  TIMESTAMPTZ,
  BOOLEAN
)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.review_bet_proposal(
  UUID,
  TEXT,
  TEXT,
  UUID,
  TEXT,
  JSONB,
  TIMESTAMPTZ,
  BOOLEAN
)
TO authenticated, service_role;
