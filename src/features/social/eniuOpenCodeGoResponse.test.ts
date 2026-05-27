import { describe, expect, it } from 'vitest';

import {
  describeOpenCodeGoShape,
  extractOpenCodeGoResultFromText,
  extractOpenCodeGoText,
  isOpenCodeGoResultComplete,
  shouldRetryOpenCodeGoResult,
} from '../../../supabase/functions/_shared/openCodeGoResponse';

describe('extractOpenCodeGoText', () => {
  it('reads plain chat completion content', () => {
    expect(
      extractOpenCodeGoText({
        choices: [{ message: { content: 'Siadamy na under, bez spiny.' } }],
      }),
    ).toBe('Siadamy na under, bez spiny.');
  });

  it('reads array chat completion content parts', () => {
    expect(
      extractOpenCodeGoText({
        choices: [
          {
            message: {
              content: [
                { type: 'text', text: 'Dla mnie value jest ' },
                { type: 'output_text', text: 'po stronie gospodarzy.' },
              ],
            },
          },
        ],
      }),
    ).toBe('Dla mnie value jest po stronie gospodarzy.');
  });

  it('ignores reasoning parts when output text is present', () => {
    expect(
      extractOpenCodeGoText({
        choices: [
          {
            message: {
              content: [
                { type: 'reasoning', text: 'private chain of thought' },
                { type: 'text', text: 'Gram ostrożnie, ale kurs ma sens.' },
              ],
            },
          },
        ],
      }),
    ).toBe('Gram ostrożnie, ale kurs ma sens.');
  });

  it('reads streaming-style delta content', () => {
    expect(
      extractOpenCodeGoText({
        choices: [{ delta: { content: 'Jestem, tylko kursy mi mrugają.' } }],
      }),
    ).toBe('Jestem, tylko kursy mi mrugają.');
  });

  it('reads SSE final content while ignoring returned reasoning deltas', () => {
    const result = extractOpenCodeGoResultFromText(
      [
        'data: {"choices":[{"delta":{"reasoning_content":"private chain of thought"}}],"usage":{"completion_tokens_details":{"reasoning_tokens":22}}}',
        '',
        'data: {"choices":[{"delta":{"content":"Gram ostrożnie, "}}]}',
        '',
        'data: {"choices":[{"delta":{"content":"ale kurs ma sens."},"finish_reason":"stop"}]}',
        '',
        'data: [DONE]',
      ].join('\n'),
    );

    expect(result.text).toBe('Gram ostrożnie, ale kurs ma sens.');
    expect(result.diagnostic).toMatchObject({
      contentPresent: true,
      reasoningPresent: true,
      reasoningTokens: 22,
      finishReason: 'stop',
    });
    expect(JSON.stringify(result.diagnostic)).not.toContain(
      'private chain of thought',
    );
  });

  it('diagnoses reasoning-only responses without exposing reasoning text', () => {
    const result = extractOpenCodeGoResultFromText(
      JSON.stringify({
        model: 'kimi-k2.6',
        provider: 'openrouter',
        choices: [
          {
            finish_reason: 'length',
            message: {
              role: 'assistant',
              content: null,
              reasoning: 'private chain of thought',
              reasoning_details: [{ type: 'reasoning.text', text: 'secret' }],
            },
          },
        ],
        usage: {
          completion_tokens_details: {
            reasoning_tokens: 450,
          },
        },
      }),
    );

    expect(result.text).toBeNull();
    expect(result.diagnostic).toMatchObject({
      model: 'kimi-k2.6',
      provider: 'openrouter',
      contentPresent: false,
      reasoningPresent: true,
      reasoningTokens: 450,
      reasoningDetailCount: 1,
      finishReason: 'length',
    });
    expect(JSON.stringify(result.diagnostic)).not.toContain(
      'private chain of thought',
    );
    expect(JSON.stringify(result.diagnostic)).not.toContain('secret');
  });

  it('retries when excluded reasoning used tokens but no final content arrived', () => {
    const result = extractOpenCodeGoResultFromText(
      JSON.stringify({
        choices: [
          {
            finish_reason: 'length',
            message: {
              role: 'assistant',
              content: null,
            },
          },
        ],
        usage: {
          completion_tokens_details: {
            reasoning_tokens: 15900,
          },
        },
      }),
    );

    expect(result.diagnostic).toMatchObject({
      contentPresent: false,
      reasoningPresent: false,
      reasoningTokens: 15900,
      finishReason: 'length',
    });
    expect(shouldRetryOpenCodeGoResult(result)).toBe(true);
  });

  it('does not treat partial content with length finish as complete', () => {
    const result = extractOpenCodeGoResultFromText(
      [
        'data: {"choices":[{"delta":{"content":"To wygląda jak dobry"}}]}',
        '',
        'data: {"choices":[{"finish_reason":"length","delta":{}}]}',
        '',
        'data: [DONE]',
      ].join('\n'),
    );

    expect(result.text).toBe('To wygląda jak dobry');
    expect(isOpenCodeGoResultComplete(result)).toBe(false);
    expect(shouldRetryOpenCodeGoResult(result)).toBe(true);
  });

  it('rejects streamed provider errors even when partial text arrived', () => {
    const result = extractOpenCodeGoResultFromText(
      [
        'data: {"choices":[{"delta":{"content":"Nie publikuj tego"}}]}',
        '',
        'data: {"choices":[{"finish_reason":"error","delta":{}}]}',
        '',
        'data: [DONE]',
      ].join('\n'),
    );

    expect(result.text).toBe('Nie publikuj tego');
    expect(isOpenCodeGoResultComplete(result)).toBe(false);
    expect(shouldRetryOpenCodeGoResult(result)).toBe(false);
  });

  it('reads nested provider response fields', () => {
    expect(
      extractOpenCodeGoText({
        result: { response: { message: 'Daj kupon, to go rozbroimy.' } },
      }),
    ).toBe('Daj kupon, to go rozbroimy.');
  });

  it('reads provider-specific value and reply fields', () => {
    expect(
      extractOpenCodeGoText({
        payload: {
          reply: {
            value: 'Jestem, bukmacherka nie śpi.',
          },
        },
      }),
    ).toBe('Jestem, bukmacherka nie śpi.');
  });

  it('describes response shape without including text values', () => {
    expect(
      describeOpenCodeGoShape({
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
            },
          },
        ],
        debug: 'secret text should not be copied',
      }),
    ).toBe(
      'root{choices,debug} choices[1] choice{message} message{role,content} content:null',
    );
  });
});
