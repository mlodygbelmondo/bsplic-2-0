-- Provenance and idempotency columns for agent-created sportsbook markets.
--
-- Direct agent bet creation previously accepted `agent_duplicate_key` but never
-- persisted it, so cross-run idempotency relied entirely on fuzzy title matching
-- and the mandated odds-source evidence had nowhere to live on `public.bets`.

ALTER TABLE public.bets
  ADD COLUMN IF NOT EXISTS agent_duplicate_key TEXT,
  ADD COLUMN IF NOT EXISTS agent_metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS event_key TEXT;

-- Hard idempotency guard: a retry after a timeout must not re-create markets.
CREATE UNIQUE INDEX IF NOT EXISTS bets_agent_duplicate_key_unique
  ON public.bets (agent_duplicate_key)
  WHERE agent_duplicate_key IS NOT NULL;

-- Lets the agent and the run report group markets belonging to one real-world
-- event without scanning every active bet.
CREATE INDEX IF NOT EXISTS bets_event_key_active_idx
  ON public.bets (event_key)
  WHERE event_key IS NOT NULL AND is_active = true;

COMMENT ON COLUMN public.bets.agent_duplicate_key IS
  'Deterministic agent-supplied idempotency key. Unique when present.';
COMMENT ON COLUMN public.bets.agent_metadata IS
  'Agent provenance: odds_source (bookmaker/url/observed_at/prices), settlement evidence, holds.';
COMMENT ON COLUMN public.bets.event_key IS
  'Groups markets belonging to the same real-world event (e.g. fifa-wc-2026:pol-bra:2026-07-28).';
