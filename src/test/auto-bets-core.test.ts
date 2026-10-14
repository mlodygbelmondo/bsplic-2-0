import { describe, expect, it } from 'vitest';

import {
  buildCandidate,
  decideSettlement,
  displayTeamName,
  isPolymarketSource,
  selectCandidates,
  type Candidate,
  type GammaEvent,
  type GammaMarket,
  type PolymarketOddsSource,
} from '../../supabase/functions/auto-bets/core';
import type { LeagueConfig } from '../../supabase/functions/auto-bets/leagues';

const NOW = new Date('2026-10-14T10:00:00Z');
const START = '2026-10-15T18:30:00Z';

const ekstraklasa: LeagueConfig = {
  key: 'pol',
  seriesId: '12320',
  label: 'Ekstraklasa',
  categorySlug: 'football-ekstraklasa',
  titleContext: 'league',
  clubNames: true,
};

const cs2: LeagueConfig = {
  key: 'cs2',
  seriesId: '10310',
  label: 'CS2',
  categorySlug: 'esports-cs2',
  titleContext: 'stage',
  dailyCap: 2,
};

const atp: LeagueConfig = {
  key: 'atp',
  seriesId: '10365',
  label: 'ATP',
  categorySlug: 'tennis-atp',
  titleContext: 'label_and_prefix',
};

function yesNoMarket(id: string, groupItemTitle: string, bid: number, ask: number): GammaMarket {
  return {
    id,
    groupItemTitle,
    outcomes: '["Yes", "No"]',
    outcomePrices: JSON.stringify([String(bid), String(1 - bid)]),
    bestBid: bid,
    bestAsk: ask,
    liquidityNum: 8000,
    sportsMarketType: 'moneyline',
    active: true,
    closed: false,
    acceptingOrders: true,
  };
}

function footballEvent(overrides: Partial<GammaEvent> = {}): GammaEvent {
  return {
    id: '9001',
    slug: 'pol-wid-wis-2026-10-15',
    title: 'Widzew Lodz vs. Wisla Krakow',
    startTime: START,
    // Polymarket lists the away side first here on purpose: order must come
    // from the event title, not from the market list.
    markets: [
      yesNoMarket('m-away', 'Wisla Krakow', 0.31, 0.33),
      yesNoMarket('m-draw', 'Draw (Widzew Lodz vs. Wisla Krakow)', 0.25, 0.27),
      yesNoMarket('m-home', 'Widzew Lodz', 0.41, 0.43),
      { id: 'm-total', sportsMarketType: 'totals', outcomes: '["Over", "Under"]' },
    ],
    ...overrides,
  };
}

function twoWayEvent(title: string, overrides: Partial<GammaMarket> = {}): GammaEvent {
  return {
    id: '7001',
    slug: 'cs2-mibr-bcg-2026-10-15',
    title,
    startTime: START,
    markets: [
      {
        id: 'm-ml',
        outcomes: '["MIBR", "BC.Game Esports"]',
        outcomePrices: '["0.315", "0.685"]',
        bestBid: 0.31,
        bestAsk: 0.32,
        liquidityNum: 50000,
        sportsMarketType: 'moneyline',
        active: true,
        closed: false,
        ...overrides,
      },
    ],
  };
}

function expectCandidate(result: ReturnType<typeof buildCandidate>): Candidate {
  if (result.ok === false) {
    throw new Error(`expected a candidate, got rejection: ${result.reason}`);
  }
  return result.candidate;
}

