#!/usr/bin/env node

import {
  callAgentRpc,
  printJson,
  readJsonInput,
} from "./lib/bsplic-agent-rpc.mjs";

function usage() {
  process.stderr.write(`Usage:
  npm run agent:settle-bets -- <payload.json> [--run-id RUN_UUID]
  npm run agent:settle-bets -- - [--run-id RUN_UUID]

JSON payload — one entry per market:
  [
    {
      "bet_id": "bet-uuid",
      "mode": "normal",
      "scope": "pending_only",
      "winning_options": ["Polska"],
      "evidence": {
        "sources": ["https://official-source/..."],
        "confidence": "high",
        "note": "2:1, wynik końcowy"
      }
    },
    {
      "bet_id": "bet-uuid",
      "hold": true,
      "reason": "brak potwierdzonego wyniku w źródłach"
    }
  ]

  mode:  normal (default) | refund | force_lost
  scope: pending_only (default) | all

An entry with "hold": true records why the market could not be resolved and
leaves it unsettled. Never guess a result instead of holding.

The payload can also be an object with a "settlements" array.
`);
}

const rawArgs = process.argv.slice(2);

if (rawArgs.includes("--help") || rawArgs.includes("-h") || rawArgs.length === 0) {
  usage();
  process.exit(rawArgs.length === 0 ? 1 : 0);
}

let runId = null;
const positional = [];

for (let i = 0; i < rawArgs.length; i += 1) {
  if (rawArgs[i] === "--run-id") {
    runId = rawArgs[i + 1] ?? null;
    i += 1;
    continue;
  }
  positional.push(rawArgs[i]);
}

if (positional.length !== 1) {
  usage();
  process.exit(1);
}

try {
  const payload = readJsonInput(positional[0]);
  const settlements = Array.isArray(payload) ? payload : payload.settlements;

  if (!Array.isArray(settlements)) {
    throw new Error(
      "Payload must be a JSON array or an object with a settlements array.",
    );
  }

  const settled = [];
  const held = [];
  const errors = [];

  for (const entry of settlements) {
    const betId = entry?.bet_id;

    if (!betId) {
      errors.push({ entry, reason: "missing bet_id" });
      continue;
    }

    try {
      if (entry.hold === true) {
        const result = await callAgentRpc("agent_flag_settlement_hold", {
          p_bet_id: betId,
          p_reason: entry.reason ?? "nierozstrzygnięte przez agenta",
          p_run_id: runId,
        });
        held.push({ bet_id: betId, result });
        continue;
      }

      const mode = entry.mode ?? "normal";
      const winningOptions = Array.isArray(entry.winning_options)
        ? entry.winning_options
        : [];

      if (mode === "normal" && winningOptions.length === 0) {
        errors.push({
          bet_id: betId,
          reason: "normal settlement requires at least one winning option",
        });
        continue;
      }

      const evidence = {
        ...(entry.evidence ?? {}),
        ...(runId ? { run_id: runId } : {}),
      };

      const result = await callAgentRpc("agent_settle_bet", {
        p_bet_id: betId,
        p_winning_options: winningOptions,
        p_mode: mode,
        p_scope: entry.scope ?? "pending_only",
        p_evidence: evidence,
      });

      settled.push({ bet_id: betId, mode, result });
    } catch (error) {
      errors.push({
        bet_id: betId,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  printJson({
    settled_count: settled.length,
    held_count: held.length,
    error_count: errors.length,
    settled,
    held,
    errors,
  });

  if (errors.length > 0) {
    process.exit(2);
  }
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
}
