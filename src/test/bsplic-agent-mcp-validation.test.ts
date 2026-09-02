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
      event_starts_at: '2026-09-02T18:00:00Z',
      schedule_source: {
        provider: 'Example League',
        url: 'https://example.com/schedule/pol-ger',
        observed_at: '2026-08-31T23:20:00Z',
        displayed_start: '2 September 2026, 20:00',
        timezone: 'Europe/Warsaw',
      },
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
    bet.agent_metadata.event_starts_at = '2026-09-01T01:00:00Z';
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

  it('rejects moving the close time one day past the verified event start', () => {
    const bet = validBet();
    bet.title = 'La Liga: Barcelona - Rayo Vallecano';
    bet.ends_at = '2026-09-01T19:30:00Z';
    bet.agent_metadata.event_starts_at = '2026-08-31T19:30:00Z';
    bet.agent_metadata.schedule_source = {
      provider: 'LaLiga',
      url: 'https://www.laliga.com/match/barcelona-rayo',
      observed_at: '2026-08-31T23:27:00Z',
      displayed_start: 'LUN 31.08.2026 21:30 h',
      timezone: 'Europe/Madrid',
    };

    expect(validateBets([bet], new Date('2026-08-31T23:28:00Z'))).toEqual(
      expect.arrayContaining([
        expect.stringContaining('never postpone ends_at'),
        expect.stringContaining('must exactly equal'),
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
