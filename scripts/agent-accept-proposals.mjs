#!/usr/bin/env node

import {
  callAgentRpc,
  printJson,
  readJsonInput,
} from "./lib/bsplic-agent-rpc.mjs";

function usage() {
  process.stderr.write(`Usage:
  npm run agent:accept-proposals -- <proposal-id> [proposal-id ...] [--live] [--bsplicboost]
  npm run agent:accept-proposals -- --ids <id,id,...> [--live] [--bsplicboost]
  npm run agent:accept-proposals -- --json <payload.json>

JSON payload:
  ["proposal-id-1", "proposal-id-2"]
  or
  {
    "proposalIds": ["proposal-id-1"],
    "isLive": false,
    "isBsplicboost": false
  }
`);
}

function parseArgs(args) {
  const proposalIds = [];
  let jsonPath = null;
  let isLive = false;
  let isBsplicboost = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }

    if (arg === "--json") {
      jsonPath = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--ids") {
      const idsRaw = args[index + 1] || "";
      proposalIds.push(
        ...idsRaw
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean),
      );
      index += 1;
      continue;
    }

    if (arg === "--live") {
      isLive = true;
      continue;
    }

    if (arg === "--bsplicboost") {
      isBsplicboost = true;
      continue;
    }

    proposalIds.push(arg);
  }

  if (!jsonPath) {
    return { proposalIds, isLive, isBsplicboost };
  }

  const payload = readJsonInput(jsonPath);
  if (Array.isArray(payload)) {
    return { proposalIds: payload, isLive, isBsplicboost };
  }

  return {
    proposalIds:
      payload.proposalIds || payload.proposal_ids || payload.ids || [],
    isLive: Boolean(payload.isLive ?? payload.is_live ?? isLive),
    isBsplicboost: Boolean(
      payload.isBsplicboost ?? payload.is_bsplicboost ?? isBsplicboost,
    ),
  };
}

const input = parseArgs(process.argv.slice(2));

if (!Array.isArray(input.proposalIds) || input.proposalIds.length === 0) {
  usage();
  process.exit(1);
}

try {
  const result = await callAgentRpc("agent_accept_bet_proposals", {
    p_proposal_ids: input.proposalIds,
    p_is_live: input.isLive,
    p_is_bsplicboost: input.isBsplicboost,
  });
  printJson(result);
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
}
