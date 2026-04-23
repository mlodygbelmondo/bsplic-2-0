import {
  RouletteBetType,
  RouletteColor,
  RouletteRoundPhase,
} from '@/types/database';

const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

type RouletteBetValueOption = {
  value: string;
  label: string;
};

interface RouletteCountdownRound {
  phase: RouletteRoundPhase;
  betting_closes_at: string;
  spin_started_at?: string | null;
}

interface ValidateRouletteBetInputArgs {
  betType: string;
  betValue: string;
  stake: string | number;
  balance: number;
}

const ROULETTE_BET_OPTIONS: Record<Exclude<RouletteBetType, 'straight'>, RouletteBetValueOption[]> = {
  color: [
    { value: 'red', label: 'Czerwone' },
    { value: 'black', label: 'Czarne' },
  ],
  parity: [
    { value: 'even', label: 'Parzyste' },
    { value: 'odd', label: 'Nieparzyste' },
  ],
  range: [
    { value: 'low', label: '1-18' },
    { value: 'high', label: '19-36' },
  ],
};

export const ROULETTE_BETTING_WINDOW_MS = 15_000;
export const ROULETTE_SPIN_REVEAL_MS = 6_000;

export function getRouletteColor(number: number): RouletteColor {
  if (number === 0) return 'green';
  return RED_NUMBERS.has(number) ? 'red' : 'black';
}

export function getRoulettePayoutMultiplier(betType: RouletteBetType): number {
  if (betType === 'straight') return 36;
  return 2;
}

export function getRouletteBetValueOptions(
  betType: RouletteBetType,
): RouletteBetValueOption[] {
  if (betType === 'straight') {
    return Array.from({ length: 37 }, (_, index) => ({
      value: String(index),
      label: String(index),
    }));
  }

  return ROULETTE_BET_OPTIONS[betType];
}

export function getRouletteBetTypeLabel(betType: RouletteBetType): string {
  switch (betType) {
    case 'straight':
      return 'Numer';
    case 'color':
      return 'Kolor';
    case 'parity':
      return 'Parzystość';
    case 'range':
      return 'Zakres';
  }
}

export function formatRouletteBetValue(
  betType: RouletteBetType,
  betValue: string,
): string {
  if (betType === 'straight') {
    return betValue;
  }

  return getRouletteBetValueOptions(betType).find(
    (option) => option.value === betValue,
  )?.label ?? betValue;
}

export function getRouletteColorLabel(color: RouletteColor): string {
  switch (color) {
    case 'red':
      return 'czerwone';
    case 'black':
      return 'czarne';
    case 'green':
      return 'zielone';
  }
}

export function getRoulettePhaseLabel(phase: RouletteRoundPhase): string {
  switch (phase) {
    case 'waiting':
      return 'Przyjmowanie zakładów';
    case 'spinning':
      return 'Koło się kręci';
    case 'settled':
      return 'Runda rozliczona';
  }
}

export function getRouletteCountdownTargetMs(
  round: RouletteCountdownRound,
): number | null {
  if (round.phase === 'waiting') {
    return new Date(round.betting_closes_at).getTime();
  }

  if (round.phase === 'spinning' && round.spin_started_at) {
    return new Date(round.spin_started_at).getTime() + ROULETTE_SPIN_REVEAL_MS;
  }

  return null;
}

export function formatRouletteCountdown(msRemaining: number): string {
  const totalSeconds = Math.max(0, Math.ceil(msRemaining / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function validateRouletteBetInput({
  betType,
  betValue,
  stake,
  balance,
}: ValidateRouletteBetInputArgs) {
  if (!isRouletteBetType(betType)) {
    throw new Error('Wybierz typ zakładu');
  }

  const normalizedStake = typeof stake === 'number' ? stake : Number(stake);

  if (!Number.isFinite(normalizedStake) || normalizedStake <= 0) {
    throw new Error('Stawka musi być większa od 0');
  }

  if (Math.round(normalizedStake * 100) !== normalizedStake * 100) {
    throw new Error('Stawka może mieć maksymalnie 2 miejsca po przecinku');
  }

  if (normalizedStake > balance) {
    throw new Error('Saldo jest za małe na taki zakład');
  }

  if (!isValidRouletteBetValue(betType, betValue)) {
    throw new Error('Wybierz poprawną wartość zakładu');
  }

  return {
    betType,
    betValue,
    stake: Math.round(normalizedStake * 100) / 100,
  };
}

function isRouletteBetType(value: string): value is RouletteBetType {
  return ['straight', 'color', 'parity', 'range'].includes(value);
}

function isValidRouletteBetValue(
  betType: RouletteBetType,
  betValue: string,
): boolean {
  if (betType === 'straight') {
    const parsedNumber = Number(betValue);
    return Number.isInteger(parsedNumber) && parsedNumber >= 0 && parsedNumber <= 36;
  }

  return getRouletteBetValueOptions(betType).some(
    (option) => option.value === betValue,
  );
}
