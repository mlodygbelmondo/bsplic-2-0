/**
 * Port of the web `src/features/slots/model.ts`: game catalogue, server
 * payload validation (the web uses zod; the same constraints are checked by
 * hand here) and the presentation helpers the slot screen uses. The server
 * (`casino_slot_spin` / `casino_slot_bonus_spin`) decides every outcome.
 */

import { roundMoney } from '@/lib/money';

export type SlotGame = 'bandit' | 'candy' | 'ember' | 'tide';

export const SLOT_GAMES = {
  bandit: {
    title: 'Midnight Bandit',
    rule: '5+ jednakowych symboli stykających się bokami',
    offset: 0,
    base: 2.5654,
    multiplierRule:
      'Złote pola zwiększają mnożnik kolejnych trafień do ×5. Grupa używa najwyższego mnożnika swoich pól. Pola zerują się przed nowym obrotem.',
  },
  candy: {
    title: 'Candy Cascade',
    rule: '8+ jednakowych symboli w dowolnych miejscach',
    offset: 8,
    base: 0.2111,
    multiplierRule: 'Każda wygrywająca kaskada losuje mnożnik od ×1 do ×5, z jednakową szansą na każdą wartość.',
  },
  ember: {
    title: 'Ember Forge',
    rule: '5+ jednakowych symboli stykających się bokami',
    offset: 16,
    base: 2.532,
    multiplierRule:
      'Pierwsza wygrywająca kaskada ma mnożnik ×1. Każda następna zwiększa go o 1, maksymalnie do ×5. Nowy obrót zaczyna od ×1.',
  },
  tide: {
    title: 'Pearl Tide',
    rule: '8+ jednakowych symboli w dowolnych miejscach',
    offset: 24,
    base: 0.2108,
    multiplierRule:
      'Każda wygrywająca grupa ma stały mnożnik ×3, również podczas kolejnych kaskad i darmowych obrotów.',
  },
} as const;

export const SLOT_GAME_IDS = Object.keys(SLOT_GAMES) as SlotGame[];

export function isSlotGame(value: string | undefined): value is SlotGame {
  return value !== undefined && Object.prototype.hasOwnProperty.call(SLOT_GAMES, value);
}

export const SYMBOL_NAMES = [
  'Szmaragd',
  'Moneta',
  'Rubin',
  'Szafir',
  'Worek',
  'Klucz',
  'Korona',
  'Szop',
  'Serce',
  'Cukierek',
  'Diament',
  'Winogrona',
  'Banany',
  'Arbuz',
  'Jabłko',
  'Lizak',
  'Żar',
  'Miedź',
  'Rubin',
  'Młot',
  'Podkowa',
  'Eliksir lawy',
  'Smocze jajo',
  'Smok',
  'Perła',
  'Muszla',
  'Koral',
  'Rozgwiazda',
  'Akwamaryn',
  'Kotwica',
  'Trójząb',
  'Łodzik',
];

/** Board symbol 7 is the BONUS scatter; 0–6 pay. */
export const SCATTER_SYMBOL = 7;
export const BOARD_COLUMNS = 6;
export const BOARD_ROWS = 5;

export interface SlotGroup {
  symbol: number;
  cells: number[];
}

export interface SlotFrame {
  board: number[];
  groups: SlotGroup[];
  gold: number[];
  multiplier: number;
  payout: number;
}

export interface SlotSpin {
  id: string;
  game: SlotGame;
  stake: number;
  charged: number;
  payout: number;
  net: number;
  balance: number;
  luckyShot?: boolean;
  freeSpins: number;
  awardedFreeSpins: number;
  frames: SlotFrame[];
  createdAt: string;
}

export interface SlotState {
  freeSpins: number;
  bonusStake: number;
  history: SlotSpin[];
}

