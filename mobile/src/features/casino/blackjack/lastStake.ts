import { kv } from '@/lib/storage';

/** Web key `bsplic.blackjack.lastStake`: drives the stake default and "Graj ponownie (N zł)". */
const LAST_STAKE_KEY = 'bsplic.blackjack.lastStake';

export function readLastStake(): string {
  const value = Number(kv.getString(LAST_STAKE_KEY));
  return Number.isFinite(value) && value > 0 ? String(value) : '10';
}

export function storeLastStake(stake: number): void {
  kv.set(LAST_STAKE_KEY, String(stake));
}
