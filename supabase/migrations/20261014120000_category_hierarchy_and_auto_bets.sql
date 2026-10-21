-- Sportsbook categories become two levels (sport -> league) with a stable
-- slug, so the auto-bets bot can file markets per league and players can
-- filter a whole sport or a single league. Also schedules the auto-bets edge
-- function (supabase/functions/auto-bets), which publishes markets from
-- Polymarket and settles them once Polymarket resolves.

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS slug TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_slug_key') THEN
    ALTER TABLE public.categories ADD CONSTRAINT categories_slug_key UNIQUE (slug);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_parent_not_self') THEN
    ALTER TABLE public.categories
      ADD CONSTRAINT categories_parent_not_self CHECK (parent_id IS DISTINCT FROM id);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS categories_parent_id_idx ON public.categories (parent_id);

-- One level of nesting only: a parent must be top-level and a category that
-- already has children cannot be moved under another one.
CREATE OR REPLACE FUNCTION private.enforce_category_depth()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, private
AS $$
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.categories WHERE id = NEW.parent_id AND parent_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Kategoria nadrzędna nie może być podkategorią';
  END IF;

  IF EXISTS (SELECT 1 FROM public.categories WHERE parent_id = NEW.id) THEN
    RAISE EXCEPTION 'Kategoria z podkategoriami nie może mieć kategorii nadrzędnej';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_category_depth() FROM PUBLIC;

DROP TRIGGER IF EXISTS enforce_category_depth ON public.categories;
CREATE TRIGGER enforce_category_depth
BEFORE INSERT OR UPDATE OF parent_id ON public.categories
FOR EACH ROW
EXECUTE FUNCTION private.enforce_category_depth();

-- Slug the existing categories by their current names (oldest row wins if a
-- name repeats).
UPDATE public.categories c
   SET slug = m.slug
  FROM (
    VALUES
      ('BSPL', 'bspl'),
      ('Gambling', 'gambling'),
      ('Gaming', 'gaming'),
      ('YouTube', 'youtube'),
      ('Piłka nożna', 'football'),
      ('Liga Mistrzów', 'football-ucl'),
      ('Tenis', 'tennis'),
      ('NBA', 'basketball-nba'),
      ('CS2', 'esports-cs2'),
      ('LoL', 'esports-lol'),
      ('Siatkówka', 'volleyball'),
      ('Hokej', 'hockey'),
      ('MLB', 'mlb'),
      ('UFC', 'ufc'),
      ('Dart', 'darts'),
      ('F1', 'f1'),
      ('Żużel', 'speedway')
  ) AS m(name, slug)
 WHERE c.id = (
         SELECT c2.id
           FROM public.categories c2
          WHERE c2.name = m.name
          ORDER BY c2.created_at, c2.id
          LIMIT 1
       )
   AND c.slug IS NULL
   AND NOT EXISTS (SELECT 1 FROM public.categories c3 WHERE c3.slug = m.slug);