export class SlotPayloadError extends Error {
  constructor(path: string) {
    super(`Invalid slot payload at ${path}`);
    this.name = 'SlotPayloadError';
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Json = Record<string, unknown>;

function record(value: unknown, path: string): Json {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new SlotPayloadError(path);
  return value as Json;
}

function finite(value: unknown, path: string, { min, exclusiveMin }: { min?: number; exclusiveMin?: number } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new SlotPayloadError(path);
  if (min !== undefined && value < min) throw new SlotPayloadError(path);
  if (exclusiveMin !== undefined && value <= exclusiveMin) throw new SlotPayloadError(path);
  return value;
}

function integer(value: unknown, path: string, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new SlotPayloadError(path);
  }
  return value;
}

function list(value: unknown, path: string, { length, min, max }: { length?: number; min?: number; max?: number }) {
  if (!Array.isArray(value)) throw new SlotPayloadError(path);
  if (length !== undefined && value.length !== length) throw new SlotPayloadError(path);
  if (min !== undefined && value.length < min) throw new SlotPayloadError(path);
  if (max !== undefined && value.length > max) throw new SlotPayloadError(path);
  return value as unknown[];
}

function parseFrame(value: unknown, path: string): SlotFrame {
  const frame = record(value, path);
  return {
    board: list(frame.board, `${path}.board`, { length: 30 }).map((cell, i) => integer(cell, `${path}.board[${i}]`, 0, 7)),
    groups: list(frame.groups, `${path}.groups`, {}).map((raw, i) => {
      const group = record(raw, `${path}.groups[${i}]`);
      return {
        symbol: integer(group.symbol, `${path}.groups[${i}].symbol`, 0, 6),
        cells: list(group.cells, `${path}.groups[${i}].cells`, {}).map((cell, j) =>
          integer(cell, `${path}.groups[${i}].cells[${j}]`, 0, 29),
        ),
      };
    }),
    gold: list(frame.gold, `${path}.gold`, { length: 30 }).map((cell, i) => integer(cell, `${path}.gold[${i}]`, 0, 4)),
    multiplier: integer(frame.multiplier, `${path}.multiplier`, 1, 5),
    payout: finite(frame.payout, `${path}.payout`, { min: 0 }),
  };
}

/** Validates one spin result (web `spinSchema`). Throws `SlotPayloadError`. */
export function parseSpin(value: unknown, path = 'spin'): SlotSpin {
  const spin = record(value, path);
  if (typeof spin.id !== 'string' || !UUID_PATTERN.test(spin.id)) throw new SlotPayloadError(`${path}.id`);
  if (typeof spin.game !== 'string' || !isSlotGame(spin.game)) throw new SlotPayloadError(`${path}.game`);
  if (spin.luckyShot !== undefined && typeof spin.luckyShot !== 'boolean') throw new SlotPayloadError(`${path}.luckyShot`);
  if (typeof spin.createdAt !== 'string') throw new SlotPayloadError(`${path}.createdAt`);
  return {
    id: spin.id,
    game: spin.game,
    stake: finite(spin.stake, `${path}.stake`, { exclusiveMin: 0 }),
    charged: finite(spin.charged, `${path}.charged`, { min: 0 }),
    payout: finite(spin.payout, `${path}.payout`, { min: 0 }),
    net: finite(spin.net, `${path}.net`),
    balance: finite(spin.balance, `${path}.balance`, { min: 0 }),
    ...(spin.luckyShot !== undefined ? { luckyShot: spin.luckyShot } : null),
    freeSpins: integer(spin.freeSpins, `${path}.freeSpins`, 0, 15),
    awardedFreeSpins: integer(spin.awardedFreeSpins, `${path}.awardedFreeSpins`, 0, 15),
    frames: list(spin.frames, `${path}.frames`, { min: 1, max: 12 }).map((frame, i) => parseFrame(frame, `${path}.frames[${i}]`)),
    createdAt: spin.createdAt,
  };
}

/** Validates `casino_slot_state` (web `stateSchema`). Throws `SlotPayloadError`. */
export function parseState(value: unknown): SlotState {
  const state = record(value, 'state');
  if (typeof state.bonusStake !== 'number' || Number.isNaN(state.bonusStake) || state.bonusStake <= 0) {
    throw new SlotPayloadError('state.bonusStake');
  }
  return {
    freeSpins: integer(state.freeSpins, 'state.freeSpins', 0, 15),
    bonusStake: state.bonusStake,
    history: list(state.history, 'state.history', { max: 10 }).map((spin, i) => parseSpin(spin, `state.history[${i}]`)),
  };
}

export const INITIAL_FRAME: SlotFrame = {
  board: Array.from({ length: 30 }, (_, i) => (i * 3 + Math.floor(i / 6)) % 7),
  groups: [],
  gold: Array<number>(30).fill(0),
  multiplier: 1,
  payout: 0,
};

/** The idle board before the first spin (Pearl Tide always shows ×3). */
export function idleFrame(game: SlotGame): SlotFrame {
  return { ...INITIAL_FRAME, multiplier: game === 'tide' ? 3 : 1 };
}

const NBSP = ' ';

/**
 * Web `value.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })`:
 * decimal comma, and a no-break space between thousands from five integer
 * digits up (Polish minimum grouping). Written out so it does not depend on
 * the JS engine's Intl data.
 */
export function money(value: number): string {
  const fixed = Math.abs(value).toFixed(2);
  const [whole, fraction] = fixed.split('.');
  const grouped = whole.length >= 5 ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP) : whole;
  const negative = value < 0 && Number(fixed) !== 0;
  return `${negative ? '-' : ''}${grouped},${fraction}`;
}

