#!/usr/bin/env node

import {
  callAgentRpc,
  printJson,
  readJsonInput,
} from "./lib/bsplic-agent-rpc.mjs";
import {
  MAX_BETS_PER_REQUEST,
  chunkBets,
  mergeCreateBetsResults,
  rewriteCrossChunkExclusions,
} from "./lib/bsplic-bet-chunker.mjs";

function usage() {
  process.stderr.write(`Usage:
  npm run agent:create-bets -- <payload.json>
  npm run agent:create-bets -- -

JSON payload:
  [
    {
      "title": "Polska - Brazylia — zwycięzca meczu",
      "category_id": "category-uuid-or-null",
      "bet_type": "1x2",
      "options": [
        { "name": "1", "odds": 2.4 },
        { "name": "X", "odds": 3.3 },
        { "name": "2", "odds": 2.85 }
      ],
      "ends_at": "2026-07-28T18:00:00Z",
      "is_live": false,
      "is_bsplicboost": false,
      "event_key": "fifa-wc-2026:pol-bra:2026-07-28",
      "agent_duplicate_key": "fifa-wc-2026:pol-bra:1x2:2026-07-28",
      "ako_ref": "pol-bra-1x2",
      "ako_exclusions": [
        { "ref": "pol-bra-ou25", "reason": "ten sam mecz — skorelowane rynki" }
      ],
      "agent_metadata": {
        "odds_source": {
          "bookmaker": "...",
          "url": "...",
          "observed_at": "2026-07-26T09:00:00Z",
          "prices": {}
        }
      }
    }
  ]

The payload can also be an object with a "bets" array.
Payloads larger than ${MAX_BETS_PER_REQUEST} bets are chunked automatically.
`);
}

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h") || args.length !== 1) {
  usage();
  process.exit(args.length === 1 ? 0 : 1);
}

try {
  const payload = readJsonInput(args[0]);
  const bets = Array.isArray(payload) ? payload : payload.bets;

  if (!Array.isArray(bets)) {
    throw new Error(
      "Payload must be a JSON array or an object with a bets array.",
    );
  }

  const { chunks, warnings } = rewriteCrossChunkExclusions(chunkBets(bets));

  for (const warning of warnings) {
    process.stderr.write(`WARNING: ${warning}\n`);
  }

  const results = [];
  for (const [index, chunk] of chunks.entries()) {
    if (chunks.length > 1) {
      process.stderr.write(
        `Sending batch ${index + 1}/${chunks.length} (${chunk.length} bets)...\n`,
      );
    }

    const result = await callAgentRpc("agent_create_bets", { p_bets: chunk });
    results.push(result);
  }

  const merged = mergeCreateBetsResults(results);
  merged.batches = chunks.length;
  if (warnings.length > 0) {
    merged.batching_warnings = warnings;
  }

  printJson(merged);

  // An unresolved exclusion means a correlated pair is bookable on one coupon.
  // Exit non-zero so an unattended runner cannot report success over it.
  if (merged.ako_unresolved.length > 0 || warnings.length > 0) {
    process.stderr.write(
      `\n${merged.ako_unresolved.length} unresolved AKO exclusion(s). Correlated markets may be combinable — fix with agent_set_bet_ako_exclusions.\n`,
    );
    process.exit(2);
  }
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
}
