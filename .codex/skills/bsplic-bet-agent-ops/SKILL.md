---
name: bsplic-bet-agent-ops
description: "Autonomous BSPLIC sportsbook agent operations in /home/piotr/bsplic-2-0. Use for the daily unattended run (settle finished markets, publish new ones, set AKO exclusions) and for any manual BSPLIC agent action: fetch bet/settlement context, create bets, manage AKO exclusions, research results, settle bets, inspect run history, smoke-test agent RPCs, or manage token scopes."
---

# BSPLIC Bet Agent Ops

The agent runs unattended once a day. It settles everything that finished, then
publishes new markets straight to the live board. Nobody approves its output, so
every rule below is load-bearing.

The production ChatGPT task uses
[the Scheduled Task prompt](assets/scheduled-task-prompt.md). Keep it aligned
with the policies in this skill when behavior changes.

## Guardrails

- Work from `/home/piotr/bsplic-2-0`.
- Secrets come from the environment: `BSPLIC_SUPABASE_URL`,
  `BSPLIC_SUPABASE_ANON_KEY`, `BSPLIC_AGENT_TOKEN`. In a local shell,
  `/home/piotr/.codex-secrets/bsplic-agent.env` is a fallback. Environment
  variables always win.
- Never print `BSPLIC_AGENT_TOKEN`, Supabase keys, or raw env file contents.
- Never use a Supabase service-role key for this workflow.
- Always browse for current schedules, bookmaker odds and final results.
  Sports/esports data is time-sensitive; nothing here may come from memory.
- **Every offered outcome needs a live decimal price from a named bookmaker or
  an odds-comparison service that names the bookmaker and the update time.**
  Never derive, estimate, round into existence, or relabel a price based on
  rankings, form, prediction percentages, implied probabilities or judgement.
- One fresh, internally complete source snapshot is enough. Prices naturally
  differ between bookmakers, regions, pages, and observation times. Pick one
  source and use its displayed prices; do not require agreement with another
  page and never skip an important event solely because another source differs.
- If a current price cannot be verified for *every* outcome of a market, do not
  publish that market from that source. Try another bookmaker, a comparison
  service that identifies the bookmaker and update time, or a simpler market
  before skipping the event.
- Record bookmaker, source URL, observed-at time in UTC and the exact displayed
  price in `agent_metadata.odds_source`. Never apply an unrequested margin.
- Never guess a settlement. Hold it (see **Settlement**).
- Keep `BSPLIC` branding in admin-facing and user-facing copy.

## Daily run

Bracket the whole cycle so a failed or missed run is visible:

```bash
npm run agent:run -- start --kind daily      # -> { "run_id": "..." }
# ... work ...
npm run agent:run -- finish <RUN_UUID> --status ok --counts '{"created":12,"settled":5,"held":1}' --summary ./summary.json --report "..."
```

Order is fixed:

1. **Start the run.** Keep the `run_id`; it goes into settlement evidence and
   holds.
2. **Settle.** `agent_get_pending_settlement_context` → research results →
   `npm run agent:settle-bets -- ./settlements.json --run-id <RUN_UUID>`.
3. **Inventory.** `agent_get_bet_context` → what is already live, which markets
   are grouped by `event_key`, and which AKO pairs already exist
   (`akoExclusions`).
4. **Discover and price.** Find upcoming events per the coverage policy, then
   fetch a real two-sided price for every outcome.
5. **Publish.** Build the payload with `event_key`, `agent_duplicate_key`,
   `ako_ref`, `ako_exclusions` and `agent_metadata.odds_source`, then
   `npm run agent:create-bets -- ./bets.json`.
6. **Finish the run** with counts, `ako_unresolved`, `unexcluded_same_event_pairs`
   and `settlement_holds` in the summary.

If step 5 exits with code 2 there are unresolved AKO exclusions. Fix them with
`agent_set_bet_ako_exclusions` before finishing the run, and never report
`status: ok` while any remain.

## AKO exclusions — the anti-arbitrage rule

Two markets that are correlated must never be combinable on one accumulator. A
user who can put "Team A wins" and "Team A or draw" on the same coupon is being
handed free money.

**You decide which pairs are correlated.** Nothing on the server does it for
you. Before publishing, evaluate every pair among the markets you are creating,
and every pair against markets already active (`activeBets` + `akoExclusions`
from the context RPC).

Correlation classes that must be linked:

