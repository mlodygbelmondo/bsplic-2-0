import { createStore } from 'zustand/vanilla';

import type {
  BlackjackActionParams,
  BlackjackGameState,
  BlackjackGameStatus,
  BlackjackHandState,
  BlackjackInsuranceStatus,
  BlackjackTableInfo,
  Card,
  PlaceBlackjackBetParams,
} from '../api/blackjack';
import { buildFinaleSteps, calculateHandValue, maskHandsForReveal } from './blackjackReveal';

/**
 * Blackjack table state machine (port of the web `useBlackjack` hook) as a
 * framework-free controller: a vanilla zustand store plus actions. The server
 * is authoritative; the client only orchestrates RPCs, the staged dealer
 * reveal and feedback. State reads are synchronous, so a second tap while an
 * action is in flight is always ignored.
 */

export interface BlackjackSnapshot {
  tableInfo: BlackjackTableInfo;
  currentGame: BlackjackGameState | null;
}

export interface BlackjackApi {
  getTableInfo(params: { userId: string }): Promise<BlackjackTableInfo>;
  getCurrentGame(params: { userId: string }): Promise<BlackjackGameState | null>;
  placeBet(params: PlaceBlackjackBetParams): Promise<BlackjackGameState>;
  hit(params: BlackjackActionParams): Promise<BlackjackGameState>;
  stand(params: BlackjackActionParams): Promise<BlackjackGameState>;
  doubleDown(params: BlackjackActionParams): Promise<BlackjackGameState>;
  split(params: BlackjackActionParams): Promise<BlackjackGameState>;
  takeInsurance(params: BlackjackActionParams): Promise<BlackjackGameState>;
  declineInsurance(params: BlackjackActionParams): Promise<BlackjackGameState>;
}

/** Where the snapshot lives between visits (a non-persisted query cache entry). */
export interface BlackjackSnapshotCache {
  read(): BlackjackSnapshot | undefined;
  write(snapshot: BlackjackSnapshot): void;
  remove(): void;
}

export type SettledStatus = 'won' | 'lost' | 'push';
export type BlackjackSound = 'card' | 'flip' | 'chip' | SettledStatus;
export type BlackjackHaptic = 'card' | 'bust' | 'blackjack' | SettledStatus;

export interface BlackjackGameDeps {
  userId: string;
  api: BlackjackApi;
  cache: BlackjackSnapshotCache;
  refreshProfile: () => Promise<void>;
  sound: (kind: BlackjackSound) => void;
  haptic: (kind: BlackjackHaptic) => void;
  onError: (message: string) => void;
  /**
   * A round landed its result. `offscreen` is true when it settled while the
   * screen was in the background (no reveal, sound or haptics were played).
   */
  onSettled?: (status: SettledStatus, info: { offscreen: boolean }) => void;
}

export interface BlackjackState {
  playerHand: Card[];
  playerHands: BlackjackHandState[];
  activeHandIndex: number;
  dealerHand: Card[];
  dealerHiddenCount: number;
  status: BlackjackGameStatus;
  stake: number;
  gameId: string | null;
  tableInfo: BlackjackTableInfo | null;
  /** First load without a cached table: the whole game shows a loading pill. */
  isLoading: boolean;
  /** Background refresh: dealing and actions wait for it. */
  isSyncing: boolean;
  /** Bet request in flight. */
  isDealing: boolean;
  /** Action request in flight. */
  isResolving: boolean;
  /** Staged dealer reveal running. */
  isRevealing: boolean;
  actionMessage: string | null;
  doubleDownUsed: boolean;
  insuranceStatus: BlackjackInsuranceStatus;
  insuranceStake: number;
  insurancePayout: number;
}

type RoundState = Pick<
  BlackjackState,
  | 'playerHand'
  | 'playerHands'
  | 'activeHandIndex'
  | 'dealerHand'
  | 'dealerHiddenCount'
  | 'status'
  | 'stake'
  | 'gameId'
  | 'doubleDownUsed'
  | 'insuranceStatus'
  | 'insuranceStake'
  | 'insurancePayout'
>;

const EMPTY_ROUND: RoundState = {
  playerHand: [],
  playerHands: [],
  activeHandIndex: 0,
  dealerHand: [],
  dealerHiddenCount: 0,
  status: 'betting',
  stake: 0,
  gameId: null,
  doubleDownUsed: false,
  insuranceStatus: 'unavailable',
  insuranceStake: 0,
  insurancePayout: 0,
};

