import type { RouletteBetType } from '@/types/database';

const ROULETTE_BET_TYPE_KEY = 'bsplic_roulette_bet_type_v1';

const ROULETTE_BET_TYPES: RouletteBetType[] = ['straight', 'color', 'parity', 'range'];

export function getStoredRouletteBetType(): RouletteBetType | null {
  if (typeof window === 'undefined') return null;

  const stored = window.localStorage.getItem(ROULETTE_BET_TYPE_KEY);
  return stored && ROULETTE_BET_TYPES.includes(stored as RouletteBetType)
    ? (stored as RouletteBetType)
    : null;
}

export function storeRouletteBetType(value: RouletteBetType) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ROULETTE_BET_TYPE_KEY, value);
}