/** Signed money as the web renders net values: `+` for gains, `-` from `money`. */
export function signedMoney(value: number): string {
  return `${value > 0 ? '+' : ''}${money(value)}`;
}

export function resultLabel(net: number) {
  return net > 0 ? 'Zysk' : net < 0 ? 'Strata' : 'Na zero';
}

export type NetTone = 'positive' | 'negative' | 'neutral';

export function netTone(net: number): NetTone {
  return net > 0 ? 'positive' : net < 0 ? 'negative' : 'neutral';
}

/** Paytable value for the minimal group before multipliers (web `SlotRules`). */
export function paytableMultiplier(game: SlotGame, symbol: number): string {
  const value = SLOT_GAMES[game].base * (1 + symbol * 0.25);
  return `${String(Number(value.toFixed(6))).replace('.', ',')}×`;
}

export type SymbolSheet = 'symbols' | 'forgeTide';

export interface SymbolSprite {
  sheet: SymbolSheet;
  column: number;
  row: number;
  name: string;
}

/** Sprite cell of a board symbol in the 4 × 4 symbol sheets (web `SlotSymbol`). */
export function symbolSprite(game: SlotGame, symbol: number): SymbolSprite {
  const globalIndex = SLOT_GAMES[game].offset + symbol;
  const index = globalIndex % 16;
  return {
    sheet: globalIndex >= 16 ? 'forgeTide' : 'symbols',
    column: index % 4,
    row: Math.floor(index / 4),
    name: SYMBOL_NAMES[globalIndex],
  };
}

const STAKE_PATTERN = /^\d+(?:[.,]\d{1,2})?$/;

/** Stake typed by the player: digits with up to two decimals (dot or comma), minimum 1. */
export function parseStakeInput(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!STAKE_PATTERN.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : null;
}

/** Stake after the − / + buttons (web keeps at least 1). */
export function steppedStake(parsed: number | null, delta: -1 | 1): string {
  return String(Math.max(1, roundMoney((parsed ?? (delta < 0 ? 1 : 0)) + delta)));
}

export const SLOT_ERROR_MESSAGES: Record<string, string> = {
  INSUFFICIENT_BALANCE: 'Za mało środków. Zmniejsz stawkę.',
  BONUS_STAKE_LOCKED: 'Darmowe obroty zachowują stawkę z momentu zdobycia bonusu.',
  INVALID_STAKE: 'Wpisz poprawną stawkę minimum 1 zł.',
  BONUS_FINISHED: 'Bonus został już rozegrany. Odśwież grę.',
  AUTH_REQUIRED: 'Zaloguj się ponownie.',
};

export const SPIN_UNCONFIRMED_MESSAGE = 'Nie udało się potwierdzić obrotu. Ponów sprawdzenie tego samego obrotu.';
export const INVALID_STAKE_MESSAGE = 'Wpisz poprawną stawkę minimum 1 zł.';
export const BALANCE_REFRESH_FAILED_MESSAGE = 'Nie udało się odświeżyć salda.';

export function slotErrorMessage(message: string): string {
  return SLOT_ERROR_MESSAGES[message] ?? SPIN_UNCONFIRMED_MESSAGE;
}

/** PostgREST codes after which the request id can never succeed (raised exception / missing function). */
export function isFinalSpinError(code: string | undefined): boolean {
  return code === 'P0001' || code === 'PGRST202';
}

/** How long each cascade frame stays on screen (web `SlotsPage` timer). */
export function frameDuration(groupCount: number, reducedMotion: boolean): number {
  if (reducedMotion) return 60;
  return groupCount > 0 ? 1100 : 450;
}

/** Delay before the next automatic bonus spin. */
export const BONUS_AUTOPLAY_DELAY = 900;

export interface PendingSpin {
  id: string;
  stake: number;
  bonusOnly: boolean;
}

