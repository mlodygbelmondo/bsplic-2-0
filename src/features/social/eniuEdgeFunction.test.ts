import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const eniuSharedPath = resolve(
  process.cwd(),
  'supabase/functions/_shared/eniu.ts',
);
const openCodeGoRequestPath = resolve(
  process.cwd(),
  'supabase/functions/_shared/openCodeGoRequest.ts',
);

describe('Eniu Edge Function configuration', () => {
  it('defaults to the raw OpenCode Go Kimi K2.6 model id', () => {
    const source = readFileSync(eniuSharedPath, 'utf8');

    expect(source).toContain(
      'Deno.env.get("OPENCODEGO_MODEL") ?? "kimi-k2.6"',
    );
  });

  it('guards against posting model analysis or prompt leakage', () => {
    const source = readFileSync(eniuSharedPath, 'utf8');

    expect(source).toContain('looksLikeMetaResponse');
    expect(source).toContain('Generated text leaked model reasoning');
    expect(source).toContain('the user wants me');
    expect(source).toContain('key constraints');
  });

  it('instructs and guards against publishing thinking blocks', () => {
    const source = readFileSync(eniuSharedPath, 'utf8');

    expect(source).toContain('<thinking>');
    expect(source).toContain('<think>');
    expect(source).toContain('finalną treść');
    expect(source).toContain('thinking');
  });

  it('asks the OpenRouter-compatible API to exclude reasoning output', () => {
    const source = readFileSync(openCodeGoRequestPath, 'utf8');

    expect(source).toContain('include_reasoning: false');
    expect(source).toContain('reasoning: {');
    expect(source).toContain('enabled: true');
    expect(source).toContain('exclude: true');
    expect(source).toContain('thinking:');
  });
});
