---
name: bsplic-bet-agent-ops
description: "Reference instructions for BSPLIC sportsbook agent operations in /home/piotr/bsplic-2-0. Use when the user asks for any BSPLIC agent action: fetch bet/proposal context, draft proposals, accept agent proposals, create bets directly, inspect settlement context, research results, prepare settlement recommendations, settle approved bets, smoke-test agent RPCs, or manage token scopes."
---

# BSPLIC Bet Agent Ops

## Guardrails

- Work from `/home/piotr/bsplic-2-0`.
- Load agent secrets from `/home/piotr/.codex-secrets/bsplic-agent.env`.
- Never print `BSPLIC_AGENT_TOKEN`, Supabase keys, or raw env file contents.
- Never use a Supabase service-role key for this workflow.
- Always browse for current schedules, bookmaker odds, or final results; sports/esports data is time-sensitive.
- Treat the price for every option as a live-data requirement: use only decimal odds displayed by an identifiable bookmaker or an odds-comparison service that names the bookmaker and update time.
- Never derive, estimate, round into existence, or label as bookmaker odds a price based on rankings, team form, prediction percentages, implied probabilities, or personal judgement.
- If a current two-sided price cannot be verified for every offered outcome, do not create or publish that market. Report it as skipped with the missing source or outcome.
- Record the bookmaker, source URL, observed-at time in UTC, and the exact displayed price for every market in `agent_metadata`. Preserve the quoted bookmaker price; do not apply an unrequested margin or price adjustment.
- Cite sources in user-facing proposal and settlement reports.
- Default to pending proposals. Publish proposals or create live bets directly only when the user explicitly asks for that exact action.
- Never call `agent_settle_bet` until the user explicitly approves exact settlement recommendations in the current conversation.
- Keep `accept:proposals`, `create:bets`, and `settle:bets` off the token unless the user intentionally enables those capabilities.

## Key Files

- Agent env: `/home/piotr/.codex-secrets/bsplic-agent.env`
- Repo runbook: `/home/piotr/bsplic-2-0/.ai/docs/agent-bet-automation-runbook.md`
- Accept proposals script: `/home/piotr/bsplic-2-0/scripts/agent-accept-proposals.mjs`
- Direct bet creation script: `/home/piotr/bsplic-2-0/scripts/agent-create-bets.mjs`
- Agent publishing migration: `/home/piotr/bsplic-2-0/supabase/migrations/20260603143000_agent_publish_bet_rpcs.sql`
- Settlement migration: `/home/piotr/bsplic-2-0/supabase/migrations/20260524172000_canonical_sportsbook_settlement_rpc.sql`

## Setup

Use this before shell commands that call Supabase RPCs:

```bash
cd /home/piotr/bsplic-2-0
set +x
source /home/piotr/.codex-secrets/bsplic-agent.env
```

The Node scripts load `/home/piotr/.codex-secrets/bsplic-agent.env` automatically when variables are not already set.

## RPCs

- `agent_get_bet_context(p_token, p_recent_bet_limit, p_history_limit)` requires `read:bets`.
- `agent_create_bet_proposals(p_token, p_proposals)` requires `create:proposals`.
- `agent_accept_bet_proposals(p_token, p_proposal_ids, p_is_live, p_is_bsplicboost)` requires `accept:proposals`.
- `agent_create_bets(p_token, p_bets)` requires `create:bets`.
- `agent_get_pending_settlement_context(p_token, p_limit)` requires `read:settlement`.
- `agent_settle_bet(p_token, p_bet_id, p_winning_options, p_mode, p_scope)` requires `settle:bets`.

## Fetch Context

Use when preparing proposals, checking duplicates, or deciding what can be accepted.

```bash
curl -sS "$BSPLIC_SUPABASE_URL/rest/v1/rpc/agent_get_bet_context" \
  -H "apikey: $BSPLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $BSPLIC_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  --data "{\"p_token\":\"$BSPLIC_AGENT_TOKEN\",\"p_recent_bet_limit\":10,\"p_history_limit\":200}"
```

