import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

const cliPath = join(process.cwd(), 'scripts/global-season-reset.mjs');
const rpcPath = join(process.cwd(), 'scripts/lib/bsplic-operator-rpc.mjs');

async function loadCli() {
  expect(existsSync(cliPath)).toBe(true);
  return import(pathToFileURL(cliPath).href);
}

async function loadRpcHelper() {
  expect(existsSync(rpcPath)).toBe(true);
  return import(pathToFileURL(rpcPath).href);
}

describe('global season reset operator CLI', () => {
  it('parses dry-run and execute modes with an optional cutoff', async () => {
    const cli = await loadCli();

    expect(cli.parseResetArgs(['--dry-run'])).toEqual({
      mode: 'dry-run',
      cutoff: null,
    });
    expect(cli.parseResetArgs(['--execute', '--cutoff', '2026-06-26T12:00:00Z'])).toEqual({
      mode: 'execute',
      cutoff: '2026-06-26T12:00:00Z',
    });
    expect(cli.parseResetArgs(['--dry-run', '--at', '2026-06-26T12:00:00Z'])).toEqual({
      mode: 'dry-run',
      cutoff: '2026-06-26T12:00:00Z',
    });
  });

  it('rejects ambiguous or incomplete operator arguments', async () => {
    const cli = await loadCli();

    expect(() => cli.parseResetArgs([])).toThrow(/Choose exactly one/);
    expect(() => cli.parseResetArgs(['--dry-run', '--execute'])).toThrow(/Choose exactly one/);
    expect(() => cli.parseResetArgs(['--dry-run', '--cutoff'])).toThrow(/requires a timestamp/);
    expect(() => cli.parseResetArgs(['--dry-run', '--cutoff', 'not-a-date'])).toThrow(/valid ISO timestamp/);
  });

  it('maps parsed args to the correct reset RPC call', async () => {
    const cli = await loadCli();

    expect(cli.buildResetRpcCall({ mode: 'dry-run', cutoff: null })).toEqual({
      rpcName: 'preview_global_season_reset',
      params: {},
    });
    expect(
      cli.buildResetRpcCall({
        mode: 'execute',
        cutoff: '2026-06-26T12:00:00Z',
      }),
    ).toEqual({
      rpcName: 'execute_global_season_reset',
      params: {
        p_confirm: true,
        p_reset_at: '2026-06-26T12:00:00Z',
      },
    });
  });

  it('requires explicit operator Supabase environment variables', async () => {
    const rpc = await loadRpcHelper();

    expect(() => rpc.readOperatorEnv({})).toThrow(/BSPLIC_OPERATOR_SUPABASE_URL/);
    expect(() =>
      rpc.readOperatorEnv({
        BSPLIC_OPERATOR_SUPABASE_URL: 'https://example.supabase.co',
      }),
    ).toThrow(/BSPLIC_OPERATOR_SERVICE_ROLE_KEY/);
    expect(
      rpc.readOperatorEnv({
        BSPLIC_OPERATOR_SUPABASE_URL: 'https://example.supabase.co/',
        BSPLIC_OPERATOR_SERVICE_ROLE_KEY: 'service-role-key',
      }),
    ).toEqual({
      serviceRoleKey: 'service-role-key',
      url: 'https://example.supabase.co',
    });
  });
});
