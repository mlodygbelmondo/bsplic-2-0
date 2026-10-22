import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import type { BetOption } from '@/types/database';

import { couponActions, useCouponStore, type CouponOddsChange } from './coupon-store';
import { useCouponSheetStore } from './coupon-sheet-store';

/**
 * Keeps the coupon's odds current. The server prices a coupon at the odds it
 * holds; the app sends the odds the player saw and the server refuses the
 * coupon when they differ, so the coupon follows every odds change (realtime
 * bet updates, opening the coupon, a refused placement) and says so.
 */

/** Options of a `bets` row; null when the JSON is not a list of named odds. */
export function parseBetOptions(value: unknown): BetOption[] | null {
  if (!Array.isArray(value)) return null;
  const options: BetOption[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') return null;
    const { name, odds } = entry as { name?: unknown; odds?: unknown };
    const parsed = Number(odds);
    if (typeof name !== 'string' || !Number.isFinite(parsed)) return null;
    options.push({ name, odds: parsed });
  }
  return options;
}

export function toBetOdds(rows: { id?: unknown; options?: unknown }[]): { id: string; options: BetOption[] }[] {
  return rows.flatMap((row) => {
    const options = parseBetOptions(row.options);
    return typeof row.id === 'string' && options ? [{ id: row.id, options }] : [];
  });
}

const formatOdds = (odds: number) => odds.toFixed(2);

export function describeOddsChanges(changes: CouponOddsChange[]): string {
  return changes.map((change) => `${change.option}: ${formatOdds(change.from)} → ${formatOdds(change.to)}`).join('\n');
}

export function announceOddsChanges(changes: CouponOddsChange[]) {
  toast.warning(changes.length === 1 ? 'Kurs się zmienił' : 'Kursy na kuponie się zmieniły', {
    id: 'coupon-odds',
    description: describeOddsChanges(changes),
  });
}

/**
 * Applies the given bets' odds to the coupon and announces the changes.
 * Waits out a placement in flight: replacing the picks it sent would keep
 * them on the coupon after it is placed.
 */
export function applyCouponOdds(bets: { id: string; options: BetOption[] }[], announce = true): CouponOddsChange[] {
  if (bets.length === 0 || useCouponSheetStore.getState().placing) return [];
  const changes = couponActions.syncOdds(bets);
  if (announce && changes.length > 0) announceOddsChanges(changes);
  return changes;
}

/** Re-reads the odds of every bet on the coupon. */
export async function refreshCouponOdds(announce = true): Promise<CouponOddsChange[]> {
  const ids = useCouponStore.getState().items.map((item) => item.bet.id);
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('bets').select('id, options').in('id', ids);
  if (error) throw error;
  return applyCouponOdds(toBetOdds(data ?? []), announce);
}
