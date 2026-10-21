// Preview what the auto-bets edge function would publish and settle right now,
// from live Polymarket data and the local agent token. Read-only: any RPC
// other than the two context reads is refused.
//
//   npm run auto-bets:dry-run
//   npm run auto-bets:dry-run -- --mode settle
//   npm run auto-bets:dry-run -- --json

import { callAgentRpc } from './lib/bsplic-agent-rpc.mjs';
import { runCreation, runSettlement, type RunnerDeps } from '../supabase/functions/auto-bets/runner.ts';

const READ_ONLY_RPCS = new Set(['agent_get_bet_context', 'agent_get_pending_settlement_context']);

const args = process.argv.slice(2);
const modeIndex = args.indexOf('--mode');
const mode = modeIndex >= 0 ? args[modeIndex + 1] : 'all';
const asJson = args.includes('--json');

const deps: RunnerDeps = {
  async rpc<T>(name: string, params: Record<string, unknown>) {
    if (!READ_ONLY_RPCS.has(name)) {
      throw new Error(`dry run refused write RPC ${name}`);
    }
    return (await callAgentRpc(name, params)) as T;
  },
  async gamma<T>(path: string) {
    const response = await fetch(`https://gamma-api.polymarket.com${path}`);
    if (!response.ok) {
      throw new Error(`Polymarket ${path.split('?')[0]} failed (${response.status})`);
    }
    return (await response.json()) as T;
  },
  log: (message) => process.stderr.write(`${message}\n`),
};

const now = new Date();
const settle = mode === 'create' ? null : await runSettlement(deps, now, true);
const create = mode === 'settle' ? null : await runCreation(deps, now, true);

if (asJson) {
  process.stdout.write(`${JSON.stringify({ settle, create }, null, 2)}\n`);
} else {
  if (settle) {
    process.stdout.write(`\nRozliczenia (${settle.checked} zakończonych rynków Polymarket)\n`);
    for (const bet of settle.settled) process.stdout.write(`  ✔ ${bet.title} → ${bet.winner}\n`);
    for (const bet of settle.refunded) process.stdout.write(`  ↺ ${bet.title} → zwrot (${bet.reason})\n`);
    for (const bet of settle.held) process.stdout.write(`  ⏸ ${bet.title} → wstrzymane (${bet.reason})\n`);
    process.stdout.write(`  czeka na wynik: ${settle.waiting}\n`);
  }
  if (create) {
    const rows = 'would_create' in create ? create.would_create : [];
    process.stdout.write(
      `\nNowe rynki: ${rows.length} (kandydaci ${create.candidates}, poza dziennym limitem ${create.capped})\n`,
    );
    const byCategory = new Map<string, typeof rows>();
    for (const row of rows) {
      byCategory.set(row.category, [...(byCategory.get(row.category) ?? []), row]);
    }
    for (const [category, items] of byCategory) {
      process.stdout.write(`\n  [${category}]\n`);
      for (const item of items.sort((a, b) => a.ends_at.localeCompare(b.ends_at))) {
        const start = new Date(item.ends_at).toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' });
        const odds = item.options.map((option) => `${option.name} ${option.odds}`).join(' | ');
        process.stdout.write(`    ${start}  ${item.title}\n        ${odds}\n`);
      }
    }
    process.stdout.write(`\nOdrzucone: ${JSON.stringify(create.rejected)}\n`);
    if (create.missing_categories.length > 0) {
      process.stdout.write(`Brak kategorii w bazie (te mecze czekają, aż kategoria powstanie): ${create.missing_categories.join(', ')}\n`);
    }
    if (create.fetch_errors.length > 0) {
      process.stdout.write(`Błędy Polymarket: ${JSON.stringify(create.fetch_errors)}\n`);
    }
  }
}
