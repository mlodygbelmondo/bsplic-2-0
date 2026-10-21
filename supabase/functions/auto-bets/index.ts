// Auto-bets: publishes sportsbook markets from Polymarket and settles them
// once Polymarket resolves, with no model in the loop.
//
// Invoked by pg_cron (see the 20261014120000 migration):
//   POST { "mode": "settle" }  every 30 minutes
//   POST { "mode": "create" }  a few times a day
// Add "dryRun": true to see what would happen without writing anything.
//
// Auth: header `x-auto-bets-secret` must equal the AUTO_BETS_CRON_SECRET
// function secret. Writes go through the agent token RPCs (BSPLIC_AGENT_TOKEN
// needs create:bets, read:bets, read:settlement, settle:bets, manage:runs), so
// provenance, duplicate protection and the run audit match the old agent's.
//
// One-time setup after deploying the function and the migration:
//   supabase secrets set AUTO_BETS_CRON_SECRET=<random hex>
//   -- SQL editor; the cron jobs stay no-ops until both secrets exist:
//   select vault.create_secret('https://<ref>.supabase.co/functions/v1/auto-bets', 'auto_bets_function_url');
//   select vault.create_secret('<same random hex>', 'auto_bets_cron_secret');
// Pause with: select cron.unschedule('bsplic-auto-bets-create'); (and -settle)

import { runCreation, runSettlement, type RunnerDeps } from './runner.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
const agentToken = Deno.env.get('BSPLIC_AGENT_TOKEN');
const cronSecret = Deno.env.get('AUTO_BETS_CRON_SECRET');

const GAMMA_URL = 'https://gamma-api.polymarket.com';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

const deps: RunnerDeps = {
  async rpc<T>(name: string, params: Record<string, unknown>) {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey!,
        Authorization: `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...params, p_token: agentToken }),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`${name} failed (${response.status}): ${text.slice(0, 300)}`);
    }
    return (text ? JSON.parse(text) : null) as T;
  },
  async gamma<T>(path: string) {
    const response = await fetch(`${GAMMA_URL}${path}`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Polymarket ${path.split('?')[0]} failed (${response.status})`);
    }
    return (await response.json()) as T;
  },
  log: (message) => console.error(message),
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }
  if (!cronSecret || !safeEqual(req.headers.get('x-auto-bets-secret') ?? '', cronSecret)) {
    return json({ error: 'Unauthorized' }, 401);
  }
  if (!supabaseUrl || !supabaseAnonKey || !agentToken) {
    return json({ error: 'auto-bets is not configured' }, 500);
  }

  const body = (await req.json().catch(() => ({}))) as { mode?: string; dryRun?: boolean };
  const mode = body.mode === 'settle' || body.mode === 'create' ? body.mode : 'all';
  const dryRun = body.dryRun === true;
  const now = new Date();
  const response: Record<string, unknown> = { mode, dryRun, startedAt: now.toISOString() };

  try {
    if (mode !== 'create') {
      response.settle = await runSettlement(deps, now, dryRun);
    }
    if (mode !== 'settle') {
      response.create = await runCreation(deps, now, dryRun);
    }
    return json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('auto-bets failed', message);
    return json({ ...response, error: message }, 500);
  }
});
