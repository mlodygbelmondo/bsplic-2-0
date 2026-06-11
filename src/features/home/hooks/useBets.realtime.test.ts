import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import type { Database } from '@/integrations/supabase/types';
import type { Bet } from '@/types/database';

import { applyBetsRealtimePayloads } from './useBets';

type BetRow = Database['public']['Tables']['bets']['Row'];

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
}): RealtimePostgresChangesPayload<BetRow> {
  return {
    schema: 'public',
    table: 'bets',
    commit_timestamp: '2030-01-01T12:00:00.000Z',
    eventType: params.eventType,
    new: createBetRow(params.newRow ?? {}),
    old: createBetRow(params.oldRow ?? {}),
    errors: null,
  } as unknown as RealtimePostgresChangesPayload<BetRow>;
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

    const result = applyBetsRealtimePayloads(
      initial,
      [firstUpdate, secondUpdate],
      null,
    );

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
      newRow: {
        id: 'bet-expired',
        ends_at: '2020-01-01T12:00:00.000Z',
      },
    });

    const result = applyBetsRealtimePayloads([], [payload], null);

    expect(result).toEqual([]);
  });

  it('removes bet from list when update moves it past the deadline', () => {
    const initial = [createBet({ id: 'bet-1' })];
    const payload = createPayload({
      eventType: 'UPDATE',
      newRow: {
        id: 'bet-1',
        ends_at: '2020-01-01T12:00:00.000Z',
      },
      oldRow: {
        id: 'bet-1',
      },
    });

    const result = applyBetsRealtimePayloads(initial, [payload], null);

    expect(result).toEqual([]);
  });
});