- Two markets on the same fixture — winner, double chance, over/under, both
  teams to score, correct score, handicap, player props, map/set betting.
- The same team or player across different markets — match winner and
  tournament winner, match winner and top scorer.
- Tournament progression — group winner and a match inside that group.
- F1 — race winner, podium finish and fastest lap on the same Grand Prix.
- Any pair where one outcome mechanically raises the probability of the other.

Markets on genuinely independent events are fine to combine; that is the point
of an accumulator.

**Every same-event pair you deliberately leave unlinked goes into the run
summary under `unexcluded_same_event_pairs`, with your reason.** That is what
makes a wrong call reviewable afterwards.

Link markets in the same request with `ako_ref`:

```json
[
  {
    "title": "Polska - Brazylia — zwycięzca meczu",
    "bet_type": "1x2",
    "options": [
      { "name": "1", "odds": 2.4 },
      { "name": "X", "odds": 3.3 },
      { "name": "2", "odds": 2.85 }
    ],
    "ends_at": "2026-07-28T18:00:00Z",
    "event_key": "fifa-wc-2026:pol-bra:2026-07-28",
    "agent_duplicate_key": "fifa-wc-2026:pol-bra:1x2:2026-07-28",
    "ako_ref": "pol-bra-1x2",
    "ako_exclusions": [
      { "ref": "pol-bra-ou25", "reason": "ten sam mecz — skorelowane rynki" }
    ],
    "agent_metadata": {
      "odds_source": {
        "bookmaker": "ExampleBookmaker",
        "url": "https://example.com/event",
        "observed_at": "2026-07-26T09:12:00Z",
        "market": "match winner",
        "prices": { "1": 2.4, "X": 3.3, "2": 2.85 }
      }
    }
  }
]
```

Exclusion targets resolve in this order: `ref` (same request) → `betId`
(existing UUID) → `agent_duplicate_key` (existing bet). Use `agent_duplicate_key`
when linking to something published on an earlier day. Exclusions are symmetric
and additive; declaring the pair once is enough.

To correct exclusions after publishing:

```bash
# Replaces the FULL exclusion list for that bet.
agent_set_bet_ako_exclusions(p_token, p_bet_id, [{ "betId": "...", "reason": "..." }])
```

## Coverage policy

Focus sports: football, CS2, LoL, tennis, NBA/basketball, darts, F1. Add others
when `historicalBets` shows users engaged with them before.

Aim to publish roughly 10 to 15 new useful markets per daily run. Fewer are
acceptable only after checking the priority slate across multiple sources and
recording why the remaining important events could not be priced. Publish more
when the day has an unusually strong slate. The target is a discovery floor,
not permission to create obscure filler.

Run a must-cover sweep before general discovery:

- every upcoming Real Madrid and FC Barcelona fixture;
- Polish athletes and Polish teams in bookmaker-listed events, especially
  Polish tennis players and major international competitions;
- headline fixtures involving the biggest European football clubs;
- marquee NBA games, playoffs, finals, and games involving top teams or stars;
- top-tier CS2 and LoL, Grand Slam tennis, Formula 1 weekends, and major darts.

For each must-cover event, try the primary match-winner market first. If that
exact market cannot be sourced, try another simple, clearly defined market from
a fresh source. Price disagreement between sources is normal and is not a skip
reason; missing or invented prices are.

Tiers, not fixed caps:

- **Tier A** — World Cup, EURO, CS2/LoL Majors and international finals, tennis
  Slams, NBA playoffs, F1 Grand Prix weekends, major darts tournaments. Cover
  *every* fixture. Add secondary markets on the headline fixtures: over/under
  goals, both teams to score, first goalscorer, map handicap, set betting,
  podium finish.
- **Tier B** — top domestic leagues, regular seasons, tier-1 esports leagues.
  Headline fixtures, match-winner markets, secondary markets only where a
  two-sided price is verifiable.
- **Tier C** — everything else. Skip unless history shows demand.

Use `historicalBets` and `recentAcceptedProposals` from the context RPC to learn
what this audience actually bets on, and let that shift the mix over time. Do
not publish a market nobody will touch just to hit a number.

Never publish a market whose `ends_at` has already passed, and set `ends_at` to
the real event start.

## Settlement

Autonomous. Do not ask for approval.

```bash
npm run agent:settle-bets -- ./settlements.json --run-id <RUN_UUID>
```

