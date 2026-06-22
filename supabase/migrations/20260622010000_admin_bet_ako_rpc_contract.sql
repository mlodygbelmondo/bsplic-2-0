-- Ship admin bet create/update RPCs and lock AKO exclusion replacement in a
-- fresh migration for databases that already ran the original AKO RPC file.

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
  v_lock_bet_ids UUID[];
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

  SELECT COALESCE(array_agg(DISTINCT bet_id ORDER BY bet_id), ARRAY[p_bet_id]::UUID[])
    INTO v_lock_bet_ids
    FROM (
      SELECT p_bet_id AS bet_id
      UNION ALL
      SELECT (item.value->>'betId')::UUID
        FROM jsonb_array_elements(p_exclusions) AS item(value)
       WHERE item.value ? 'betId'
    ) locked_bets;

  PERFORM 1
    FROM public.bets
   WHERE id = ANY(v_lock_bet_ids)
   ORDER BY id
   FOR UPDATE;

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

    IF v_other_bet_id IS NULL THEN
      RAISE EXCEPTION 'Nieprawidłowy identyfikator zakładu';
    END IF;

    IF v_other_bet_id = p_bet_id THEN
      RAISE EXCEPTION 'Zakład nie może wykluczać samego siebie';
    END IF;

    IF v_other_bet_id = ANY(v_seen_bet_ids) THEN
      RAISE EXCEPTION 'Duplikat wykluczenia AKO';
    END IF;

    PERFORM 1 FROM public.bets WHERE id = v_other_bet_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Powiązany zakład nie istnieje';
    END IF;

    v_seen_bet_ids := array_append(v_seen_bet_ids, v_other_bet_id);

    INSERT INTO public.bet_ako_exclusions (bet_id_a, bet_id_b, reason, created_by)
    VALUES (
      LEAST(p_bet_id, v_other_bet_id),
      GREATEST(p_bet_id, v_other_bet_id),
      v_reason,
      auth.uid()
    )
    ON CONFLICT (bet_id_a, bet_id_b)
    DO UPDATE SET
      reason = EXCLUDED.reason,
      created_by = EXCLUDED.created_by,
      created_at = NOW();
  END LOOP;

  RETURN public.admin_get_bet_ako_exclusions(p_bet_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_bet_with_ako_exclusions(
  p_title TEXT,
  p_category_id UUID,
  p_bet_type TEXT,
  p_options JSONB,
  p_ends_at TIMESTAMPTZ,
  p_is_live BOOLEAN DEFAULT false,
  p_is_bsplicboost BOOLEAN DEFAULT false,
  p_exclusions JSONB DEFAULT '[]'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bet_id UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Brak uprawnień administratora';
  END IF;

  IF NULLIF(BTRIM(p_title), '') IS NULL THEN
    RAISE EXCEPTION 'Tytuł zakładu jest wymagany';
  END IF;

  IF p_options IS NULL OR jsonb_typeof(p_options) <> 'array' THEN
    RAISE EXCEPTION 'Nieprawidłowa lista opcji zakładu';
  END IF;

  INSERT INTO public.bets (
    title,
    category_id,
    bet_type,
    options,
    ends_at,
    is_live,
    is_bsplicboost
  )
  VALUES (
    BTRIM(p_title),
    p_category_id,
    p_bet_type,
    p_options,
    p_ends_at,
    COALESCE(p_is_live, false),
    COALESCE(p_is_bsplicboost, false)
  )
  RETURNING id INTO v_bet_id;

  PERFORM public.admin_replace_bet_ako_exclusions(
    v_bet_id,
    COALESCE(p_exclusions, '[]'::JSONB)
  );

  RETURN v_bet_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_bet_with_ako_exclusions(
  p_bet_id UUID,
  p_title TEXT,
  p_category_id UUID,
  p_bet_type TEXT,
  p_options JSONB,
  p_ends_at TIMESTAMPTZ,
  p_is_live BOOLEAN DEFAULT false,
  p_is_bsplicboost BOOLEAN DEFAULT false,
  p_is_active BOOLEAN DEFAULT true,
  p_exclusions JSONB DEFAULT '[]'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bet_id UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Brak uprawnień administratora';
  END IF;

  IF NULLIF(BTRIM(p_title), '') IS NULL THEN
    RAISE EXCEPTION 'Tytuł zakładu jest wymagany';
  END IF;

  IF p_options IS NULL OR jsonb_typeof(p_options) <> 'array' THEN
    RAISE EXCEPTION 'Nieprawidłowa lista opcji zakładu';
  END IF;

  UPDATE public.bets
     SET title = BTRIM(p_title),
         category_id = p_category_id,
         bet_type = p_bet_type,
         options = p_options,
         ends_at = p_ends_at,
         is_live = COALESCE(p_is_live, false),
         is_bsplicboost = COALESCE(p_is_bsplicboost, false),
         is_active = COALESCE(p_is_active, true)
   WHERE id = p_bet_id
   RETURNING id INTO v_bet_id;

  IF v_bet_id IS NULL THEN
    RAISE EXCEPTION 'Zakład nie istnieje';
  END IF;

  PERFORM public.admin_replace_bet_ako_exclusions(
    v_bet_id,
    COALESCE(p_exclusions, '[]'::JSONB)
  );

  RETURN v_bet_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_get_bet_ako_exclusions(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_replace_bet_ako_exclusions(UUID, JSONB) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_create_bet_with_ako_exclusions(TEXT, UUID, TEXT, JSONB, TIMESTAMPTZ, BOOLEAN, BOOLEAN, JSONB) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_bet_with_ako_exclusions(UUID, TEXT, UUID, TEXT, JSONB, TIMESTAMPTZ, BOOLEAN, BOOLEAN, BOOLEAN, JSONB) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_get_bet_ako_exclusions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_replace_bet_ako_exclusions(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_bet_with_ako_exclusions(TEXT, UUID, TEXT, JSONB, TIMESTAMPTZ, BOOLEAN, BOOLEAN, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_bet_with_ako_exclusions(UUID, TEXT, UUID, TEXT, JSONB, TIMESTAMPTZ, BOOLEAN, BOOLEAN, BOOLEAN, JSONB) TO authenticated;
