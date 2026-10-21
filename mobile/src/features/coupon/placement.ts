import type { CouponItem } from '@/types/database';
import { getErrorMessage } from '@/lib/errors';

/**
 * Pure coupon placement rules, ported from the web's `useCouponPlacement`
 * and `CouponDrawer`. No React, storage or network imports so it runs in
 * vitest; the hook and the sheet wire it to the stores and the RPC.
 */

export type CouponTab = 'single' | 'ako';

export const DEFAULT_STAKE = '10';
export const STAKE_PRESETS = ['5', '10', '25', '50'] as const;

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
}

export type PlaceCouponSecure = (params: PlaceCouponParams) => Promise<string>;

const roundMoney = (value: number) => Math.round(value * 100) / 100;

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
  return (Math.floor(balance * 100) / 100).toString();
}

/** Drawer header label, exactly as the web counts it. */
export function eventsLabel(count: number): string {
  if (count === 1) return 'zdarzenie';
  if (count < 5) return 'zdarzenia';
  return 'zdarzeń';
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
  | { status: 'failed'; message: string; placedBetIds: string[]; chargedStake: number };

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

/**
 * Validates and places the coupon: one RPC per single (in order, stopping at
 * the first failure) or one RPC for the whole AKO. `onSending` runs right
 * before the first RPC.
 */
export async function submitCoupon(
  input: SubmitCouponInput,
  placeCouponSecure: PlaceCouponSecure,
  onSending?: () => void,
): Promise<SubmitCouponResult> {
  const invalid = validateCoupon(input);
  if (invalid) return { status: 'invalid', message: invalid };

  const { userId, activeTab, items, stake, singleStakes } = input;
  const totalStake = getTotalStake(activeTab, items, stake, singleStakes);
  const placedBetIds: string[] = [];
  let chargedStake = 0;

  onSending?.();

  try {
    if (activeTab === 'single') {
      for (const item of items) {
        const itemStake = parseStake(singleStakes[item.bet.id] || '');
        await placeCouponSecure({
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
      await placeCouponSecure({
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
      message: getErrorMessage(error, 'Nie udało się postawić kuponu'),
      placedBetIds,
      chargedStake,
    };
  }
}
