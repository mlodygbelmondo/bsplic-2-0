export type DailyJackpotStatus =
  | 'collecting'
  | 'locked'
  | 'drawn'
  | 'rolled_over'
  | 'cancelled';

export interface DailyJackpotSnapshot {
  poolId: string | null;
  poolDate: string;
  status: DailyJackpotStatus;
  prizeAmount: number;
  ticketPrice: number;
  maxTicketsPerPlayer: number;
  minUniqueUsers: number;
  participantCount: number;
  ticketCount: number;
  drawScheduledAt: string;
  currentUserHasTicket: boolean;
  currentUserTicketCount: number;
  currentUserTicketNumber: number | null;
  currentUserTicketNumbers: number[];
  winnerUserId: string | null;
  winnerUsername: string | null;
  winnerAvatarUrl: string | null;
  winningTicketNumber: number | null;
  maintenanceAutoCreditedCount: number;
  serverNow: string;
}

export type DailyJackpotRewardCreditStatus =
  | 'pending'
  | 'claimed'
  | 'auto_credited'
  | 'not_applicable';

export interface DailyJackpotParticipant {
  userId: string;
  username: string;
  avatarUrl: string | null;
  ticketNumbers: number[];
  ticketCount: number;
}

export interface DailyJackpotDraw {
  poolId: string;
  poolDate: string;
  status: DailyJackpotStatus;
  prizeAmount: number;
  ticketPrice: number;
  minUniqueUsers: number;
  participantCount: number;
  ticketCount: number;
  drawScheduledAt: string;
  drawnAt: string | null;
  winnerUserId: string | null;
  winnerUsername: string | null;
  winnerAvatarUrl: string | null;
  winningTicketNumber: number | null;
  currentUserHasTicket: boolean;
  currentUserTicketCount: number;
  currentUserIsWinner: boolean;
  resultViewedAt: string | null;
  rewardClaimedAt: string | null;
  rewardAutoCreditedAt: string | null;
  rewardCreditStatus: DailyJackpotRewardCreditStatus;
  rewardCreditEventId: string | null;
  participants: DailyJackpotParticipant[];
  serverNow: string;
}

export interface DailyJackpotClaimResult {
  poolId: string;
  amount: number;
  balanceAfter: number;
  rewardCreditStatus: DailyJackpotRewardCreditStatus;
  rewardClaimedAt: string | null;
  rewardAutoCreditedAt: string | null;
  alreadyCredited: boolean;
}
