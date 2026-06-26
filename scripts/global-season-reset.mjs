#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import {
  callOperatorRpc,
  printJson,
} from "./lib/bsplic-operator-rpc.mjs";

function usage() {
  process.stderr.write(`Usage:
  npm run season:reset -- --dry-run [--cutoff <iso-timestamp>]
  npm run season:reset -- --execute [--cutoff <iso-timestamp>]

Environment:
  BSPLIC_OPERATOR_SUPABASE_URL
  BSPLIC_OPERATOR_SERVICE_ROLE_KEY
`);
}

function normalizeCutoff(value) {
  if (!value || value.startsWith("--")) {
    throw new Error("--cutoff requires a timestamp");
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new Error("--cutoff must be a valid ISO timestamp");
  }

  return value;
}

export function parseResetArgs(args) {
  let mode = null;
  let cutoff = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      return { mode: "help", cutoff: null };
    }

    if (arg === "--dry-run") {
      if (mode) {
        throw new Error("Choose exactly one reset mode: --dry-run or --execute.");
      }
      mode = "dry-run";
      continue;
    }

    if (arg === "--execute") {
      if (mode) {
        throw new Error("Choose exactly one reset mode: --dry-run or --execute.");
      }
      mode = "execute";
      continue;
    }

    if (arg === "--cutoff" || arg === "--at") {
      cutoff = normalizeCutoff(args[index + 1]);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!mode) {
    throw new Error("Choose exactly one reset mode: --dry-run or --execute.");
  }

  return { mode, cutoff };
}

export function buildResetRpcCall(parsed) {
  const params = {};

  if (parsed.cutoff) {
    params.p_reset_at = parsed.cutoff;
  }

  if (parsed.mode === "dry-run") {
    return {
      rpcName: "preview_global_season_reset",
      params,
    };
  }

  if (parsed.mode === "execute") {
    return {
      rpcName: "execute_global_season_reset",
      params: {
        p_confirm: true,
        ...params,
      },
    };
  }

  throw new Error("Choose exactly one reset mode: --dry-run or --execute.");
}

export async function main(args = process.argv.slice(2)) {
  const parsed = parseResetArgs(args);
  if (parsed.mode === "help") {
    usage();
    return;
  }

  const { rpcName, params } = buildResetRpcCall(parsed);
  const result = await callOperatorRpc(rpcName, params);
  printJson(result);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    usage();
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  });
}
