import { create } from 'zustand';

import type { RouletteBetType } from '@/types/database';

import { getStoredRouletteBetType, storeRouletteBetType } from '../lib/preferences';
import {
  deriveLastSettled,
  getLatestUserWin,
  getRouletteWinKey,
  type LastSettledBets,
  type RouletteWin,
} from '../lib/rouletteGame';
import type { RouletteTableState } from './tableStore';

/**
 * Player-side roulette state (web `RouletteGame` local state): the bet
 * selection and stake shared by the table screen and the stake sheet, plus
 * the win banner and "repeat bets" bookkeeping. Reset each time the table
 * screen mounts, like the web component state.
 */
export interface RouletteSessionState {
  betType: RouletteBetType | '';
  betValue: string;
  stake: string;
  /** The value grid animates only after the player switches the bet type (web `initial={false}`). */
  betTypeChanged: boolean;
  isRepeating: boolean;
  isSharingWin: boolean;
  lastSettled: LastSettledBets | null;
  latestWin: RouletteWin | null;
  latestWinKey: string | null;
  dismissedWinKey: string | null;
  sharedWinKeys: ReadonlySet<string>;
  /** Bumped for every newly announced win; the confetti layer replays on change. */
  winBurst: number;
  /** The stake sheet covers the table; the table keeps syncing while it is open. */
  stakeSheetOpen: boolean;
}

const initialSession = (): RouletteSessionState => ({
  betType: getStoredRouletteBetType() ?? 'straight',
  betValue: '',
  stake: '10',
  betTypeChanged: false,
  isRepeating: false,
  isSharingWin: false,
  lastSettled: null,
  latestWin: null,
  latestWinKey: null,
  dismissedWinKey: null,
  sharedWinKeys: new Set(),
  winBurst: 0,
  stakeSheetOpen: false,
});

export const useRouletteSession = create<RouletteSessionState>(() => initialSession());

/** Rounds the player bet on during this visit; only their wins are announced (web `pendingWinRoundIdsRef`). */
const pendingWinRoundIds = new Set<string>();
const announcedWinKeys = new Set<string>();

export const rouletteSession = {
  reset() {
    pendingWinRoundIds.clear();
    announcedWinKeys.clear();
    useRouletteSession.setState(initialSession());
  },

  setBetType(value: RouletteBetType) {
    storeRouletteBetType(value);
    useRouletteSession.setState({ betType: value, betValue: '', betTypeChanged: true });
  },

  setBetValue(value: string) {
    useRouletteSession.setState({ betValue: value });
  },

  setStake(value: string) {
    useRouletteSession.setState({ stake: value });
  },

  setStakeSheetOpen(open: boolean) {
    useRouletteSession.setState({ stakeSheetOpen: open });
  },

  trackBetRound(roundId: string) {
    pendingWinRoundIds.add(roundId);
  },

  forgetBetRound(roundId: string) {
    pendingWinRoundIds.delete(roundId);
  },

  dismissWin(key: string | null) {
    useRouletteSession.setState({ dismissedWinKey: key });
  },

  markWinShared(key: string, shared: boolean) {
    const next = new Set(useRouletteSession.getState().sharedWinKeys);
    if (shared) next.add(key);
    else next.delete(key);
    useRouletteSession.setState({ sharedWinKeys: next });
  },

  /**
   * Reacts to a table change (web `RouletteGame` effects): keeps the last
   * settled bets for the result strip and announces each new win once.
   * Returns true when a new win was announced so the caller plays the chime.
   */
  syncWithTable(table: RouletteTableState, userId: string): boolean {
    const session = useRouletteSession.getState();
    const lastSettled = deriveLastSettled(session.lastSettled, table.activeBets, table.currentRound, table.recentSpins);
    const latestWin = getLatestUserWin({
      activeBets: table.activeBets,
      recentWins: table.recentWins,
      userId,
      pendingRoundIds: pendingWinRoundIds,
    });
    const latestWinKey = latestWin ? getRouletteWinKey(latestWin) : null;

    const patch: Partial<RouletteSessionState> = {};
    if (lastSettled !== session.lastSettled) patch.lastSettled = lastSettled;
    if (latestWinKey !== session.latestWinKey) {
      patch.latestWin = latestWin;
      patch.latestWinKey = latestWinKey;
    }

    let announced = false;
    if (latestWinKey && !announcedWinKeys.has(latestWinKey)) {
      announcedWinKeys.add(latestWinKey);
      if (session.dismissedWinKey && session.dismissedWinKey !== latestWinKey) patch.dismissedWinKey = null;
      patch.winBurst = session.winBurst + 1;
      announced = true;
    }

    if (Object.keys(patch).length > 0) useRouletteSession.setState(patch);
    return announced;
  },
};

/** Web `showWinBanner`. */
export const selectShowWinBanner = (state: RouletteSessionState) =>
  state.latestWin !== null &&
  state.latestWin.payout > 0 &&
  state.latestWinKey !== null &&
  state.latestWinKey !== state.dismissedWinKey &&
  !state.sharedWinKeys.has(state.latestWinKey);
