import { createStore, useStore } from 'zustand';

import type {
  RouletteBetRecord,
  RouletteRecentWin,
  RouletteRoundParticipant,
  RouletteTableRound,
} from '@/types/database';

import type { RouletteHistory } from '../api/queries';

/**
 * Live state of the shared roulette table (web `useRouletteTable` state). One
 * table, one screen: a module store lets the screen, its small ticker
 * components and the stake sheet subscribe to exactly the slice they render.
 * It is reset whenever the table screen mounts, so a live round is never shown
 * from a previous visit; only past spins and wins are seeded from the cache.
 */
export interface RouletteTableState {
  currentRound: RouletteTableRound | null;
  recentSpins: RouletteTableRound[];
  recentWins: RouletteRecentWin[];
  activeBets: RouletteBetRecord[];
  roundParticipants: RouletteRoundParticipant[];
  /** The player's bets in the newest settled round. */
  lastSettledBets: RouletteBetRecord[];
  isLoading: boolean;
  isRefreshing: boolean;
  isPlacingBet: boolean;
  tableMessage: string | null;
}

export function createInitialTableState(history?: RouletteHistory | null): RouletteTableState {
  return {
    currentRound: null,
    recentSpins: history?.recentSpins ?? [],
    recentWins: history?.recentWins ?? [],
    activeBets: [],
    roundParticipants: [],
    lastSettledBets: [],
    isLoading: true,
    isRefreshing: false,
    isPlacingBet: false,
    tableMessage: null,
  };
}

export const rouletteTableStore = createStore<RouletteTableState>(() => createInitialTableState());

export function useRouletteTable<T>(selector: (state: RouletteTableState) => T): T {
  return useStore(rouletteTableStore, selector);
}

/** Web `isIdle`: the first snapshot arrived and no round is waiting or spinning. */
export const selectIsIdle = (state: RouletteTableState) => !state.isLoading && !state.currentRound;
