import { describe, expect, it } from 'vitest';

import { canRetryRun, diagnosticChips, runStatusLabel } from './eniu-runs';

describe('diagnosticChips', () => {
  it('shows sanitized provider diagnostics like the web run log', () => {
    // Fixture from the web `EniuBotTab.test.tsx`.
    expect(
      diagnosticChips({
        model: 'kimi-k2.6',
        stream: true,
        maxTokens: 16000,
        reasoningPresent: false,
        contentPresent: true,
        contentChars: 34,
      }),
    ).toEqual(['kimi-k2.6', 'stream', '16k', 'reasoning: nie', 'content: tak']);
  });

  it('omits missing model, stream and token chips but always reports reasoning and content', () => {
    expect(diagnosticChips({ maxTokens: 'lots', stream: 'yes' })).toEqual([
      'reasoning: nie',
      'content: nie',
    ]);
  });
});

describe('runStatusLabel', () => {
  it('maps statuses to Polish labels', () => {
    expect(runStatusLabel('success')).toBe('Sukces');
    expect(runStatusLabel('skipped')).toBe('Pominięto');
    expect(runStatusLabel('error')).toBe('Błąd');
    expect(runStatusLabel('pending')).toBe('W toku');
  });
});

describe('canRetryRun', () => {
  it('allows retrying only failed post and comment runs', () => {
    expect(canRetryRun({ status: 'error', sourceType: 'comment' })).toBe(true);
    expect(canRetryRun({ status: 'error', sourceType: 'post' })).toBe(true);
    expect(canRetryRun({ status: 'error', sourceType: 'command' })).toBe(false);
    expect(canRetryRun({ status: 'success', sourceType: 'comment' })).toBe(false);
  });
});
