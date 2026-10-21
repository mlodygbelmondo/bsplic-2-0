import { describe, expect, it } from 'vitest';

import type { Bet } from '@/types/database';

import {
  applyBetsRealtimePayloads,
  applyBetsRealtimeToPages,
  type BetRow,
  type BetsRealtimePayload,
} from './bets-realtime';

function createBetRow(overrides: Partial<BetRow>): BetRow {
  return {
    id: 'bet-1',
    title: 'Test bet',
    category_id: 'cat-1',
    bet_type: '12',
    options: [
      { name: 'A', odds: 1.8 },
      { name: 'B', odds: 2.1 },
    ],
    ends_at: '2030-01-01T12:00:00.000Z',
    is_live: false,
    is_bsplicboost: false,
    is_active: true,
    winning_option: null,
    bet_count: 0,
    created_at: '2030-01-01T10:00:00.000Z',
    agent_duplicate_key: null,
    agent_metadata: {},
    event_key: null,
    ...overrides,
  };
}

function createBet(overrides: Partial<BetRow>): Bet {
  return createBetRow(overrides) as unknown as Bet;
}

function createPayload(params: {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  newRow?: Partial<BetRow>;
  oldRow?: Partial<BetRow>;
}): BetsRealtimePayload {
  return {
    schema: 'public',
    table: 'bets',
    commit_timestamp: '2030-01-01T12:00:00.000Z',
    eventType: params.eventType,
    new: createBetRow(params.newRow ?? {}),
    old: createBetRow(params.oldRow ?? {}),
    errors: null,
  } as unknown as BetsRealtimePayload;
}

describe('applyBetsRealtimePayloads', () => {
  it('updates existing bet_count without duplicating the bet row', () => {
    const initial = [createBet({ id: 'bet-1', bet_count: 10 })];

    const payload = createPayload({
      eventType: 'UPDATE',
      newRow: { id: 'bet-1', bet_count: 11 },
      oldRow: { id: 'bet-1', bet_count: 10 },
    });

    const result = applyBetsRealtimePayloads(initial, [payload], null);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('bet-1');
    expect(result[0].bet_count).toBe(11);
  });

  it('applies batched updates in order and keeps latest state', () => {
    const initial = [createBet({ id: 'bet-1', bet_count: 10 })];

    const firstUpdate = createPayload({
      eventType: 'UPDATE',
      newRow: { id: 'bet-1', bet_count: 11 },
      oldRow: { id: 'bet-1', bet_count: 10 },
    });
    const secondUpdate = createPayload({
      eventType: 'UPDATE',
      newRow: { id: 'bet-1', bet_count: 12 },
      oldRow: { id: 'bet-1', bet_count: 11 },
    });

    const result = applyBetsRealtimePayloads(initial, [firstUpdate, secondUpdate], null);

    expect(result).toHaveLength(1);
    expect(result[0].bet_count).toBe(12);
  });

  it('removes bet from list when update moves it outside selected category', () => {
    const initial = [createBet({ id: 'bet-1', category_id: 'cat-1' })];

    const payload = createPayload({
      eventType: 'UPDATE',
      newRow: { id: 'bet-1', category_id: 'cat-2' },
      oldRow: { id: 'bet-1', category_id: 'cat-1' },
    });

    const result = applyBetsRealtimePayloads(initial, [payload], 'cat-1');

    expect(result).toEqual([]);
  });

  it('ignores inserts outside selected category', () => {
    const payload = createPayload({
      eventType: 'INSERT',
      newRow: { id: 'bet-2', category_id: 'cat-2' },
    });

    const result = applyBetsRealtimePayloads([], [payload], 'cat-1');

    expect(result).toEqual([]);
  });

  it('ignores already expired inserts', () => {
    const payload = createPayload({
      eventType: 'INSERT',
      newRow: { id: 'bet-expired', ends_at: '2020-01-01T12:00:00.000Z' },
    });

    const result = applyBetsRealtimePayloads([], [payload], null);

    expect(result).toEqual([]);
  });

  it('keeps expired bets that are still active when in-progress bets are shown', () => {
    const payload = createPayload({
      eventType: 'INSERT',
      newRow: { id: 'bet-in-progress', ends_at: '2020-01-01T12:00:00.000Z' },
    });

    const result = applyBetsRealtimePayloads([], [payload], null, true);

    expect(result.map((bet) => bet.id)).toEqual(['bet-in-progress']);
  });

  it('removes bet from list when update moves it past the deadline', () => {
    const initial = [createBet({ id: 'bet-1' })];
    const payload = createPayload({
      eventType: 'UPDATE',
      newRow: { id: 'bet-1', ends_at: '2020-01-01T12:00:00.000Z' },
      oldRow: { id: 'bet-1' },
    });

    const result = applyBetsRealtimePayloads(initial, [payload], null);

    expect(result).toEqual([]);
  });
});

describe('applyBetsRealtimeToPages', () => {
  const pages = [
    { bets: [createBet({ id: 'a' }), createBet({ id: 'b' })], hasMore: true },
    { bets: [createBet({ id: 'c' })], hasMore: false },
  ];

  it('adds inserted bets to the last page and keeps the page count', () => {
    const payload = createPayload({ eventType: 'INSERT', newRow: { id: 'new' } });

    const result = applyBetsRealtimeToPages(pages, [payload], null);

    expect(result.map((page) => page.bets.map((bet) => bet.id))).toEqual([['a', 'b'], ['c', 'new']]);
    expect(result.map((page) => page.hasMore)).toEqual([true, false]);
  });

  it('removes deleted bets from whichever page holds them', () => {
    const payload = createPayload({ eventType: 'DELETE', oldRow: { id: 'a' } });

    const result = applyBetsRealtimeToPages(pages, [payload], null);

    expect(result.flatMap((page) => page.bets.map((bet) => bet.id))).toEqual(['b', 'c']);
    expect(result).toHaveLength(2);
  });

  it('returns the same pages when nothing visible changed', () => {
    const payload = createPayload({ eventType: 'INSERT', newRow: { id: 'other', category_id: 'cat-2' } });

    expect(applyBetsRealtimeToPages(pages, [payload], 'cat-1')).toBe(pages);
  });
});