-- Create whatever the bot needs and is still missing. Existing rows keep their
-- name, emoji and colour.
INSERT INTO public.categories (slug, name, emoji, color)
VALUES
  ('football', 'Piłka nożna', '⚽', '#59b003'),
  ('football-ucl', 'Liga Mistrzów', '🏆', '#0300d1'),
  ('football-uel', 'Liga Europy', '🟠', '#f97316'),
  ('football-ekstraklasa', 'Ekstraklasa', '🇵🇱', '#dc2626'),
  ('football-epl', 'Premier League', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', '#3d195b'),
  ('football-laliga', 'LaLiga', '🇪🇸', '#ff4b44'),
  ('football-serie-a', 'Serie A', '🇮🇹', '#008fd7'),
  ('football-bundesliga', 'Bundesliga', '🇩🇪', '#d20515'),
  ('football-ligue-1', 'Ligue 1', '🇫🇷', '#1e3a8a'),
  ('football-national', 'Reprezentacje', '🌍', '#16a34a'),
  ('tennis', 'Tenis', '🎾', '#c23a00'),
  ('tennis-atp', 'ATP', '🔵', '#1d4ed8'),
  ('tennis-wta', 'WTA', '🟣', '#7c3aed'),
  ('basketball', 'Koszykówka', '🏀', '#ea580c'),
  ('basketball-nba', 'NBA', '🏀', '#ff7300'),
  ('basketball-euroleague', 'Euroliga', '🇪🇺', '#f59e0b'),
  ('esports', 'Esport', '🕹️', '#8b5cf6'),
  ('esports-cs2', 'CS2', '🔫', '#ffdd00'),
  ('esports-lol', 'LoL', '🔵', '#0037ff'),
  ('esports-dota2', 'Dota 2', '🛡️', '#b91c1c'),
  ('esports-valorant', 'Valorant', '🔺', '#ff4655'),
  ('volleyball', 'Siatkówka', '🏐', '#ffd91a'),
  ('hockey', 'Hokej', '🏒', '#2c53dd'),
  ('nfl', 'NFL', '🏈', '#013369'),
  ('mlb', 'MLB', '⚾', '#ffffff'),
  ('ufc', 'UFC', '🥊', '#000000'),
  ('darts', 'Dart', '🎯', '#dc2626'),
  ('f1', 'F1', '🏎️', '#00ff88'),
  ('speedway', 'Żużel', '🏍️', '#363636')
ON CONFLICT (slug) DO NOTHING;

-- Top-level order.
UPDATE public.categories c
   SET sort_order = t.sort_order
  FROM (
    VALUES
      ('bspl', 0), ('gambling', 1), ('gaming', 2), ('youtube', 3),
      ('football', 4), ('tennis', 5), ('basketball', 6), ('esports', 7),
      ('volleyball', 8), ('hockey', 9), ('nfl', 10), ('mlb', 11),
      ('ufc', 12), ('darts', 13), ('f1', 14), ('speedway', 15)
  ) AS t(slug, sort_order)
 WHERE c.slug = t.slug;

-- Leagues under their sport, ordered within it.
UPDATE public.categories c
   SET parent_id = p.id,
       sort_order = t.sort_order
  FROM (
    VALUES
      ('football-ucl', 'football', 0),
      ('football-uel', 'football', 1),
      ('football-ekstraklasa', 'football', 2),
      ('football-epl', 'football', 3),
      ('football-laliga', 'football', 4),
      ('football-serie-a', 'football', 5),
      ('football-bundesliga', 'football', 6),
      ('football-ligue-1', 'football', 7),
      ('football-national', 'football', 8),
      ('tennis-atp', 'tennis', 0),
      ('tennis-wta', 'tennis', 1),
      ('basketball-nba', 'basketball', 0),
      ('basketball-euroleague', 'basketball', 1),
      ('esports-cs2', 'esports', 0),
      ('esports-lol', 'esports', 1),
      ('esports-dota2', 'esports', 2),
      ('esports-valorant', 'esports', 3)
  ) AS t(slug, parent_slug, sort_order)
  JOIN public.categories p ON p.slug = t.parent_slug
 WHERE c.slug = t.slug;

-- Unchanged from 20260726105000 except the require_unsettled guard, which the
-- auto-bets bot sets so it never overwrites a settlement made after it read
-- the pending list.
CREATE OR REPLACE FUNCTION public.agent_settle_bet(
  p_token TEXT,
  p_bet_id UUID,
  p_winning_options TEXT[] DEFAULT ARRAY[]::TEXT[],
  p_mode TEXT DEFAULT 'normal',
  p_scope TEXT DEFAULT 'pending_only',
  p_evidence JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_auth JSONB;
  v_evidence JSONB;
  v_result JSONB;
  v_winning_option TEXT;
BEGIN
  v_auth := private.require_agent_scope(p_token, 'settle:bets');

  -- Automated callers set require_unsettled: under the row lock (the same one
  -- admin settlement takes) refuse a market someone settled in the meantime.
  IF COALESCE(p_evidence ->> 'require_unsettled', 'false') = 'true' THEN
    SELECT winning_option INTO v_winning_option
      FROM public.bets
     WHERE id = p_bet_id
     FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Nie znaleziono zakładu';
    END IF;

    IF v_winning_option IS NOT NULL THEN
      RAISE EXCEPTION 'Zakład jest już rozliczony';
    END IF;
  END IF;

  v_evidence := COALESCE(p_evidence, '{}'::JSONB);
  IF jsonb_typeof(v_evidence) <> 'object' THEN
    v_evidence := '{}'::JSONB;
  END IF;

  v_evidence := v_evidence || jsonb_build_object(
    'mode', COALESCE(p_mode, 'normal'),
    'scope', COALESCE(p_scope, 'pending_only'),
    'winning_options', COALESCE(to_jsonb(p_winning_options), '[]'::JSONB),
    'settled_at', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'settled_by', 'agent'
  );

  -- Record the evidence and clear any prior hold. Settlement maths itself is
  -- untouched and still runs through the canonical private function that
  -- `admin_settle_bet` uses.
  UPDATE public.bets
     SET agent_metadata =
           (COALESCE(agent_metadata, '{}'::JSONB) - 'settlement_hold')
           || jsonb_build_object('settlement', v_evidence)
   WHERE id = p_bet_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono zakładu';
  END IF;

  v_result := private.settle_sportsbook_bet(
    p_bet_id,
    p_winning_options,
    p_mode,
    p_scope,
    (v_auth->>'agent_user_id')::UUID,
    'agent'
  );

  RETURN v_result;
END;
$$;

-- Scheduling. The function URL and the shared secret live in Vault so this
-- migration stays project-agnostic; until both secrets exist the job is a
-- no-op. One-time setup is described in supabase/functions/auto-bets/index.ts.
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION private.invoke_auto_bets(p_mode TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
SET search_path = public, private
AS $$
DECLARE
  v_url TEXT;
  v_secret TEXT;
BEGIN
  IF to_regclass('vault.decrypted_secrets') IS NULL OR to_regnamespace('net') IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets
   WHERE name = 'auto_bets_function_url';

  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
   WHERE name = 'auto_bets_cron_secret';

  IF v_url IS NULL OR v_secret IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN net.http_post(
    url := v_url,
    body := jsonb_build_object('mode', p_mode),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-auto-bets-secret', v_secret
    ),
    timeout_milliseconds := 140000
  );
END;
$$;

REVOKE ALL ON FUNCTION private.invoke_auto_bets(TEXT) FROM PUBLIC;

DO $$
BEGIN
  IF to_regnamespace('cron') IS NOT NULL THEN
    PERFORM cron.unschedule(jobid)
       FROM cron.job
      WHERE jobname IN ('bsplic-auto-bets-settle', 'bsplic-auto-bets-create');

    PERFORM cron.schedule(
      'bsplic-auto-bets-settle',
      '7,37 * * * *',
      $job$SELECT private.invoke_auto_bets('settle');$job$
    );

    PERFORM cron.schedule(
      'bsplic-auto-bets-create',
      '20 4,10,16,22 * * *',
      $job$SELECT private.invoke_auto_bets('create');$job$
    );
  END IF;
END
$$;
