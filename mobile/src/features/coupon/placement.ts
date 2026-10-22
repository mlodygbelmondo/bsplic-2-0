import type { CouponItem } from '@/types/database';
import { getErrorMessage, isOutcomeUnknown } from '@/lib/errors';
import { pluralPl } from '@/lib/format';
import { floorMoney, roundMoney } from '@/lib/money';

/**
 * Pure coupon placement rules, ported from the web's `useCouponPlacement`
 * and `CouponDrawer`. No React, storage or network imports so it runs in
 * vitest; the hook and the sheet wire it to the stores and the RPC.
 */

export type CouponTab = 'single' | 'ako';

export const DEFAULT_STAKE = '10';
export const STAKE_PRESETS = ['5', '10', '25', '50'] as const;

export const UNCONFIRMED_PLACEMENT_MESSAGE =
  'Nie udało się potwierdzić kuponu. Postaw go jeszcze raz bez zmian: nie zostanie przyjęty dwa razy.';

export interface PlaceCouponParams {
  userId: string;
  totalOdds: number;
  stake: number;
  items: {
    betId: string;
    selectedOption: string;
    odds: number;
    stake: number;
  }[];
  /** Same id, same coupon: the server places it once however many times it is sent. */
  requestId: string;
}

export type PlaceCouponSecure = (params: PlaceCouponParams) => Promise<string>;

/**
 * Request ids per placement call. An attempt whose outcome stayed unknown
 * keeps its id, so placing the same coupon again is a safe retry: the server
 * returns the coupon the first call created instead of charging twice. A
 * changed coupon (other picks or stakes) gets a new id.
 */
export function createRequestIdStore(createId: () => string) {
  const pending = new Map<string, string>();
  return {
    idFor(key: string): string {
      const id = pending.get(key) ?? createId();
      pending.set(key, id);
      return id;
    },
    settle(key: string) {
      pending.delete(key);
    },
  };
}

export type RequestIdStore = ReturnType<typeof createRequestIdStore>;

/** The server refused a coupon whose odds changed since the player saw them (`p_check_odds`). */
export function isOddsChangedError(error: unknown): boolean {
  return (error as { hint?: unknown } | null)?.hint === 'odds_changed';
}

export function parseStake(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return roundMoney(parsed);
}

