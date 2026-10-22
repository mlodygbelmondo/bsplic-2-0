import type {
  RouletteBetRecord,
  RouletteBetType,
  RouletteColor,
  RouletteRecentWin,
  RouletteRoundParticipant,
  RouletteTableRound,
} from '@/types/database';
import { pluralPl } from '@/lib/format';
import { floorMoney, roundMoney } from '@/lib/money';

import { getRouletteBetValueOptions, getRouletteColor, getRoulettePayoutMultiplier } from './roulette';

/**
 * Pure rules lifted out of the web `RouletteGame`, `useRouletteTable`,
 * `StakeDrawer`, `BettingPanel`, `MyBetsStrip`, `RecentSpinsCarousel` and
 * `RouletteStatsCard`, so the native screen and the stake sheet share them.
 */

export interface RouletteSelection {
  betType: RouletteBetType | '';
  betValue: string;
  stake: string;
  balance: number;
}

/** Disabled-state hint under the bet button (web `submitHint`). */
export function getRouletteSubmitHint({ betType, betValue, stake, balance }: RouletteSelection): string | null {
  const stakeNumber = Number(stake);
  if (!betType) return 'Wybierz typ zakładu';
  if (!betValue) return 'Wybierz wartość zakładu';
  if (!Number.isFinite(stakeNumber) || stakeNumber <= 0) return 'Podaj stawkę';
  if (stakeNumber > balance) return 'Stawka przekracza saldo';
  return null;
}

/** Total return of the current selection, or null while it is incomplete (web `potentialWin`). */
export function getRoulettePotentialWin({ betType, betValue, stake, balance }: RouletteSelection): number | null {
  const stakeNumber = Number(stake);
  const stakeValid = Number.isFinite(stakeNumber) && stakeNumber > 0 && stakeNumber <= balance;
  return betType && betValue && stakeValid ? stakeNumber * getRoulettePayoutMultiplier(betType) : null;
}

/** Label of the selected value (web `betSummary`), e.g. `17` or `Czerwone`. */
export function getRouletteBetSummary(betType: RouletteBetType | '', betValue: string): string | undefined {
  if (!betType) return undefined;
  return getRouletteBetValueOptions(betType).find((option) => option.value === betValue)?.label;
}

/** Status line of the mobile stake bar. */
export function getRouletteStakeStatusLine(
  submitHint: string | null,
  betSummary: string | undefined,
  potentialWin: number | null,
): string {
  return submitHint ?? `${betSummary ?? 'Zakład'} · wypłata ${potentialWin?.toFixed(2) ?? '0.00'} zł`;
}

/** Web `adjustStake`: halves or doubles, never below 0.01, rounded to cents. */
export function adjustRouletteStake(stake: string, multiplier: number): string {
  const nextStake = Math.max(0.01, (Number(stake) || 0) * multiplier);
  return String(roundMoney(nextStake));
}

/** Web `setMaxStake`: the whole balance floored to cents, at least 0.01. */
export function getMaxRouletteStake(balance: number): string {
  return String(Math.max(0.01, floorMoney(balance)));
}

/** Decimal keyboards type a comma in Polish; the stake keeps a dot like the web number input. */
export function normalizeStakeInput(value: string): string {
  return value.replace(',', '.').replace(/[^0-9.]/g, '');
}

/** Optimistic participant row after an accepted bet (web `upsertLocalRoundParticipant`). */
export function upsertLocalRoundParticipant(
  participants: RouletteRoundParticipant[],
  {
    userId,
    username,
    avatarUrl,
    acceptedBet,
  }: { userId: string; username: string; avatarUrl: string | null; acceptedBet: RouletteBetRecord },
): RouletteRoundParticipant[] {
  const participantBet = {
    bet_type: acceptedBet.bet_type,
    bet_value: acceptedBet.bet_value,
    stake: acceptedBet.stake,
  };
  const existing = participants.find((participant) => participant.user_id === userId);

  if (!existing) {
    return [
      {
        user_id: userId,
        username,
        avatar_url: avatarUrl,
        total_stake: acceptedBet.stake,
        bet_count: 1,
        bets: [participantBet],
      },
      ...participants,
    ];
  }

  return participants.map((participant) => {
    if (participant.user_id !== userId) {
      return participant;
    }

    return {
      ...participant,
      username: participant.username || username,
      avatar_url: participant.avatar_url ?? avatarUrl,
      total_stake: participant.total_stake + acceptedBet.stake,
      bet_count: participant.bet_count + 1,
      bets: [participantBet, ...participant.bets],
    };
  });
}

export type RouletteWin = RouletteBetRecord | RouletteRecentWin;

/**
 * The player's newest win to announce: a settled win among their table bets,
 * else a recent win from a round they bet on in this session (an old win from
 * before entering the table is never shown).
 */
export function getLatestUserWin({
  activeBets,
  recentWins,
  userId,
  pendingRoundIds,
}: {
  activeBets: RouletteBetRecord[];
  recentWins: RouletteRecentWin[];
  userId: string;
  pendingRoundIds: ReadonlySet<string>;
}): RouletteWin | null {
  const settledActiveWin = activeBets.find((bet) => bet.is_win === true && bet.payout > 0);
  if (settledActiveWin) return settledActiveWin;
  return (
    recentWins.find((win) => win.user_id === userId && win.payout > 0 && pendingRoundIds.has(win.round_id)) ?? null
  );
}

