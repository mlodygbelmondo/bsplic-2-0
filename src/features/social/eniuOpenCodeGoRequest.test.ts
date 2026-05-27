import { describe, expect, it } from 'vitest';

import { buildOpenCodeGoRequestBody } from '../../../supabase/functions/_shared/openCodeGoRequest';

describe('buildOpenCodeGoRequestBody', () => {
  const messages = [
    { role: 'system', content: 'system' },
    { role: 'user', content: '@Eniu dawaj typ' },
  ];

  it('keeps reasoning enabled while excluding reasoning text from the response', () => {
    expect(
      buildOpenCodeGoRequestBody({
        model: 'kimi-k2.6',
        messages,
        maxTokens: 16000,
      }),
    ).toMatchObject({
      model: 'kimi-k2.6',
      messages,
      stream: true,
      max_tokens: 16000,
      include_reasoning: false,
      reasoning: {
        enabled: true,
        exclude: true,
      },
      thinking: {
        type: 'enabled',
      },
    });
  });

  it('does not add Kimi thinking controls to non-Kimi models', () => {
    const body = buildOpenCodeGoRequestBody({
      model: 'openai/gpt-5-mini',
      messages,
      maxTokens: 16000,
    });

    expect(body).toMatchObject({
      reasoning: {
        enabled: true,
        exclude: true,
      },
    });
    expect(body).not.toHaveProperty('thinking');
  });
});