export function isPositiveStakeInput(value: string): boolean {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

export function validateStakePrecision(value: string): boolean {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed === roundMoney(parsed);
}

/** Splits the AKO stake in cents; the first `total mod n` legs get one extra cent. */
export function distributeStakeAcrossItems(totalStake: number, itemCount: number): number[] {
  if (itemCount <= 0) return [];

  const totalCents = Math.round(totalStake * 100);
  const baseCents = Math.floor(totalCents / itemCount);
  const remainder = totalCents % itemCount;

  return Array.from({ length: itemCount }, (_, index) => (baseCents + (index < remainder ? 1 : 0)) / 100);
}

function productOfOdds(items: CouponItem[]): number {
  return items.reduce((product, item) => product * item.odds, 1);
}

export function getTotalStake(
  activeTab: CouponTab,
  items: CouponItem[],
  stake: string,
  singleStakes: Record<string, string>,
): number {
  if (activeTab === 'ako') return parseStake(stake);
  return items.reduce((sum, item) => roundMoney(sum + parseStake(singleStakes[item.bet.id] || '')), 0);
}

/** AKO: product of the coupon odds. Singles: always 1. */
export function getEffectiveTotalOdds(activeTab: CouponTab, items: CouponItem[]): number {
  return activeTab === 'ako' ? productOfOdds(items) : 1;
}

export function getPotentialWin(
  activeTab: CouponTab,
  items: CouponItem[],
  stake: string,
  singleStakes: Record<string, string>,
): number {
  if (activeTab === 'ako') return roundMoney(parseStake(stake) * productOfOdds(items));
  return items.reduce(
    (sum, item) => roundMoney(sum + parseStake(singleStakes[item.bet.id] || '') * item.odds),
    0,
  );
}

/** Web `2x` preset: doubles a valid stake (dropping a trailing `.00`), otherwise resets to 10. */
export function doubleStake(stake: string): string {
  const current = Number(stake);
  if (!Number.isFinite(current) || current <= 0) return DEFAULT_STAKE;
  return (current * 2).toFixed(2).replace(/\.00$/, '');
}

/** Web `Max` preset: the balance floored to cents. */
export function maxStakeFor(balance: number): string {
  return floorMoney(balance).toString();
}

/** Drawer header label. */
export function eventsLabel(count: number): string {
  return pluralPl(count, ['zdarzenie', 'zdarzenia', 'zdarzeń']);
}

/** Stake inputs accept the Polish decimal comma from the native keypad. */
export function normalizeStakeInput(value: string): string {
  return value.replace(/,/g, '.');
}

export interface SubmitCouponInput {
  userId: string;
  balance: number;
  activeTab: CouponTab;
  stake: string;
  singleStakes: Record<string, string>;
  items: CouponItem[];
}

export type SubmitCouponResult =
  | { status: 'invalid'; message: string }
  | { status: 'placed'; chargedStake: number }
  /** `placedBetIds` are singles the server accepted before the failing one. */
  | { status: 'failed'; message: string; placedBetIds: string[]; chargedStake: number; oddsChanged: boolean };

/** Client checks in the web's order; returns the toast message or null. */
export function validateCoupon(input: SubmitCouponInput): string | null {
  const { activeTab, items, stake, singleStakes, balance } = input;

  if (items.length === 0) return 'Dodaj co najmniej jedno zdarzenie do kuponu';

  if (activeTab === 'single') {
    for (const item of items) {
      const raw = singleStakes[item.bet.id] || '';
      if (!isPositiveStakeInput(raw)) return 'Uzupełnij stawkę dla każdego zakładu';
      if (!validateStakePrecision(raw)) return 'Stawka może mieć maksymalnie 2 miejsca po przecinku';
    }
  } else {
    if (!isPositiveStakeInput(stake)) return 'Stawka musi być większa od 0';
    if (!validateStakePrecision(stake)) return 'Stawka może mieć maksymalnie 2 miejsca po przecinku';
  }

  const totalStake = getTotalStake(activeTab, items, stake, singleStakes);
  if (totalStake <= 0) return 'Stawka musi być większa od 0';
  if (totalStake > balance) return `Niewystarczające środki (saldo: ${balance.toFixed(2)} zł)`;

  return null;
}

export interface SubmitCouponDeps {
  place: PlaceCouponSecure;
  requestIds: RequestIdStore;
  /** Runs right before the first RPC. */
  onSending?: () => void;
}

/**
 * Places one coupon under its request id. A lost response is retried once at
 * once (the id makes that safe); an id whose outcome is still unknown is kept
 * for the player's next attempt.
 */
async function placeWithRequestId(
  { place, requestIds }: SubmitCouponDeps,
  params: Omit<PlaceCouponParams, 'requestId'>,
): Promise<string> {
  const key = JSON.stringify([
    params.userId,
    params.stake,
    params.items.map((item) => [item.betId, item.selectedOption, item.stake]),
  ]);
  const request = { ...params, requestId: requestIds.idFor(key) };
  try {
    const couponId = await place(request).catch((error: unknown) => {
      if (!isOutcomeUnknown(error)) throw error;
      return place(request);
    });
    requestIds.settle(key);
    return couponId;
  } catch (error) {
    if (!isOutcomeUnknown(error)) requestIds.settle(key);
    throw error;
  }
}

/**
 * Validates and places the coupon: one RPC per single (in order, stopping at
 * the first failure) or one RPC for the whole AKO.
 */
export async function submitCoupon(input: SubmitCouponInput, deps: SubmitCouponDeps): Promise<SubmitCouponResult> {
  const invalid = validateCoupon(input);
  if (invalid) return { status: 'invalid', message: invalid };

  const { userId, activeTab, items, stake, singleStakes } = input;
  const totalStake = getTotalStake(activeTab, items, stake, singleStakes);
  const placedBetIds: string[] = [];
  let chargedStake = 0;

  deps.onSending?.();

  try {
    if (activeTab === 'single') {
      for (const item of items) {
        const itemStake = parseStake(singleStakes[item.bet.id] || '');
        await placeWithRequestId(deps, {
          userId,
          totalOdds: 1,
          stake: itemStake,
          items: [{ betId: item.bet.id, selectedOption: item.selectedOption, odds: item.odds, stake: itemStake }],
        });
        placedBetIds.push(item.bet.id);
        chargedStake = roundMoney(chargedStake + itemStake);
      }
    } else {
      const legStakes = distributeStakeAcrossItems(totalStake, items.length);
      await placeWithRequestId(deps, {
        userId,
        totalOdds: getEffectiveTotalOdds('ako', items),
        stake: totalStake,
        items: items.map((item, index) => ({
          betId: item.bet.id,
          selectedOption: item.selectedOption,
          odds: item.odds,
          stake: legStakes[index],
        })),
      });
      chargedStake = totalStake;
    }
    return { status: 'placed', chargedStake };
  } catch (error) {
    return {
      status: 'failed',
      // A dropped connection, even after the retry, leaves the outcome unknown: the server may have placed it.
      message: isOutcomeUnknown(error)
        ? UNCONFIRMED_PLACEMENT_MESSAGE
        : getErrorMessage(error, 'Nie udało się postawić kuponu'),
      placedBetIds,
      chargedStake,
      oddsChanged: isOddsChangedError(error),
    };
  }
}