Check `recentBets`, `activeBets`, `pendingProposals`, `recentAcceptedProposals`, and categories.

## Draft Proposals

1. Fetch context.
2. Browse the current/upcoming event from an official or trusted schedule source.
3. Fetch a current moneyline price for every option from a bookmaker or named odds-comparison feed. Capture the source URL, bookmaker, UTC observation time, market type, and exact decimal odds.
4. Reject the candidate if the source is stale, the bookmaker is not identifiable, a required outcome has no price, the market type is not an exact match, or the displayed price is not decimal. Do not substitute a model estimate.
5. Skip duplicates against recent bets, active bets, pending proposals, and recent accepted proposals.
6. Build deterministic `agent_duplicate_key` values.
7. Put a complete `agent_metadata.odds_source` object on every proposal, for example:

```json
{
  "bookmaker": "ExampleBookmaker",
  "url": "https://example.com/event",
  "observed_at": "2026-07-20T12:34:56Z",
  "market": "match winner",
  "prices": {
    "Team A": 1.72,
    "Team B": 2.08
  }
}
```

8. Call `agent_create_bet_proposals` only with the captured prices unchanged.
9. Report `created`, `skipped`, `errors`, bookmaker, observation time, and sources. Explicitly state that no market was priced from a model.

## Accept Agent Proposals

Use only when the user explicitly asks to publish already-created pending agent proposals.

```bash
npm run agent:accept-proposals -- PROPOSAL_UUID_1 PROPOSAL_UUID_2
npm run agent:accept-proposals -- PROPOSAL_UUID --live
npm run agent:accept-proposals -- PROPOSAL_UUID --bsplicboost
npm run agent:accept-proposals -- --json ./payload.json
```

Do not accept stale, ambiguous, human, or duplicate proposals. Report `accepted`, `skipped`, `errors`, and new `bet_id`s.

## Create Direct Bets

Use only when the user explicitly asks to bypass proposals and create live bets directly.

```bash
npm run agent:create-bets -- ./payload.json
npm run agent:create-bets -- -
```

Payload can be a top-level array or `{ "bets": [...] }`. Each bet needs `title`, `bet_type`, `options`, `ends_at`, and optional `category_id`, `is_live`, `is_bsplicboost`, `agent_duplicate_key`.

Report `created`, `skipped`, `errors`, confidence, and sources.

## Settlement

1. Fetch settlement context with `agent_get_pending_settlement_context`.
2. Browse official/trusted result sources.
3. Include ended, unresolved bets even when nobody placed them (`placed_bet_count = 0`) or when they have no pending legs (`pending_leg_count = 0`). Settlement still records the bet outcome, sets `winning_option`, and closes the market for historical/UI correctness.
4. Report recommendations with exact BSPLIC option names, mode, scope, confidence, sources, and uncertainty.
5. Wait for explicit approval before calling `agent_settle_bet`.
6. Use `p_mode: "normal"` for ordinary winner settlement, `refund` for voids, or `force_lost` only when every option should lose.
7. Use `pending_only` unless the user explicitly asks for correction scope `all`; `pending_only` is still appropriate for no-pick/no-pending bets because it closes the bet and records `winning_option` without reprocessing already settled legs.

## Smoke Tests

App checks:

```bash
npm run test -- src/features/admin/settlementApi.test.ts src/features/admin/components/ManageBetsTab.test.tsx src/features/admin/components/ProposalsTab.test.tsx
npm run lint
npm run build
```

Safest live RPC checks:

- `agent_get_bet_context`
- `agent_get_pending_settlement_context`
- `agent_create_bet_proposals` with `[]` only
- `agent_create_bets` with `[]` only after `create:bets` is intentionally enabled
- `agent_accept_bet_proposals` with an empty ID list only after `accept:proposals` is intentionally enabled; it should return validation without publishing

Avoid test-publishing or test-settling real bets unless the user approved the exact target and expected result.
