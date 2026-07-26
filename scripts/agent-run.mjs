#!/usr/bin/env node

import { readFileSync } from "node:fs";

import { callAgentRpc, printJson } from "./lib/bsplic-agent-rpc.mjs";

function usage() {
  process.stderr.write(`Usage:
  npm run agent:run -- start [--kind daily|settle|create|manual]
  npm run agent:run -- finish <RUN_UUID> [--status ok|partial|failed]
                                         [--counts '{"created":5,"settled":3,"held":1}']
                                         [--summary <summary.json>]
                                         [--report "one paragraph"]
  npm run agent:run -- recent [--limit 10]

Bracket every autonomous cycle so a run that fails, half-completes or never
fires is visible without reading the runner's logs.

The summary should carry, at minimum:
  ako_unresolved                 exclusions that could not be created
  unexcluded_same_event_pairs    same-event pairs deliberately left combinable
  settlement_holds               markets left unsettled and why
`);
}

const args = process.argv.slice(2);

if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
  usage();
  process.exit(args.length === 0 ? 1 : 0);
}

function readFlag(name, fallback = null) {
  const index = args.indexOf(name);
  if (index === -1) {
    return fallback;
  }
  return args[index + 1] ?? fallback;
}

function parseJsonFlag(name, fallback) {
  const raw = readFlag(name);
  if (raw === null) {
    return fallback;
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`${name} must be valid JSON`);
  }
}

const command = args[0];

try {
  if (command === "start") {
    const result = await callAgentRpc("agent_start_run", {
      p_kind: readFlag("--kind", "daily"),
    });
    printJson(result);
  } else if (command === "finish") {
    const runId = args[1];
    if (!runId || runId.startsWith("--")) {
      throw new Error("finish requires a run id");
    }

    const summaryPath = readFlag("--summary");
    const summary = summaryPath
      ? JSON.parse(readFileSync(summaryPath, "utf8"))
      : {};

    const result = await callAgentRpc("agent_finish_run", {
      p_run_id: runId,
      p_status: readFlag("--status", "ok"),
      p_counts: parseJsonFlag("--counts", {}),
      p_summary: summary,
      p_report: readFlag("--report"),
    });
    printJson(result);
  } else if (command === "recent") {
    const limitRaw = readFlag("--limit", "10");
    const result = await callAgentRpc("agent_get_recent_runs", {
      p_limit: Number.parseInt(limitRaw, 10) || 10,
    });
    printJson(result);
  } else {
    usage();
    process.exit(1);
  }
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
}