describe('buildCandidate', () => {
  it('turns a three-way football game into a 1x2 market ordered home, draw, away', () => {
    const { bet } = expectCandidate(buildCandidate(footballEvent(), ekstraklasa, { now: NOW }));

    expect(bet.title).toBe('Ekstraklasa: Widzew Łódź - Wisła Kraków');
    expect(bet.bet_type).toBe('1x2');
    // Midpoints .42 / .26 / .32 priced with a 6% margin.
    expect(bet.options).toEqual([
      { name: 'Widzew Łódź', odds: 2.25 },
      { name: 'Remis', odds: 3.63 },
      { name: 'Wisła Kraków', odds: 2.95 },
    ]);
    expect(bet.ends_at).toBe(START.replace('Z', '.000Z'));
    expect(bet.agent_metadata.event_starts_at).toBe(bet.ends_at);
    expect(bet.agent_duplicate_key).toBe('pm:9001:moneyline');
    expect(bet.agent_metadata.odds_source.outcomes.map((o) => [o.option, o.market_id, o.outcome_index])).toEqual([
      ['Widzew Łódź', 'm-home', 0],
      ['Remis', 'm-draw', 0],
      ['Wisła Kraków', 'm-away', 0],
    ]);
  });

  it('turns a head-to-head game into a 12 market titled with the esports stage', () => {
    const event = twoWayEvent(
      'Counter-Strike: MIBR vs BC.Game Esports (BO3) - Thunderpick World Championship Group A',
    );
    const { bet } = expectCandidate(buildCandidate(event, cs2, { now: NOW }));

    expect(bet.title).toBe('Thunderpick World Championship Group A: MIBR - BC.Game Esports (BO3)');
    expect(bet.bet_type).toBe('12');
    // Midpoint .315 for MIBR, .685 for the other side, 6% margin.
    expect(bet.options).toEqual([
      { name: 'MIBR', odds: 2.99 },
      { name: 'BC.Game Esports', odds: 1.38 },
    ]);
    expect(bet.agent_metadata.odds_source.outcomes.map((o) => o.outcome_index)).toEqual([0, 1]);
  });

  it('prefixes tennis tournaments with the tour', () => {
    const event = twoWayEvent('Catania: Pavel Lagutin vs Massimo Giunta', {
      outcomes: '["Pavel Lagutin", "Massimo Giunta"]',
    });
    const { bet } = expectCandidate(buildCandidate(event, atp, { now: NOW }));

    expect(bet.title).toBe('ATP Catania: Pavel Lagutin - Massimo Giunta');
  });

  it.each([
    ['starts too soon', { startTime: '2026-10-14T12:00:00Z' }, {}],
    ['starts too late', { startTime: '2026-10-16T12:00:00Z' }, {}],
    ['liquidity too low', {}, { liquidityNum: 400 }],
    ['spread too wide', {}, { bestBid: 0.25, bestAsk: 0.38 }],
    ['too lopsided', {}, { bestBid: 0.95, bestAsk: 0.96 }],
    ['market not open for trading', {}, { closed: true }],
  ])('rejects games that %s', (reason, eventOverrides, marketOverrides) => {
    const event = { ...twoWayEvent('Counter-Strike: A vs B (BO1)', marketOverrides), ...eventOverrides };

    expect(buildCandidate(event, cs2, { now: NOW })).toEqual({ ok: false, reason });
  });
});

describe('displayTeamName', () => {
  it('strips football legal affixes but leaves esports organisations alone', () => {
    expect(displayTeamName('SSC Napoli', true)).toBe('Napoli');
    expect(displayTeamName('Parma Calcio 1913', true)).toBe('Parma');
    expect(displayTeamName('FC Bayern München', true)).toBe('Bayern Monachium');
    expect(displayTeamName('AC Milan', true)).toBe('AC Milan');
    expect(displayTeamName('SK Gaming')).toBe('SK Gaming');
  });
});

describe('selectCandidates', () => {
  function candidate(id: string, liquidity: number, startsAt = START): Candidate {
    const { bet } = expectCandidate(
      buildCandidate(
        { ...twoWayEvent('Counter-Strike: A vs B (BO1)'), id, startTime: startsAt },
        cs2,
        { now: NOW },
      ),
    );
    return { leagueKey: 'cs2', categorySlug: 'esports-cs2', liquidity, bet };
  }

  const categories = new Map([['esports-cs2', 'cat-cs2']]);

  it('fills the daily cap with the most liquid games after counting published ones', () => {
    const published = [{ categoryId: 'cat-cs2', eventKey: 'pm:1', startsAt: START }];
    const { selected, capped } = selectCandidates(
      [candidate('1', 90_000), candidate('2', 5_000), candidate('3', 60_000)],
      [cs2],
      published,
      categories,
    );

    expect(selected.map((c) => c.bet.event_key)).toEqual(['pm:3']);
    expect(capped.map((c) => c.bet.event_key)).toEqual(['pm:2']);
  });

  it('applies the cap per Warsaw calendar day', () => {
    // 22:30 UTC on the 15th is already the 16th in Warsaw.
    const { selected } = selectCandidates(
      [candidate('1', 3), candidate('2', 2), candidate('3', 1), candidate('4', 1, '2026-10-15T22:30:00Z')],
      [cs2],
      [],
      categories,
    );

    expect(selected.map((c) => c.bet.event_key).sort()).toEqual(['pm:1', 'pm:2', 'pm:4']);
  });

  it('counts already settled markets of the day toward the cap', () => {
    // Two games of the same Warsaw day were published and already settled.
    const published = [
      { categoryId: 'cat-cs2', eventKey: 'pm:old-1', startsAt: '2026-10-15T09:00:00Z' },
      { categoryId: 'cat-cs2', eventKey: 'pm:old-2', startsAt: '2026-10-15T11:00:00Z' },
    ];
    const { selected } = selectCandidates([candidate('9', 50_000)], [cs2], published, categories);

    expect(selected).toEqual([]);
  });
});

