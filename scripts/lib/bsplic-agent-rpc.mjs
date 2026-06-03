import { existsSync, readFileSync } from "node:fs";

const DEFAULT_ENV_FILE = "/home/piotr/.codex-secrets/bsplic-agent.env";

function unquoteEnvValue(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function loadAgentEnv(
  envPath = process.env.BSPLIC_AGENT_ENV || DEFAULT_ENV_FILE,
) {
  if (!existsSync(envPath)) {
    return;
  }

  const file = readFileSync(envPath, "utf8");
  for (const rawLine of file.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const normalized = line.startsWith("export ")
      ? line.slice("export ".length).trim()
      : line;
    const separatorIndex = normalized.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = normalized.slice(0, separatorIndex).trim();
    const value = unquoteEnvValue(normalized.slice(separatorIndex + 1));
    if (!key || process.env[key]) {
      continue;
    }

    process.env[key] = value;
  }
}

export function readJsonInput(inputPath) {
  const raw =
    inputPath === "-"
      ? readFileSync(0, "utf8")
      : readFileSync(inputPath, "utf8");
  return JSON.parse(raw);
}

export async function callAgentRpc(rpcName, params) {
  loadAgentEnv();

  const url = process.env.BSPLIC_SUPABASE_URL;
  const anonKey = process.env.BSPLIC_SUPABASE_ANON_KEY;
  const token = process.env.BSPLIC_AGENT_TOKEN;

  if (!url || !anonKey || !token) {
    throw new Error(
      "Missing BSPLIC agent environment. Set BSPLIC_SUPABASE_URL, BSPLIC_SUPABASE_ANON_KEY and BSPLIC_AGENT_TOKEN.",
    );
  }

  const response = await fetch(
    `${url.replace(/\/$/, "")}/rest/v1/rpc/${rpcName}`,
    {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...params, p_token: token }),
    },
  );

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    throw new Error(
      `RPC ${rpcName} failed with HTTP ${response.status}: ${JSON.stringify(payload)}`,
    );
  }

  return payload;
}

export function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
