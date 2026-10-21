import { kv } from '@/lib/storage';
import type { RouletteBetType } from '@/types/database';

/** Last chosen bet type (web `bsplic_roulette_bet_type_v1`, same key and values). */
const ROULETTE_BET_TYPE_KEY = 'bsplic_roulette_bet_type_v1';

const ROULETTE_BET_TYPES: RouletteBetType[] = ['straight', 'color', 'parity', 'range'];

export function getStoredRouletteBetType(): RouletteBetType | null {
  const stored = kv.getString(ROULETTE_BET_TYPE_KEY);
  return stored && ROULETTE_BET_TYPES.includes(stored as RouletteBetType) ? (stored as RouletteBetType) : null;
}

export function storeRouletteBetType(value: RouletteBetType) {
  kv.set(ROULETTE_BET_TYPE_KEY, value);
}