/** Identity of a logical win, so it is announced and shown once (web `latestUserWinKey`). */
export function getRouletteWinKey(win: RouletteWin): string {
  return `${win.round_id}:${win.bet_type}:${win.bet_value}:${win.stake}:${win.payout}`;
}

export interface LastSettledBets {
  roundId: string;
  bets: RouletteBetRecord[];
  winningNumber: number | null;
  winningColor: RouletteColor | null;
}

/**
 * Settled bets of the player's last round for the result strip and "Powtórz"
 * (web `lastSettled` effect), from the snapshot's `last_settled_bets`. A
 * newer settled round without the player's bets keeps the previous result.
 */
export function deriveLastSettled(
  current: LastSettledBets | null,
  lastSettledBets: RouletteBetRecord[],
  currentRound: RouletteTableRound | null,
  recentSpins: RouletteTableRound[],
): LastSettledBets | null {
  const settledBets = lastSettledBets.filter((bet) => bet.is_win !== null);
  if (settledBets.length === 0) return current;

  const roundId = settledBets[0].round_id;
  if (current?.roundId === roundId && current.bets.length === settledBets.length) return current;

  const settledRound =
    currentRound?.id === roundId ? currentRound : recentSpins.find((round) => round.id === roundId);
  return {
    roundId,
    bets: settledBets,
    winningNumber: settledRound?.winning_number ?? null,
    winningColor: settledRound?.winning_color ?? null,
  };
}

/** Text of the Social post created by "Udostępnij". */
export function getRouletteShareContent(payout: number, winningNumber: number | null): string {
  return winningNumber === null
    ? `Wygrana w ruletce: ${payout.toFixed(2)} zł`
    : `Wygrana w ruletce: ${payout.toFixed(2)} zł. Numer ${winningNumber}.`;
}

/** Accessible label of the repeat button (web `MyBetsStrip`). */
export function getRepeatBetsLabel(count: number, isRepeating: boolean): string {
  return isRepeating
    ? `Stawianie ${count} ${count === 1 ? 'ostatniego zakładu' : 'ostatnich zakładów'}`
    : `Powtórz ${count} ${pluralPl(count, ['ostatni zakład', 'ostatnie zakłady', 'ostatnich zakładów'])}`;
}

/** Color dot of a bet chip: numbers and colors have one, parity and range do not. */
export function getBetChipColor(betType: RouletteBetType, betValue: string): RouletteColor | null {
  if (betType === 'straight') {
    const parsed = Number(betValue);
    return Number.isInteger(parsed) ? getRouletteColor(parsed) : null;
  }
  if (betType === 'color') {
    return betValue === 'red' || betValue === 'black' ? betValue : null;
  }
  return null;
}

/** The option a settled number satisfies, so the matching field lights up (web `getWinningOptionValue`). */
export function getWinningOptionValue(betType: RouletteBetType, winningNumber: number): string | null {
  switch (betType) {
    case 'straight':
      return String(winningNumber);
    case 'color':
      return getRouletteColor(winningNumber);
    case 'parity':
      if (winningNumber === 0) return null;
      return winningNumber % 2 === 0 ? 'even' : 'odd';
    case 'range':
      if (winningNumber === 0) return null;
      return winningNumber <= 18 ? 'low' : 'high';
  }
}

/** Same-color run at the head of the history, shown from two spins (web `getLeadingColorStreak`). */
export function getLeadingColorStreak(spins: RouletteTableRound[]): { color: RouletteColor; length: number } | null {
  const color = spins[0]?.winning_color;
  if (!color) return null;

  let length = 0;
  for (const spin of spins) {
    if (spin.winning_color !== color) break;
    length += 1;
  }

  return length >= 2 ? { color, length } : null;
}

export interface RouletteStats {
  hot: { number: number; count: number }[];
  cold: { number: number; count: number }[];
  red: number;
  black: number;
  green: number;
  total: number;
}

/** Hot/cold numbers and color split over the settled history; needs five spins (web `RouletteStatsCard`). */
export function computeRouletteStats(spins: RouletteTableRound[]): RouletteStats | null {
  const settled = spins.filter((spin) => spin.winning_number !== null);
  if (settled.length < 5) return null;

  const counts = new Map<number, number>();
  let red = 0;
  let black = 0;
  let green = 0;

  settled.forEach((spin) => {
    const number = spin.winning_number as number;
    counts.set(number, (counts.get(number) ?? 0) + 1);
    const color = spin.winning_color ?? getRouletteColor(number);
    if (color === 'red') red += 1;
    else if (color === 'black') black += 1;
    else green += 1;
  });

  const allCounts = Array.from({ length: 37 }, (_, number) => ({ number, count: counts.get(number) ?? 0 }));
  const hot = [...allCounts]
    .sort((a, b) => b.count - a.count || a.number - b.number)
    .slice(0, 3)
    .filter((entry) => entry.count > 0);
  const cold = [...allCounts].sort((a, b) => a.count - b.count || a.number - b.number).slice(0, 3);

  return { hot, cold, red, black, green, total: settled.length };
}
