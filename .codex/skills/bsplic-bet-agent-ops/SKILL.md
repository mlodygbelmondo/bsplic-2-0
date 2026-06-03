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
- Always browse for current schedules, odds, or final results; sports/esports data is time-sensitive.
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
2. Browse current/upcoming events and cite sources.
3. Skip duplicates against recent bets, active bets, pending proposals, and recent accepted proposals.
4. Build deterministic `agent_duplicate_key` values.
5. Call `agent_create_bet_proposals`.
6. Report `created`, `skipped`, `errors`, confidence, and sources.

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
3. Report recommendations with exact BSPLIC option names, mode, scope, confidence, sources, and uncertainty.
4. Wait for explicit approval before calling `agent_settle_bet`.
5. Use `pending_only` unless the user explicitly asks for correction scope `all`.

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
