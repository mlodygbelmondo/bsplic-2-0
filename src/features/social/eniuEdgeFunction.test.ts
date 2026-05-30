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

  it('keeps the OpenCodeGo request body provider-compatible', () => {
    const source = readFileSync(openCodeGoRequestPath, 'utf8');

    expect(source).toContain('stream: true');
    expect(source).toContain('max_tokens: input.maxTokens');
    expect(source).not.toContain('include_reasoning');
    expect(source).not.toContain('reasoning:');
    expect(source).not.toContain('thinking:');
  });

  it('keeps reply generation on a small output budget and retries transient provider failures', () => {
    const source = readFileSync(eniuSharedPath, 'utf8');

    expect(source).toContain('const ENIU_REPLY_MAX_TOKENS = 1200');
    expect(source).toContain('const ENIU_REPLY_RETRY_MAX_TOKENS = 2400');
    expect(source).toContain('isTransientOpenCodeGoStatus');
    expect(source).toContain('await runAttempt(ENIU_REPLY_MAX_TOKENS)');
    expect(source).toContain('await runAttempt(ENIU_REPLY_RETRY_MAX_TOKENS)');
    expect(source).not.toContain('runAttempt(16000)');
    expect(source).not.toContain('runAttempt(32000)');
  });
});