export function pendingKey(userId: string, game: SlotGame) {
  return `bsplic:slot-pending:v1:${userId}:${game}`;
}

/** Reads a stored pending request (web `readPending`); anything malformed is ignored. */
export function parsePending(raw: string | undefined | null): PendingSpin | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const { id, stake, bonusOnly } = value as Json;
    if (typeof id !== 'string' || !UUID_PATTERN.test(id)) return null;
    if (typeof stake !== 'number' || !Number.isFinite(stake) || stake < 1) return null;
    if (bonusOnly !== undefined && typeof bonusOnly !== 'boolean') return null;
    return { id, stake, bonusOnly: bonusOnly ?? false };
  } catch {
    return null;
  }
}

export interface MachineInputs {
  stakeInput: string;
  /** Free spins left: the last confirmed spin wins over an older state refetch. */
  freeSpins: number;
  bonusStake: number | undefined;
  pending: PendingSpin | null;
  balance: number;
  busy: boolean;
  animating: boolean;
  stopped: boolean;
  stateReady: boolean;
  stateError: boolean;
  offline: boolean;
}

export interface MachineView {
  parsedStake: number | null;
  /** Stake the next request uses; null while the typed stake is invalid. */
  actualStake: number | null;
  stakeValue: number;
  stakeInputInvalid: boolean;
  /** Board animating or a request in flight. */
  disabled: boolean;
  stakeLocked: boolean;
  canDecrease: boolean;
  canIncrease: boolean;
  canSpin: boolean;
  spinLabel: string;
  /** Cost shown under the controls (free spins cost nothing). */
  spinCost: number;
  /** Text in the stake field. */
  stakeText: string;
}

/** Derived machine state, mirroring the web `SlotMachine` render logic. */
export function deriveMachine(input: MachineInputs): MachineView {
  const { freeSpins, pending, busy, animating } = input;
  const parsedStake = parseStakeInput(input.stakeInput);
  const actualStake = pending?.stake ?? (freeSpins > 0 ? (input.bonusStake ?? null) : parsedStake);
  const stakeValue = actualStake ?? 0;
  const disabled = busy || animating;
  const stakeLocked = disabled || freeSpins > 0 || Boolean(pending);
  return {
    parsedStake,
    actualStake,
    stakeValue,
    stakeInputInvalid: freeSpins === 0 && !pending && parsedStake === null,
    disabled,
    stakeLocked,
    canDecrease: !stakeLocked && parsedStake !== null && parsedStake > 1,
    canIncrease: !stakeLocked && parsedStake !== null,
    canSpin:
      !disabled &&
      !input.stopped &&
      !input.offline &&
      input.stateReady &&
      !input.stateError &&
      actualStake !== null &&
      (Boolean(pending) || freeSpins > 0 || input.balance >= actualStake),
    spinLabel: busy
      ? 'LOSOWANIE'
      : animating
        ? 'KASKADA'
        : pending
          ? 'SPRAWDŹ OBRÓT'
          : freeSpins > 0
            ? 'DARMOWY OBRÓT'
            : 'ZAKRĘĆ',
    spinCost: freeSpins > 0 ? 0 : stakeValue,
    stakeText: pending || freeSpins > 0 ? String(stakeValue) : input.stakeInput,
  };
}

export interface AutoplayInputs {
  freeSpins: number;
  paused: boolean;
  stopped: boolean;
  disabled: boolean;
  pending: boolean;
  error: boolean;
  stateReady: boolean;
  stateError: boolean;
  /** Screen focused, app in the foreground and online. */
  visible: boolean;
}

/** Whether the next free spin should be scheduled (web bonus autoplay effect). */
export function shouldAutoplayBonus(input: AutoplayInputs): boolean {
  return (
    input.freeSpins > 0 &&
    !input.paused &&
    !input.stopped &&
    !input.disabled &&
    !input.pending &&
    !input.error &&
    input.stateReady &&
    !input.stateError &&
    input.visible
  );
}

export interface SessionTotals {
  spins: number;
  net: number;
}

export function addToSession(session: SessionTotals, net: number): SessionTotals {
  return { spins: session.spins + 1, net: Math.round((session.net + net) * 100) / 100 };
}

/** Cells that belong to a winning group in this frame. */
export function winningCells(frame: SlotFrame): Set<number> {
  return new Set(frame.groups.flatMap((group) => group.cells));
}
