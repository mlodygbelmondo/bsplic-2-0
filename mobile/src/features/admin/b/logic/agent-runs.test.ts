import { describe, expect, it } from 'vitest';

import { numberFromSummary, presentationFor, runHistorySummary, type AgentRun } from './agent-runs';

describe('numberFromSummary', () => {
  it('reads the first numeric key, or the length of an array value', () => {
    expect(numberFromSummary({ skipped_count: 4 }, ['skipped', 'skipped_count'])).toBe(4);
    expect(numberFromSummary({ errors: ['a', 'b'], error_count: 9 }, ['errors', 'error_count'])).toBe(2);
  });

  it('returns 0 for missing keys and non-object summaries', () => {
    expect(numberFromSummary({ errors: 'many' }, ['errors'])).toBe(0);
    expect(numberFromSummary(null, ['errors'])).toBe(0);
    expect(numberFromSummary([1, 2], ['errors'])).toBe(0);
  });
});

describe('presentationFor', () => {
  it('labels known statuses and falls back to the raw status', () => {
    expect(presentationFor('partial')).toEqual({ label: 'Częściowy', tone: 'partial' });
    expect(presentationFor('failed').label).toBe('Błąd');
    expect(presentationFor('cancelled')).toEqual({ label: 'cancelled', tone: 'unknown' });
  });
});

describe('runHistorySummary', () => {
  it('describes counts and summary errors', () => {
    const run: AgentRun = {
      id: 'run-1',
      kind: 'daily',
      status: 'ok',
      started_at: '2030-01-01T10:00:00.000Z',
      finished_at: null,
      created_count: 3,
      settled_count: 5,
      held_count: 1,
      summary: { error_count: 2 },
      report: null,
    };
    expect(runHistorySummary(run)).toBe(
      '+3 dodanych, 5 rozliczonych, 1 wstrzymanych, 2 błędów',
    );
  });
});
