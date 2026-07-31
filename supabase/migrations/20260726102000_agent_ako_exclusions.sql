-- Make AKO exclusions writable by the token-authenticated agent.
--
-- `admin_replace_bet_ako_exclusions` gates on `has_role(auth.uid(), 'admin')`.
-- The agent authenticates with the anon key plus a token argument, so
-- `auth.uid()` is NULL and the check always raises. The exclusion logic is
-- therefore extracted into `private.*` helpers with an explicit actor, and the
-- admin RPCs become thin role-checking wrappers. Admin behaviour is unchanged.
--
-- This also fixes the ON CONFLICT target in the exclusion upsert. The only
-- unique index on the table is the expression index
-- `bet_ako_exclusions_pair_unique ON (LEAST(bet_id_a, bet_id_b), GREATEST(...))`.
-- `ON CONFLICT (bet_id_a, bet_id_b)` cannot be inferred from it and raises
-- "there is no unique or exclusion constraint matching the ON CONFLICT
-- specification". The correct inference target is the index expression.

CREATE OR REPLACE FUNCTION private.get_bet_ako_exclusions(p_bet_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_result JSONB;
BEGIN
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

-- Additive single-pair upsert. Used by batch creation, where writing a full
-- replacement list per bet would delete pairs created moments earlier in the
-- same request.
CREATE OR REPLACE FUNCTION private.add_bet_ako_exclusion(
  p_bet_id_a UUID,
  p_bet_id_b UUID,
  p_reason TEXT,
  p_actor UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF p_bet_id_a IS NULL OR p_bet_id_b IS NULL THEN
    RAISE EXCEPTION 'Nieprawidłowy identyfikator zakładu';
  END IF;

  IF p_bet_id_a = p_bet_id_b THEN
    RAISE EXCEPTION 'Zakład nie może wykluczać samego siebie';
  END IF;

  INSERT INTO public.bet_ako_exclusions (bet_id_a, bet_id_b, reason, created_by)
  VALUES (
    LEAST(p_bet_id_a, p_bet_id_b),
    GREATEST(p_bet_id_a, p_bet_id_b),
    NULLIF(BTRIM(COALESCE(p_reason, '')), ''),
    p_actor
  )
  ON CONFLICT (LEAST(bet_id_a, bet_id_b), GREATEST(bet_id_a, bet_id_b))
  DO UPDATE SET
    reason = COALESCE(EXCLUDED.reason, public.bet_ako_exclusions.reason),
    created_by = EXCLUDED.created_by,
    created_at = NOW();

  RETURN true;
END;
$$;

-- Wholesale replacement of every pair touching one bet. Correct for the admin
-- editor, which always submits a complete list.
CREATE OR REPLACE FUNCTION private.replace_bet_ako_exclusions(
  p_bet_id UUID,
  p_exclusions JSONB,
  p_actor UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_item JSONB;
  v_lock_bet_ids UUID[];
  v_other_bet_id UUID;
  v_reason TEXT;
  v_seen_bet_ids UUID[] := ARRAY[]::UUID[];
BEGIN
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

    PERFORM private.add_bet_ako_exclusion(p_bet_id, v_other_bet_id, v_reason, p_actor);
  END LOOP;

  RETURN private.get_bet_ako_exclusions(p_bet_id);
END;
$$;

REVOKE ALL ON FUNCTION private.get_bet_ako_exclusions(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.add_bet_ako_exclusion(UUID, UUID, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.replace_bet_ako_exclusions(UUID, JSONB, UUID) FROM PUBLIC;

-- Admin RPCs keep their exact external contract and delegate.

CREATE OR REPLACE FUNCTION public.admin_get_bet_ako_exclusions(p_bet_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Brak uprawnień administratora';
  END IF;

  RETURN private.get_bet_ako_exclusions(p_bet_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_replace_bet_ako_exclusions(
  p_bet_id UUID,
  p_exclusions JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Brak uprawnień administratora';
  END IF;

  RETURN private.replace_bet_ako_exclusions(p_bet_id, p_exclusions, auth.uid());
END;
$$;

-- Agent-facing correction path for exclusions created after the fact.
CREATE OR REPLACE FUNCTION public.agent_set_bet_ako_exclusions(
  p_token TEXT,
  p_bet_id UUID,
  p_exclusions JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_auth JSONB;
BEGIN
  v_auth := private.require_agent_scope(p_token, 'manage:ako');

  RETURN private.replace_bet_ako_exclusions(
    p_bet_id,
    COALESCE(p_exclusions, '[]'::JSONB),
    (v_auth->>'agent_user_id')::UUID
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_get_bet_ako_exclusions(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_replace_bet_ako_exclusions(UUID, JSONB) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_get_bet_ako_exclusions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_replace_bet_ako_exclusions(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agent_set_bet_ako_exclusions(TEXT, UUID, JSONB)
TO anon, authenticated, service_role;

-- Grant the new scope to the existing agent token, mirroring
-- 20260610163923_enable_sportsbook_agent_direct_bet_creation.sql.
UPDATE private.agent_api_tokens
   SET scopes = (
     SELECT array_agg(DISTINCT scope_name ORDER BY scope_name)
       FROM unnest(scopes || ARRAY['manage:ako']::TEXT[]) AS scope_name
   )
 WHERE 'create:bets' = ANY(scopes)
   AND NOT 'manage:ako' = ANY(scopes);
