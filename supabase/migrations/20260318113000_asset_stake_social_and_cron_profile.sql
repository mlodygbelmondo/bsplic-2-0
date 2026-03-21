-- Fix asset-backed stake accounting, expose asset stake in social feed,
-- and add peak/off-peak cron scheduling helpers for market quote refresh.

CREATE OR REPLACE FUNCTION public.place_bet_secure(
  p_user_id     UUID,
  p_total_odds  NUMERIC,
  p_stake       NUMERIC,
  p_items       JSONB,
  p_stake_asset JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance                NUMERIC;
  v_coupon_id              UUID;
  v_item                   JSONB;
  v_bet_active             BOOLEAN;
  v_bet_ended              BOOLEAN;
  v_stake_asset_id         UUID;
  v_stake_asset_symbol     TEXT;
  v_stake_asset_type       public.market_asset_type;
  v_stake_asset_quantity   NUMERIC;
  v_stake_asset_unit_pln   NUMERIC;
  v_stake_asset_fx_to_pln  NUMERIC;
  v_asset_position_qty     NUMERIC;
  v_asset_quote_currency   TEXT;
  v_asset_min_bet_pln      NUMERIC;
  v_computed_stake_pln     NUMERIC;
BEGIN
  IF p_stake IS NULL OR p_stake <= 0 THEN
    RAISE EXCEPTION 'Stawka musi być większa od 0';
  END IF;

  IF p_stake <> ROUND(p_stake, 2) THEN
    RAISE EXCEPTION 'Stawka może mieć maksymalnie 2 miejsca po przecinku';
  END IF;

  SELECT balance INTO v_balance
    FROM public.profiles
   WHERE id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono użytkownika';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    IF (v_item->>'stake')::NUMERIC <> ROUND((v_item->>'stake')::NUMERIC, 2) THEN
      RAISE EXCEPTION 'Stawka zakładu może mieć maksymalnie 2 miejsca po przecinku';
    END IF;

    IF (v_item->>'stake')::NUMERIC <= 0 THEN
      RAISE EXCEPTION 'Stawka każdego zakładu musi być większa od 0';
    END IF;

    SELECT is_active, (ends_at <= NOW()) INTO v_bet_active, v_bet_ended
      FROM public.bets
     WHERE id = (v_item->>'betId')::UUID;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Zakład nie istnieje';
    END IF;

    IF NOT v_bet_active THEN
      RAISE EXCEPTION 'Zakład jest już zamknięty';
    END IF;

    IF v_bet_ended THEN
      RAISE EXCEPTION 'Czas na obstawianie tego zakładu minął';
    END IF;
  END LOOP;

  IF p_stake_asset IS NOT NULL THEN
    v_stake_asset_id := NULLIF(p_stake_asset->>'assetId', '')::UUID;
    v_stake_asset_quantity := (p_stake_asset->>'quantity')::NUMERIC;
    v_stake_asset_unit_pln := (p_stake_asset->>'unitPricePln')::NUMERIC;
    v_stake_asset_fx_to_pln := (p_stake_asset->>'fxRateToPln')::NUMERIC;

    IF v_stake_asset_id IS NULL OR v_stake_asset_quantity IS NULL OR v_stake_asset_quantity <= 0 THEN
      RAISE EXCEPTION 'Niepoprawna stawka aktywem';
    END IF;

    IF v_stake_asset_unit_pln IS NULL OR v_stake_asset_unit_pln <= 0 THEN
      RAISE EXCEPTION 'Niepoprawna cena aktywa dla stawki';
    END IF;

    IF v_stake_asset_fx_to_pln IS NULL OR v_stake_asset_fx_to_pln <= 0 THEN
      RAISE EXCEPTION 'Niepoprawny kurs FX dla stawki';
    END IF;

    SELECT
      ma.symbol,
      ma.type,
      ma.quote_currency,
      ma.min_bet_pln
      INTO
        v_stake_asset_symbol,
        v_stake_asset_type,
        v_asset_quote_currency,
        v_asset_min_bet_pln
    FROM public.market_assets ma
    WHERE ma.id = v_stake_asset_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Nie znaleziono aktywa dla stawki';
    END IF;

    v_computed_stake_pln := ROUND(v_stake_asset_quantity * v_stake_asset_unit_pln, 2);
    IF ABS(v_computed_stake_pln - ROUND(p_stake, 2)) > 0.01 THEN
      RAISE EXCEPTION 'Niepoprawna wartość stawki aktywem';
    END IF;

    IF v_asset_min_bet_pln IS NOT NULL AND p_stake < v_asset_min_bet_pln THEN
      RAISE EXCEPTION 'Minimalna wartość stawki dla tego aktywa to % zł', ROUND(v_asset_min_bet_pln, 2);
    END IF;

    SELECT public.get_market_asset_position_qty(p_user_id, v_stake_asset_id)
      INTO v_asset_position_qty;

    IF v_asset_position_qty < v_stake_asset_quantity THEN
      RAISE EXCEPTION 'Niewystarczająca ilość aktywa do stawki';
    END IF;

    INSERT INTO public.market_transactions (
      user_id,
      asset_id,
      side,
      quantity,
      unit_price_pln,
      quote_currency,
      fx_rate_to_pln,
      gross_value_pln,
      fee_pln,
      net_value_pln
    ) VALUES (
      p_user_id,
      v_stake_asset_id,
      'bet_stake',
      v_stake_asset_quantity,
      ROUND(v_stake_asset_unit_pln, 8),
      COALESCE(v_asset_quote_currency, 'PLN'),
      v_stake_asset_fx_to_pln,
      ROUND(p_stake, 2),
      0,
      ROUND(p_stake, 2)
    );
  ELSE
    IF p_stake > v_balance THEN
      RAISE EXCEPTION 'Niewystarczające środki (saldo: % zł)', ROUND(v_balance, 2);
    END IF;

    UPDATE public.profiles
       SET balance = ROUND(balance - p_stake, 2)
     WHERE id = p_user_id;
  END IF;

  INSERT INTO public.coupons (
    user_id,
    total_odds,
    stake,
    status,
    stake_asset_id,
    stake_asset_symbol,
    stake_asset_type,
    stake_asset_quantity,
    stake_asset_unit_price_pln,
    stake_asset_fx_rate_to_pln
  )
  VALUES (
    p_user_id,
    p_total_odds,
    ROUND(p_stake, 2),
    'pending',
    v_stake_asset_id,
    v_stake_asset_symbol,
    v_stake_asset_type,
    v_stake_asset_quantity,
    v_stake_asset_unit_pln,
    v_stake_asset_fx_to_pln
  )
  RETURNING id INTO v_coupon_id;

  INSERT INTO public.placed_bets (user_id, bet_id, selected_option, stake, odds_at_time, coupon_id)
  SELECT
    p_user_id,
    (item->>'betId')::UUID,
    item->>'selectedOption',
    ROUND((item->>'stake')::NUMERIC, 2),
    (item->>'odds')::NUMERIC,
    v_coupon_id
  FROM jsonb_array_elements(p_items) AS item;

  UPDATE public.bets
     SET bet_count = bet_count + 1
   WHERE id IN (
     SELECT (item->>'betId')::UUID
       FROM jsonb_array_elements(p_items) AS item
   );

  RETURN v_coupon_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_social_feed(
  p_limit  INTEGER DEFAULT 30,
  p_offset INTEGER DEFAULT 0,
  p_user_id UUID DEFAULT NULL
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
  WITH feed_items AS (
    SELECT
      sp.id,
      'post' AS item_type,
      sp.user_id,
      pr.username,
      pr.avatar_url,
      sp.content,
      NULL::NUMERIC AS total_odds,
      NULL::NUMERIC AS stake,
      NULL::UUID    AS stake_asset_id,
      NULL::TEXT    AS stake_asset_symbol,
      NULL::public.market_asset_type AS stake_asset_type,
      NULL::NUMERIC AS stake_asset_quantity,
      NULL::NUMERIC AS stake_asset_unit_price_pln,
      NULL::NUMERIC AS stake_asset_fx_rate_to_pln,
      NULL::NUMERIC AS payout,
      NULL::TEXT    AS status,
      NULL::JSON    AS legs,
      sp.created_at
    FROM public.social_posts sp
    JOIN public.profiles pr ON pr.id = sp.user_id

    UNION ALL

    SELECT
      c.id,
      'coupon' AS item_type,
      c.user_id,
      pr.username,
      pr.avatar_url,
      NULL AS content,
      c.total_odds,
      c.stake,
      c.stake_asset_id,
      c.stake_asset_symbol,
      c.stake_asset_type,
      c.stake_asset_quantity,
      c.stake_asset_unit_price_pln,
      c.stake_asset_fx_rate_to_pln,
      c.payout,
      c.status::TEXT,
      (
        SELECT json_agg(
          json_build_object(
            'id', pb.id,
            'bet_id', pb.bet_id,
            'selected_option', pb.selected_option,
            'odds_at_time', pb.odds_at_time,
            'result', pb.result,
            'bet_title', b.title
          ) ORDER BY pb.created_at
        )
        FROM public.placed_bets pb
        LEFT JOIN public.bets b ON b.id = pb.bet_id
        WHERE pb.coupon_id = c.id
      ) AS legs,
      c.created_at
    FROM public.coupons c
    JOIN public.profiles pr ON pr.id = c.user_id
  ),
  ordered_feed AS (
    SELECT * FROM feed_items
    ORDER BY created_at DESC
    LIMIT p_limit OFFSET p_offset
  ),
  with_counts AS (
    SELECT
      f.*,
      (
        SELECT json_object_agg(r.emoji, r.cnt)
        FROM (
          SELECT sr.emoji::TEXT, COUNT(*) AS cnt
          FROM public.social_reactions sr
          WHERE (f.item_type = 'post'   AND sr.post_id   = f.id)
             OR (f.item_type = 'coupon' AND sr.coupon_id  = f.id)
          GROUP BY sr.emoji
        ) r
      ) AS reactions,
      (
        SELECT COUNT(*)
        FROM public.social_comments sc
        WHERE (f.item_type = 'post'   AND sc.post_id   = f.id)
           OR (f.item_type = 'coupon' AND sc.coupon_id  = f.id)
      ) AS comment_count,
      (
        SELECT sr.emoji::TEXT
        FROM public.social_reactions sr
        WHERE sr.user_id = p_user_id
          AND ((f.item_type = 'post'   AND sr.post_id   = f.id)
            OR (f.item_type = 'coupon' AND sr.coupon_id  = f.id))
        LIMIT 1
      ) AS my_reaction
    FROM ordered_feed f
  )
  SELECT json_agg(row_to_json(wc) ORDER BY wc.created_at DESC)
    INTO v_result
    FROM with_counts wc;

  RETURN COALESCE(v_result, '[]'::JSON);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_social_feed_item(
  p_item_type TEXT,
  p_item_id UUID,
  p_user_id UUID DEFAULT NULL
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
  IF p_item_type NOT IN ('post', 'coupon') THEN
    RAISE EXCEPTION 'Nieprawidłowy typ elementu social';
  END IF;

  WITH item_data AS (
    SELECT
      sp.id,
      'post'::TEXT AS item_type,
      sp.user_id,
      pr.username,
      pr.avatar_url,
      sp.content,
      NULL::NUMERIC AS total_odds,
      NULL::NUMERIC AS stake,
      NULL::UUID    AS stake_asset_id,
      NULL::TEXT    AS stake_asset_symbol,
      NULL::public.market_asset_type AS stake_asset_type,
      NULL::NUMERIC AS stake_asset_quantity,
      NULL::NUMERIC AS stake_asset_unit_price_pln,
      NULL::NUMERIC AS stake_asset_fx_rate_to_pln,
      NULL::NUMERIC AS payout,
      NULL::TEXT AS status,
      NULL::JSON AS legs,
      sp.created_at
    FROM public.social_posts sp
    JOIN public.profiles pr ON pr.id = sp.user_id
    WHERE p_item_type = 'post'
      AND sp.id = p_item_id

    UNION ALL

    SELECT
      c.id,
      'coupon'::TEXT AS item_type,
      c.user_id,
      pr.username,
      pr.avatar_url,
      NULL::TEXT AS content,
      c.total_odds,
      c.stake,
      c.stake_asset_id,
      c.stake_asset_symbol,
      c.stake_asset_type,
      c.stake_asset_quantity,
      c.stake_asset_unit_price_pln,
      c.stake_asset_fx_rate_to_pln,
      c.payout,
      c.status::TEXT,
      (
        SELECT json_agg(
          json_build_object(
            'id', pb.id,
            'bet_id', pb.bet_id,
            'selected_option', pb.selected_option,
            'odds_at_time', pb.odds_at_time,
            'result', pb.result,
            'bet_title', b.title
          )
          ORDER BY pb.created_at
        )
        FROM public.placed_bets pb
        LEFT JOIN public.bets b ON b.id = pb.bet_id
        WHERE pb.coupon_id = c.id
      ) AS legs,
      c.created_at
    FROM public.coupons c
    JOIN public.profiles pr ON pr.id = c.user_id
    WHERE p_item_type = 'coupon'
      AND c.id = p_item_id
  ),
  with_counts AS (
    SELECT
      i.*,
      (
        SELECT json_object_agg(r.emoji, r.cnt)
        FROM (
          SELECT sr.emoji::TEXT, COUNT(*) AS cnt
          FROM public.social_reactions sr
          WHERE (i.item_type = 'post' AND sr.post_id = i.id)
             OR (i.item_type = 'coupon' AND sr.coupon_id = i.id)
          GROUP BY sr.emoji
        ) r
      ) AS reactions,
      (
        SELECT COUNT(*)
        FROM public.social_comments sc
        WHERE (i.item_type = 'post' AND sc.post_id = i.id)
           OR (i.item_type = 'coupon' AND sc.coupon_id = i.id)
      ) AS comment_count,
      (
        SELECT sr.emoji::TEXT
        FROM public.social_reactions sr
        WHERE sr.user_id = p_user_id
          AND ((i.item_type = 'post' AND sr.post_id = i.id)
            OR (i.item_type = 'coupon' AND sr.coupon_id = i.id))
        LIMIT 1
      ) AS my_reaction
    FROM item_data i
  )
  SELECT row_to_json(wc)
    INTO v_result
  FROM with_counts wc
  LIMIT 1;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.setup_market_data_refresh_cron(
  p_project_url TEXT,
  p_anon_key TEXT,
  p_schedule TEXT DEFAULT '*/15 * * * *'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url TEXT;
  v_headers_json TEXT;
  v_command TEXT;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can configure market refresh cron';
  END IF;

  IF p_project_url IS NULL OR btrim(p_project_url) = '' THEN
    RAISE EXCEPTION 'p_project_url is required';
  END IF;

  IF p_anon_key IS NULL OR btrim(p_anon_key) = '' THEN
    RAISE EXCEPTION 'p_anon_key is required';
  END IF;

  v_url := rtrim(p_project_url, '/') || '/functions/v1/market-data';
  v_headers_json := format('{"Content-Type":"application/json","Authorization":"Bearer %s"}', p_anon_key);

  v_command := format(
    $request$
    SELECT net.http_post(
      url := %L,
      headers := %L::jsonb,
      body := '{"action":"refresh"}'::jsonb
    ) AS request_id;
    $request$,
    v_url,
    v_headers_json
  );

  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('market-data-refresh', 'market-data-refresh-peak', 'market-data-refresh-offpeak');
  PERFORM cron.schedule('market-data-refresh', p_schedule, v_command);
END;
$$;

CREATE OR REPLACE FUNCTION public.setup_market_data_refresh_cron_profile(
  p_project_url TEXT,
  p_anon_key TEXT,
  p_peak_start_hour INTEGER DEFAULT 10,
  p_peak_end_hour INTEGER DEFAULT 16,
  p_offpeak_step_hours INTEGER DEFAULT 2
)
RETURNS TABLE (
  peak_schedule TEXT,
  offpeak_schedule TEXT,
  estimated_runs_per_day INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url TEXT;
  v_headers_json TEXT;
  v_command TEXT;
  v_hour INTEGER;
  v_offpeak_hours TEXT := '';
  v_peak_hours_count INTEGER := 0;
  v_offpeak_hours_count INTEGER := 0;
  v_peak_schedule TEXT;
  v_offpeak_schedule TEXT;
  v_estimated INTEGER;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can configure market refresh cron';
  END IF;

  IF p_project_url IS NULL OR btrim(p_project_url) = '' THEN
    RAISE EXCEPTION 'p_project_url is required';
  END IF;

  IF p_anon_key IS NULL OR btrim(p_anon_key) = '' THEN
    RAISE EXCEPTION 'p_anon_key is required';
  END IF;

  IF p_peak_start_hour < 0 OR p_peak_start_hour > 23 OR p_peak_end_hour < 0 OR p_peak_end_hour > 23 THEN
    RAISE EXCEPTION 'Peak hours must be in range 0..23';
  END IF;

  IF p_peak_start_hour > p_peak_end_hour THEN
    RAISE EXCEPTION 'p_peak_start_hour must be <= p_peak_end_hour';
  END IF;

  IF p_offpeak_step_hours < 1 OR p_offpeak_step_hours > 12 THEN
    RAISE EXCEPTION 'p_offpeak_step_hours must be in range 1..12';
  END IF;

  v_url := rtrim(p_project_url, '/') || '/functions/v1/market-data';
  v_headers_json := format('{"Content-Type":"application/json","Authorization":"Bearer %s"}', p_anon_key);

  v_command := format(
    $request$
    SELECT net.http_post(
      url := %L,
      headers := %L::jsonb,
      body := '{"action":"refresh"}'::jsonb
    ) AS request_id;
    $request$,
    v_url,
    v_headers_json
  );

  FOR v_hour IN p_peak_start_hour..p_peak_end_hour LOOP
    v_peak_hours_count := v_peak_hours_count + 1;
  END LOOP;

  FOR v_hour IN 0..23 LOOP
    IF (v_hour < p_peak_start_hour OR v_hour > p_peak_end_hour) AND (v_hour % p_offpeak_step_hours = 0) THEN
      v_offpeak_hours := v_offpeak_hours || CASE WHEN v_offpeak_hours = '' THEN '' ELSE ',' END || v_hour::TEXT;
      v_offpeak_hours_count := v_offpeak_hours_count + 1;
    END IF;
  END LOOP;

  IF v_offpeak_hours = '' THEN
    RAISE EXCEPTION 'No off-peak hours generated for given configuration';
  END IF;

  v_peak_schedule := format('0,30 %s-%s * * *', p_peak_start_hour, p_peak_end_hour);
  v_offpeak_schedule := format('0 %s * * *', v_offpeak_hours);
  v_estimated := (v_peak_hours_count * 2) + v_offpeak_hours_count;

  IF v_estimated > 25 THEN
    RAISE EXCEPTION 'Configured profile would exceed 25 refreshes/day (%).', v_estimated;
  END IF;

  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('market-data-refresh', 'market-data-refresh-peak', 'market-data-refresh-offpeak');

  PERFORM cron.schedule('market-data-refresh-peak', v_peak_schedule, v_command);
  PERFORM cron.schedule('market-data-refresh-offpeak', v_offpeak_schedule, v_command);

  RETURN QUERY SELECT v_peak_schedule, v_offpeak_schedule, v_estimated;
END;
$$;

CREATE OR REPLACE FUNCTION public.disable_market_data_refresh_cron()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can disable market refresh cron';
  END IF;

  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname IN ('market-data-refresh', 'market-data-refresh-peak', 'market-data-refresh-offpeak');
END;
$$;
