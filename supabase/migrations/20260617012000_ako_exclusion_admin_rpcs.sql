-- Admin helpers for reading and atomically replacing AKO exclusions.

CREATE OR REPLACE FUNCTION public.admin_get_bet_ako_exclusions(p_bet_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Brak uprawnień administratora';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'betId', b.id,
        'title', b.title,
        'reason', e.reason
      )
      ORDER BY b.title
    ),
    '[]'::JSONB
  )
    INTO v_result
    FROM public.bet_ako_exclusions e
    JOIN public.bets b
      ON b.id = CASE
        WHEN e.bet_id_a = p_bet_id THEN e.bet_id_b
        ELSE e.bet_id_a
      END
   WHERE e.bet_id_a = p_bet_id
      OR e.bet_id_b = p_bet_id;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_replace_bet_ako_exclusions(
  p_bet_id UUID,
  p_exclusions JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_other_bet_id UUID;
  v_reason TEXT;
  v_seen_bet_ids UUID[] := ARRAY[]::UUID[];
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Brak uprawnień administratora';
  END IF;

  IF p_exclusions IS NULL OR jsonb_typeof(p_exclusions) <> 'array' THEN
    RAISE EXCEPTION 'Nieprawidłowa lista wykluczeń AKO';
  END IF;

  PERFORM 1 FROM public.bets WHERE id = p_bet_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Zakład nie istnieje';
  END IF;

  DELETE FROM public.bet_ako_exclusions
   WHERE bet_id_a = p_bet_id
      OR bet_id_b = p_bet_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_exclusions)
  LOOP
    v_other_bet_id := (v_item->>'betId')::UUID;
    v_reason := NULLIF(BTRIM(v_item->>'reason'), '');

    IF v_other_bet_id = p_bet_id THEN
      RAISE EXCEPTION 'Zakład nie może wykluczać samego siebie';
    END IF;

    IF v_other_bet_id = ANY(v_seen_bet_ids) THEN
      CONTINUE;
    END IF;

    PERFORM 1 FROM public.bets WHERE id = v_other_bet_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Wybrany zakład do wykluczenia nie istnieje';
    END IF;

    INSERT INTO public.bet_ako_exclusions (
      bet_id_a,
      bet_id_b,
      reason,
      created_by
    )
    VALUES (
      p_bet_id,
      v_other_bet_id,
      v_reason,
      auth.uid()
    );

    v_seen_bet_ids := array_append(v_seen_bet_ids, v_other_bet_id);
  END LOOP;

  RETURN public.admin_get_bet_ako_exclusions(p_bet_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_bet_ako_exclusions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_replace_bet_ako_exclusions(UUID, JSONB) TO authenticated;