describe('decideSettlement', () => {
  const threeWay: PolymarketOddsSource = {
    provider: 'polymarket',
    league: 'pol',
    event_id: '9001',
    event_slug: 'pol-wid-wis-2026-10-15',
    url: 'https://polymarket.com/event/pol-wid-wis-2026-10-15',
    kind: '1x2',
    margin: 0.06,
    observed_at: NOW.toISOString(),
    outcomes: [
      { option: 'Widzew Łódź', market_id: 'm-home', outcome_index: 0, probability: 0.42 },
      { option: 'Remis', market_id: 'm-draw', outcome_index: 0, probability: 0.26 },
      { option: 'Wisła Kraków', market_id: 'm-away', outcome_index: 0, probability: 0.32 },
    ],
  };

  const twoWay: PolymarketOddsSource = {
    ...threeWay,
    kind: '12',
    outcomes: [
      { option: 'MIBR', market_id: 'm-ml', outcome_index: 0, probability: 0.3 },
      { option: 'BC.Game Esports', market_id: 'm-ml', outcome_index: 1, probability: 0.7 },
    ],
  };

  function resolved(entries: Record<string, [string, string]>, status = 'resolved') {
    return new Map(
      Object.entries(entries).map(([id, prices]) => [
        id,
        { id, closed: true, umaResolutionStatus: status, outcomePrices: JSON.stringify(prices) },
      ]),
    );
  }

  it('settles a 1x2 market on the outcome whose Yes resolved to 1', () => {
    const markets = resolved({ 'm-home': ['0', '1'], 'm-draw': ['1', '0'], 'm-away': ['0', '1'] });

    expect(decideSettlement(threeWay, markets)).toEqual({ action: 'settle', winningOption: 'Remis' });
  });

  it('settles a 12 market on the second outcome', () => {
    expect(decideSettlement(twoWay, resolved({ 'm-ml': ['0', '1'] }))).toEqual({
      action: 'settle',
      winningOption: 'BC.Game Esports',
    });
  });

  it('refunds a game Polymarket voided at 50/50', () => {
    expect(decideSettlement(twoWay, resolved({ 'm-ml': ['0.5', '0.5'] })).action).toBe('refund');
  });

  it('waits while Polymarket has not marked the market resolved', () => {
    const noStatus = new Map([['m-ml', { id: 'm-ml', closed: true, outcomePrices: '["1", "0"]' }]]);

    expect(decideSettlement(twoWay, noStatus).action).toBe('wait');
  });

  it('waits while any market is open or still in dispute', () => {
    const partial = resolved({ 'm-home': ['1', '0'], 'm-draw': ['0', '1'] });
    expect(decideSettlement(threeWay, partial).action).toBe('wait');
    expect(decideSettlement(twoWay, resolved({ 'm-ml': ['1', '0'] }, 'disputed')).action).toBe('wait');
  });

  it('holds instead of guessing when two outcomes resolved as winners', () => {
    const markets = resolved({ 'm-home': ['1', '0'], 'm-draw': ['1', '0'], 'm-away': ['0', '1'] });

    expect(decideSettlement(threeWay, markets).action).toBe('hold');
  });
});

describe('isPolymarketSource', () => {
  const base = {
    provider: 'polymarket',
    event_id: '1',
    url: 'https://polymarket.com/event/x',
    kind: '12',
    outcomes: [
      { option: 'A', market_id: 'm', outcome_index: 0 },
      { option: 'B', market_id: 'm', outcome_index: 1 },
    ],
  };

  it('accepts the mapping the bot writes and rejects incomplete or damaged ones', () => {
    expect(isPolymarketSource(base)).toBe(true);
    expect(isPolymarketSource({ ...base, outcomes: [base.outcomes[0]] })).toBe(false);
    expect(isPolymarketSource({ ...base, outcomes: [base.outcomes[0], null] })).toBe(false);
    expect(isPolymarketSource({ ...base, kind: '1x2' })).toBe(false);
  });
});
