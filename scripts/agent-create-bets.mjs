#!/usr/bin/env node

import {
  callAgentRpc,
  printJson,
  readJsonInput,
} from "./lib/bsplic-agent-rpc.mjs";

function usage() {
  process.stderr.write(`Usage:
  npm run agent:create-bets -- <payload.json>
  npm run agent:create-bets -- -

JSON payload:
  [
    {
      "title": "Team A - Team B",
      "category_id": "category-uuid-or-null",
      "bet_type": "12",
      "options": [
        { "name": "1", "odds": 1.8 },
        { "name": "2", "odds": 2.0 }
      ],
      "ends_at": "2026-06-03T17:00:00Z",
      "is_live": false,
      "is_bsplicboost": false,
      "agent_duplicate_key": "cs2:event:team-a:team-b:12:2026-06-03"
    }
  ]

The payload can also be an object with a "bets" array.
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

  const result = await callAgentRpc("agent_create_bets", {
    p_bets: bets,
  });
  printJson(result);
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
}
