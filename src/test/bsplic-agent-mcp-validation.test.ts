import { describe, expect, it } from 'vitest';
import {
  validateBets,
  validateSettlements,
  type AgentBetInput,
} from '../../supabase/functions/bsplic-agent-mcp/validation';

const now = new Date('2026-09-01T00:00:00Z');

function validBet(): AgentBetInput {
  return {
    title: 'Polska - Niemcy — zwycięzca meczu',
    bet_type: '12',
    options: [
      { name: 'Polska', odds: 2.1 },
      { name: 'Niemcy', odds: 1.75 },
    ],
    ends_at: '2026-09-02T18:00:00Z',
    event_key: 'football:pol-ger:2026-09-02',
    agent_duplicate_key: 'football:pol-ger:12:2026-09-02',
    ako_ref: 'pol-ger-12',
    agent_metadata: {
      odds_source: {
        bookmaker: 'Example Bookmaker',
        url: 'https://example.com/pol-ger',
        observed_at: '2026-08-31T23:30:00Z',
        prices: { Polska: 2.1, Niemcy: 1.75 },
      },
    },
  };
}

describe('validateBets', () => {
  it('accepts a sourced future market', () => {
    expect(validateBets([validBet()], now)).toEqual([]);
  });

  it('rejects stale or rewritten prices and short betting windows', () => {
    const bet = validBet();
    bet.ends_at = '2026-09-01T01:00:00Z';
    bet.options[0].odds = 3;
    bet.agent_metadata.odds_source.observed_at = '2026-08-31T12:00:00Z';

    expect(validateBets([bet], now)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('at least 2 hours'),
        expect.stringContaining('last 6 hours'),
        expect.stringContaining('exactly match'),
      ]),
    );
  });

  it('requires an AKO exclusion between markets from the same event', () => {
    const winner = validBet();
    const goals = validBet();
    goals.title = 'Polska - Niemcy — liczba goli';
    goals.agent_duplicate_key = 'football:pol-ger:goals:2026-09-02';
    goals.ako_ref = 'pol-ger-goals';

    expect(validateBets([winner, goals], now)).toEqual([
      expect.stringContaining('require an AKO exclusion'),
    ]);

    winner.ako_exclusions = [{ ref: goals.ako_ref, reason: 'ten sam mecz' }];
    expect(validateBets([winner, goals], now)).toEqual([]);
  });
});

describe('validateSettlements', () => {
  it('accepts an explicit hold without evidence', () => {
    expect(
      validateSettlements([
        { bet_id: 'bet-id', hold: true, reason: 'wynik prywatnego zakładu' },
      ]),
    ).toEqual([]);
  });

  it('requires high-confidence public evidence for settlement', () => {
    expect(
      validateSettlements([
        {
          bet_id: 'bet-id',
          winning_options: ['Polska'],
          evidence: { sources: [], confidence: 'medium', note: '' },
        },
      ]),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining('public result source'),
        expect.stringContaining('confidence must be high'),
        expect.stringContaining('verified final result'),
      ]),
    );
  });
});