Settle when **all** of these hold:

- the event has actually finished,
- the final result is confirmed by an official source, or by two independent
  reputable sources that agree,
- every winning option maps **exactly** onto a BSPLIC option name.

Modes: `normal` for an ordinary winner, `refund` for a void (postponed,
cancelled, abandoned, walkover that voids the market), `force_lost` only when
every option should lose. Scope stays `pending_only` — it still closes the bet
and records `winning_option` for markets with no pending legs.

Settle ended, unresolved markets even when nobody placed a bet
(`placed_bet_count = 0`) or there are no pending legs. That closes the market
and keeps history correct.

**Hold instead of guessing** when: no confirmed result; sources disagree; a
source name does not map cleanly onto a BSPLIC option; the event ended
abnormally and you cannot tell whether the market voids. A hold changes nothing
about the bet — it records the reason so the next run does not re-derive it:

```json
{ "bet_id": "...", "hold": true, "reason": "brak potwierdzonego wyniku w źródłach" }
```

`agent_get_pending_settlement_context` returns `settlement_hold` with the
previous reason and attempt count. Re-check held markets each run; a hold that
survives three runs belongs in the report as something needing a human.

## RPCs

| RPC | Scope |
| --- | --- |
| `agent_get_bet_context(p_token, p_recent_bet_limit, p_history_limit)` | `read:bets` |
| `agent_create_bets(p_token, p_bets)` | `create:bets` |
| `agent_set_bet_ako_exclusions(p_token, p_bet_id, p_exclusions)` | `manage:ako` |
| `agent_get_pending_settlement_context(p_token, p_limit, p_offset)` | `read:settlement` |
| `agent_settle_bet(p_token, p_bet_id, p_winning_options, p_mode, p_scope, p_evidence)` | `settle:bets` |
| `agent_flag_settlement_hold(p_token, p_bet_id, p_reason, p_run_id)` | `settle:bets` |
| `agent_start_run` / `agent_finish_run` / `agent_get_recent_runs` | `manage:runs` |
| `agent_create_bet_proposals(p_token, p_proposals)` | `create:proposals` |
| `agent_accept_bet_proposals(p_token, p_proposal_ids, ...)` | `accept:proposals` |

The proposal RPCs exist for the human review path and are not part of the daily
autonomous run.

Direct call shape:

```bash
curl -sS "$BSPLIC_SUPABASE_URL/rest/v1/rpc/agent_get_bet_context" \
  -H "apikey: $BSPLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $BSPLIC_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  --data "{\"p_token\":\"$BSPLIC_AGENT_TOKEN\",\"p_recent_bet_limit\":10,\"p_history_limit\":200}"
```

## Duplicates

`agent_duplicate_key` is the idempotency guard and is unique across `public.bets`.
Build it deterministically from competition, fixture, market and date, e.g.
`fifa-wc-2026:pol-bra:1x2:2026-07-28`. A re-run after a timeout must produce the
same keys so nothing is published twice.

The server also skips near-duplicates: same bet type, same normalised title,
same option names, within ±6h. Distinct fixtures with identical option names
(1/X/2, Over/Under) do **not** collide — give every market a distinct title.

Payloads larger than 25 bets are chunked automatically by
`npm run agent:create-bets`. Markets sharing an `event_key` are kept in the same
batch so their `ako_ref` links resolve.

## Reporting

Every run reports:

- created markets, with bookmaker and observation time
- skipped candidates and why (duplicate, unverifiable price, missing outcome)
- settled markets with mode, winning options and sources
- held markets with reasons
- `ako_created`, and **loudly** any `ako_unresolved`
- `unexcluded_same_event_pairs` with reasons
- an explicit statement that no market was priced from a model

## Smoke tests

App checks:

```bash
npm run test -- src/features/admin/components/ManageBetsTab.test.tsx src/features/admin/components/ProposalsTab.test.tsx src/features/admin/components/AkoExclusionsEditor.test.tsx
npm run lint
npm run build
```

Behavioral SQL contract tests against a local stack (see
`src/test/db/README.md`):

```bash
npm run test:db
```

Safe live RPC checks:

- `agent_get_bet_context`, `agent_get_pending_settlement_context`,
  `agent_get_recent_runs` — read-only
- `agent_create_bets` with `[]`
- `agent_create_bet_proposals` with `[]`

Do not test-publish or test-settle real markets unless the operator approved the
exact target and expected result.
