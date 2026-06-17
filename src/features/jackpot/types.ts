export type DailyJackpotStatus =
  | 'collecting'
  | 'locked'
  | 'drawn'
  | 'rolled_over'
  | 'cancelled';

export interface DailyJackpotSnapshot {
  poolId: string;
  poolDate: string;
  status: DailyJackpotStatus;
  prizeAmount: number;
  ticketPrice: number;
  minUniqueUsers: number;
  participantCount: number;
  ticketCount: number;
  drawScheduledAt: string;
  currentUserHasTicket: boolean;
  currentUserTicketNumber: number | null;
  winnerUserId: string | null;
  winnerUsername: string | null;
  winnerAvatarUrl: string | null;
  winningTicketNumber: number | null;
  serverNow: string;
}