export function isSettledStatus(status: BlackjackGameStatus): status is SettledStatus {
  return status === 'won' || status === 'lost' || status === 'push';
}

function roundFromGame(next: BlackjackGameState): RoundState {
  return {
    gameId: next.id,
    stake: next.stake,
    playerHand: next.playerHand,
    playerHands: next.playerHands,
    activeHandIndex: next.activeHandIndex,
    dealerHand: next.dealerHand,
    dealerHiddenCount: next.dealerHiddenCount,
    status: next.status,
    doubleDownUsed: next.doubleDownUsed,
    insuranceStatus: next.insuranceStatus,
    insuranceStake: next.insuranceStake,
    insurancePayout: next.insurancePayout,
  };
}

function tableInfoFrom(next: BlackjackGameState, previous: BlackjackTableInfo | null): BlackjackTableInfo {
  return {
    deckCount: next.deckCount,
    cardsRemaining: next.cardsRemaining,
    shoeNumber: next.shoeNumber,
    handsPlayed: previous?.handsPlayed ?? 0,
    needsShuffle: next.cardsRemaining < 26,
  };
}

/** A two-card 21 on the only hand. */
function isNaturalDeal(next: BlackjackGameState): boolean {
  if (next.playerHands.length !== 1) return false;
  const cards = next.playerHands[0].cards;
  return cards.length === 2 && calculateHandValue(cards) === 21;
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

interface ActionSpec {
  status: 'playing' | 'insurance';
  message: string;
  chip: boolean;
  call: (params: BlackjackActionParams) => Promise<BlackjackGameState>;
  fallback: string;
  /** Refresh the balance when the round continues (stake changed). */
  refreshWhenOpen: boolean;
  onResponse?: (next: BlackjackGameState, previous: BlackjackState) => void;
}

export function createBlackjackGame(deps: BlackjackGameDeps) {
  const { userId, api } = deps;

  // A cached table with no game in progress shows straight away while a
  // fresh snapshot loads; dealing waits for it. A game in progress always
  // loads fresh.
  const cached = deps.cache.read();
  const cachedTable = cached && cached.currentGame === null ? cached.tableInfo : null;

  const store = createStore<BlackjackState>(() => ({
    ...EMPTY_ROUND,
    tableInfo: cachedTable,
    isLoading: !cachedTable,
    isSyncing: Boolean(cachedTable),
    isDealing: false,
    isResolving: false,
    isRevealing: false,
    actionMessage: null,
  }));
  const get = store.getState;
  const set = store.setState;

  let alive = false;
  let active = true;
  let online = true;
  let reducedMotion = false;
  let resumeRequested = false;
  let unsubscribe: (() => void) | null = null;
  // Bumping this id cancels any in-flight reveal sequence.
  let revealRun = 0;
  let pendingFinale: BlackjackGameState | null = null;
  let wakeReveal: (() => void) | null = null;

  const isBusy = (s: BlackjackState) =>
    s.isLoading || s.isSyncing || s.isDealing || s.isResolving || s.isRevealing;

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const finish = () => {
        clearTimeout(timer);
        if (wakeReveal === finish) wakeReveal = null;
        resolve();
      };
      const timer = setTimeout(finish, ms);
      wakeReveal = finish;
    });
  }

  function cancelReveal() {
    revealRun += 1;
    pendingFinale = null;
    wakeReveal?.();
  }

  function settle(next: BlackjackGameState, offscreen: boolean) {
    pendingFinale = null;
    set({ ...roundFromGame(next), tableInfo: tableInfoFrom(next, get().tableInfo), actionMessage: null });
    if (!isSettledStatus(next.status)) return;
    if (!offscreen) {
      deps.sound(next.status);
      deps.haptic(next.status);
    }
    deps.onSettled?.(next.status, { offscreen });
  }

  /**
   * Plays the settled state as a staged dealer reveal: keep the game visually
   * undecided, flip the hole card, turn each drawn card with a pause, then
   * land the final result. Resolves once the sequence finished or was
   * cancelled (reset, background, unmount).
   */
  async function playFinale(next: BlackjackGameState, { freshDeal = false } = {}) {
    const runId = ++revealRun;
    const offscreen = !active;
    const steps = buildFinaleSteps(next, { reducedMotion: reducedMotion || offscreen, freshDeal });

    pendingFinale = next;
    set({
      isRevealing: true,
      actionMessage: 'Krupier odkrywa karty...',
      gameId: next.id,
      stake: next.stake,
      status: 'playing',
      playerHands: maskHandsForReveal(next.playerHands),
      playerHand: next.playerHands[0]?.cards ?? next.playerHand,
      activeHandIndex: next.activeHandIndex,
      dealerHand: next.dealerHand.slice(0, 1),
      dealerHiddenCount: 1,
    });

    try {
      for (const step of steps) {
        await sleep(step.delay);
        if (revealRun !== runId) return;

        if (step.settle) {
          settle(next, offscreen);
        } else {
          deps.sound(step.dealerCards === 2 ? 'flip' : 'card');
          deps.haptic('card');
          set({
            dealerHand: next.dealerHand.slice(0, step.dealerCards),
            dealerHiddenCount: step.dealerCards >= 2 ? 0 : 1,
          });
        }
      }
      await deps.refreshProfile();
    } finally {
      if (revealRun === runId) {
        set({ isRevealing: false, actionMessage: null });
      }
    }
  }

  /** The screen left the foreground mid-reveal: land the result at once. */
  function fastForwardReveal() {
    const next = pendingFinale;
    if (!next) return;
    cancelReveal();
    settle(next, true);
    set({ isRevealing: false, actionMessage: null });
  }

  async function load({ quiet = false, keepSettled = false } = {}) {
    set(quiet ? { isSyncing: true } : { isLoading: true });
    try {
      const [tableInfo, currentGame] = await Promise.all([
        api.getTableInfo({ userId }),
        api.getCurrentGame({ userId }),
      ]);
      if (!alive) return;

      deps.cache.write({ tableInfo, currentGame });

      if (currentGame) {
        set({ ...roundFromGame(currentGame), tableInfo: tableInfoFrom(currentGame, tableInfo) });
      } else if (keepSettled && isSettledStatus(get().status)) {
        // A finished round stays on screen after a resume; only the shoe updates.
        set({ tableInfo });
      } else {
        set({ ...EMPTY_ROUND, tableInfo });
      }
    } catch (error) {
      if (alive) deps.onError(messageOf(error, 'Nie udało się wczytać stołu blackjacka'));
    } finally {
      set({ isLoading: false, isSyncing: false });
    }
  }

  /** Runs a queued resume once nothing is loading, dealing or revealing. */
  function maybeResume() {
    if (!resumeRequested || !alive || !active || isBusy(get())) return;
    resumeRequested = false;
    void load({ quiet: true, keepSettled: true });
    void deps.refreshProfile().catch(() => deps.onError('Nie udało się odświeżyć salda.'));
  }

  function requestResume() {
    resumeRequested = true;
    maybeResume();
  }

  async function runAction(spec: ActionSpec) {
    const previous = get();
    if (
      previous.status !== spec.status ||
      !previous.gameId ||
      previous.isResolving ||
      previous.isRevealing ||
      previous.isLoading ||
      previous.isSyncing
    ) {
      return;
    }

    set({ isResolving: true, actionMessage: spec.message });
    if (spec.chip) deps.sound('chip');

    try {
      const next = await spec.call({ gameId: previous.gameId, userId });
      if (!alive) {
        void deps.refreshProfile();
        return;
      }
      spec.onResponse?.(next, previous);
      if (isSettledStatus(next.status)) {
        await playFinale(next);
      } else {
        set({ ...roundFromGame(next), tableInfo: tableInfoFrom(next, get().tableInfo) });
        if (spec.refreshWhenOpen) await deps.refreshProfile();
      }
    } catch (error) {
      if (alive) deps.onError(messageOf(error, spec.fallback));
    } finally {
      set({ isResolving: false, actionMessage: null });
    }
  }

  /** Card sound plus a haptic tick, or a bust haptic when the acted hand went over 21. */
  function drawFeedback(next: BlackjackGameState, previous: BlackjackState) {
    const acted = next.playerHands[previous.activeHandIndex];
    const busted = calculateHandValue(acted?.cards ?? next.playerHand) > 21;
    deps.sound('card');
    deps.haptic(busted ? 'bust' : 'card');
  }

  return {
    store,

    /** Mount: load the table (quietly when a cached idle table is showing). */
    start() {
      if (alive) return;
      alive = true;
      unsubscribe = store.subscribe(maybeResume);
      void load({ quiet: get().tableInfo !== null && get().status === 'betting' });
    },

    /** Unmount: leave the cache describing what the next visit may show instantly. */
    stop() {
      if (!alive) return;
      const s = get();
      const busy = s.isDealing || s.isResolving || s.isRevealing;
      if (busy || !s.tableInfo || s.status === 'playing' || s.status === 'insurance') {
        deps.cache.remove();
      } else {
        deps.cache.write({ tableInfo: s.tableInfo, currentGame: null });
      }
      alive = false;
      cancelReveal();
      unsubscribe?.();
      unsubscribe = null;
    },

    /** Screen focus and app foreground. Leaving fast-forwards the reveal; returning resyncs. */
    setActive(next: boolean) {
      if (next === active) return;
      active = next;
      if (next) requestResume();
      else fastForwardReveal();
    },

    /** Reconnecting resyncs the table. */
    setOnline(next: boolean) {
      if (next === online) return;
      online = next;
      if (next) requestResume();
    },

    setReducedMotion(next: boolean) {
      reducedMotion = next;
    },

    requestResume,

    async startGame(amount: number) {
      const s = get();
      if (s.isLoading || s.isSyncing || s.isDealing || s.isResolving || s.isRevealing) return;
      set({ isDealing: true, actionMessage: 'Rozdawanie kart...' });
      deps.sound('chip');
      try {
        const next = await api.placeBet({ userId, stake: amount });
        if (!alive) {
          void deps.refreshProfile();
          return;
        }
        deps.sound('card');
        deps.haptic(isNaturalDeal(next) ? 'blackjack' : 'card');
        if (isSettledStatus(next.status)) {
          await playFinale(next, { freshDeal: true });
        } else {
          set({ ...roundFromGame(next), tableInfo: tableInfoFrom(next, get().tableInfo) });
          await deps.refreshProfile();
        }
      } catch (error) {
        if (alive) deps.onError(messageOf(error, 'Nie udało się rozpocząć gry'));
      } finally {
        set({ isDealing: false, actionMessage: null });
      }
    },

    hit: () =>
      runAction({
        status: 'playing',
        message: 'Dobieranie karty...',
        chip: false,
        call: api.hit,
        fallback: 'Nie udało się dobrać karty',
        refreshWhenOpen: false,
        onResponse: drawFeedback,
      }),

    stand: () =>
      runAction({
        status: 'playing',
        message: 'Krupier dobiera...',
        chip: false,
        call: api.stand,
        fallback: 'Nie udało się zakończyć gry',
        refreshWhenOpen: true,
      }),

    split: () =>
      runAction({
        status: 'playing',
        message: 'Rozdzielanie ręki...',
        chip: true,
        call: api.split,
        fallback: 'Nie udało się rozdzielić kart',
        refreshWhenOpen: true,
        onResponse: () => {
          deps.sound('card');
          deps.haptic('card');
        },
      }),

    doubleDown() {
      const s = get();
      const currentHand = s.playerHands[s.activeHandIndex] ?? null;
      if (currentHand?.doubleDownUsed || s.playerHand.length !== 2) return Promise.resolve();
      return runAction({
        status: 'playing',
        message: 'Double Down...',
        chip: true,
        call: api.doubleDown,
        fallback: 'Nie udało się podwoić stawki',
        refreshWhenOpen: true,
        onResponse: drawFeedback,
      });
    },

    takeInsurance: () =>
      runAction({
        status: 'insurance',
        message: 'Sprawdzanie blackjacka...',
        chip: true,
        call: api.takeInsurance,
        fallback: 'Nie udało się ubezpieczyć zakładu',
        refreshWhenOpen: true,
      }),

    declineInsurance: () =>
      runAction({
        status: 'insurance',
        message: 'Sprawdzanie blackjacka...',
        chip: false,
        call: api.declineInsurance,
        fallback: 'Nie udało się odrzucić ubezpieczenia',
        refreshWhenOpen: false,
      }),

    /** "Zmień stawkę": back to the betting panel. */
    resetGame() {
      cancelReveal();
      set({ ...EMPTY_ROUND, isRevealing: false });
    },
  };
}

export type BlackjackGame = ReturnType<typeof createBlackjackGame>;
