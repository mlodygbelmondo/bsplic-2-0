import { describe, expect, it } from 'vitest';

import { buildOpenCodeGoRequestBody } from '../../../supabase/functions/_shared/openCodeGoRequest';

describe('buildOpenCodeGoRequestBody', () => {
  const messages = [
    { role: 'system', content: 'system' },
    { role: 'user', content: '@Eniu dawaj typ' },
  ];

  it('builds a provider-compatible streaming chat completion body', () => {
    expect(
      buildOpenCodeGoRequestBody({
        model: 'kimi-k2.6',
        messages,
        maxTokens: 16000,
      }),
    ).toEqual({
      model: 'kimi-k2.6',
      messages,
      stream: true,
      max_tokens: 16000,
    });
  });

  it('does not send provider-specific reasoning controls rejected by OpenCodeGo', () => {
    const body = buildOpenCodeGoRequestBody({
      model: 'kimi-k2.6',
      messages,
      maxTokens: 16000,
    });

    expect(body).not.toHaveProperty('include_reasoning');
    expect(body).not.toHaveProperty('reasoning');
    expect(body).not.toHaveProperty('thinking');
  });
});
