import type { DailyJackpotDraw } from '../types';
import { formatTicketLabel } from './jackpotFormat';

/** Web `JackpotDrawPage` timing constants. */
export const DRAWING_FLIGHT_MS = 3300;
export const REDUCED_MOTION_FLIGHT_MS = 160;
/** The drum lands a moment before the reveal so the winning face can glow. */
export const CYLINDER_SPIN_MS = DRAWING_FLIGHT_MS - 450;
export const ROSTER_COLLAPSED_COUNT = 10;

export type ReplayPhase = 'intro' | 'drawing' | 'revealed';

export function hasVisibleWinnerDetails(draw: DailyJackpotDraw): boolean {
  return Boolean(draw.winnerUserId && draw.winnerUsername && draw.winningTicketNumber !== null);
}

/** Every ticket number in the pool, ascending (the drum faces come from these). */
export function getPoolTicketNumbers(draw: DailyJackpotDraw): number[] {
  return draw.participants.flatMap((participant) => participant.ticketNumbers).sort((left, right) => left - right);
}

/** The current user's ticket labels, sorted (`#04 #11`). */
export function getCurrentUserTicketLabels(draw: DailyJackpotDraw, currentUserId: string | null): string[] {
  if (!currentUserId) return [];
  return (draw.participants.find((participant) => participant.userId === currentUserId)?.ticketNumbers ?? [])
    .slice()
    .sort((left, right) => left - right)
    .map(formatTicketLabel);
}

/** Padded winner label (`Ticket #04`, like the drum and roster); falls back when the number is unknown. */
export function getWinnerTicketLabel(winningTicketNumber: number | null): string {
  if (!winningTicketNumber) return 'Ticket zwycięzcy';
  return `Ticket ${formatTicketLabel(winningTicketNumber)}`;
}

/** The reward state belongs to the pool, so only the winner sees it. */
export function getRewardStateLabel(draw: DailyJackpotDraw): string | null {
  if (!draw.currentUserIsWinner) return null;
  if (draw.rewardCreditStatus === 'claimed') return 'Nagroda odebrana';
  if (draw.rewardCreditStatus === 'auto_credited') return 'Nagroda została dodana automatycznie';
  return null;
}

export function canClaimReward(draw: DailyJackpotDraw, phase: ReplayPhase): boolean {
  return phase === 'revealed' && draw.currentUserIsWinner && draw.rewardCreditStatus === 'pending';
}

export function getStartButtonLabel(draw: DailyJackpotDraw): string {
  return draw.resultViewedAt ? 'Obejrzyj losowanie' : 'Rozpocznij losowanie';
}

/** Reveal can reuse the loaded draw only when it was viewed and still carries the winner. */
export function canReuseRevealedDraw(draw: DailyJackpotDraw): boolean {
  return Boolean(draw.resultViewedAt) && hasVisibleWinnerDetails(draw);
}
