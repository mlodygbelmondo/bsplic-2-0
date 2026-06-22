import { supabase } from '@/integrations/supabase/client';

import type {
  DailyJackpotClaimResult,
  DailyJackpotDraw,
  DailyJackpotParticipant,
  DailyJackpotRewardCreditStatus,
  DailyJackpotSnapshot,
  DailyJackpotStatus,
} from '../types';

type SnapshotRecord = Record<string, unknown>;

function getString(row: SnapshotRecord, key: string, fallback = ''): string {
  const value = row[key];
  return typeof value === 'string' ? value : fallback;
}

function getNullableString(row: SnapshotRecord, key: string): string | null {
  const value = row[key];
  return typeof value === 'string' ? value : null;
}

function getNumber(row: SnapshotRecord, key: string, fallback = 0): number {
  const value = row[key];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function getNullableNumber(row: SnapshotRecord, key: string): number | null {
  const value = row[key];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function getBoolean(row: SnapshotRecord, key: string): boolean {
  return row[key] === true;
}

function getArray(row: SnapshotRecord, key: string): unknown[] {
  const value = row[key];
  return Array.isArray(value) ? value : [];
}

function normalizeStatus(value: unknown): DailyJackpotStatus {
  if (
    value === 'collecting' ||
    value === 'locked' ||
    value === 'drawn' ||
    value === 'rolled_over' ||
    value === 'cancelled'
  ) {
    return value;
  }

  throw new Error('Nieznany status Jackpotu');
}

function normalizeRewardCreditStatus(
  value: unknown,
): DailyJackpotRewardCreditStatus {
  if (
    value === 'pending' ||
    value === 'claimed' ||
    value === 'auto_credited' ||
    value === 'not_applicable'
  ) {
    return value;
  }

  return 'not_applicable';
}

function normalizeTicketNumbers(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((ticketNumber) => Number(ticketNumber))
    .filter((ticketNumber) => Number.isFinite(ticketNumber));
}

function normalizeParticipant(data: unknown): DailyJackpotParticipant {
  const row = data && typeof data === 'object' ? (data as SnapshotRecord) : {};

  return {
    userId: getString(row, 'user_id'),
    username: getString(row, 'username', 'Gracz'),
    avatarUrl: getNullableString(row, 'avatar_url'),
    ticketNumbers: normalizeTicketNumbers(row.ticket_numbers),
    ticketCount: getNumber(row, 'ticket_count'),
  };
}

export function normalizeDailyJackpotSnapshot(
  data: unknown,
): DailyJackpotSnapshot {
  const row = data && typeof data === 'object' ? (data as SnapshotRecord) : {};
  const currentUserTicketNumber = getNullableNumber(
    row,
    'current_user_ticket_number',
  );
  const currentUserTicketNumbers =
    normalizeTicketNumbers(row.current_user_ticket_numbers);

  return {
    poolId: getNullableString(row, 'pool_id'),
    poolDate: getString(row, 'pool_date'),
    status: normalizeStatus(row.status),
    prizeAmount: getNumber(row, 'prize_amount'),
    ticketPrice: getNumber(row, 'ticket_price'),
    maxTicketsPerPlayer: getNumber(row, 'max_tickets_per_player', 2),
    minUniqueUsers: getNumber(row, 'min_unique_users', 3),
    participantCount: getNumber(row, 'participant_count'),
    ticketCount: getNumber(row, 'ticket_count'),
    drawScheduledAt: getString(row, 'draw_scheduled_at'),
    currentUserHasTicket: getBoolean(row, 'current_user_has_ticket'),
    currentUserTicketCount: getNumber(row, 'current_user_ticket_count'),
    currentUserTicketNumber,
    currentUserTicketNumbers:
      currentUserTicketNumbers.length > 0
        ? currentUserTicketNumbers
        : currentUserTicketNumber !== null
          ? [currentUserTicketNumber]
          : [],
    winnerUserId: getNullableString(row, 'winner_user_id'),
    winnerUsername: getNullableString(row, 'winner_username'),
    winnerAvatarUrl: getNullableString(row, 'winner_avatar_url'),
    winningTicketNumber: getNullableNumber(row, 'winning_ticket_number'),
    maintenanceAutoCreditedCount: getNumber(
      row,
      'maintenance_auto_credited_count',
    ),
    serverNow: getString(row, 'server_now', new Date().toISOString()),
  };
}

export async function getDailyJackpotState(): Promise<DailyJackpotSnapshot> {
  const { data, error } = await supabase.rpc('get_daily_jackpot_state');

  if (error) {
    throw new Error(error.message);
  }

  return normalizeDailyJackpotSnapshot(data);
}

export async function buyDailyJackpotTicket(
  poolId: string,
): Promise<DailyJackpotSnapshot> {
  const { data, error } = await supabase.rpc('buy_daily_jackpot_ticket', {
    p_pool_id: poolId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return normalizeDailyJackpotSnapshot(data);
}

export function normalizeDailyJackpotDraw(data: unknown): DailyJackpotDraw {
  const row = data && typeof data === 'object' ? (data as SnapshotRecord) : {};
  const poolId = getNullableString(row, 'pool_id');

  if (!poolId) {
    throw new Error('Nie znaleziono losowania Jackpotu');
  }

  return {
    poolId,
    poolDate: getString(row, 'pool_date'),
    status: normalizeStatus(row.status),
    prizeAmount: getNumber(row, 'prize_amount'),
    ticketPrice: getNumber(row, 'ticket_price'),
    minUniqueUsers: getNumber(row, 'min_unique_users', 3),
    participantCount: getNumber(row, 'participant_count'),
    ticketCount: getNumber(row, 'ticket_count'),
    drawScheduledAt: getString(row, 'draw_scheduled_at'),
    drawnAt: getNullableString(row, 'drawn_at'),
    winnerUserId: getNullableString(row, 'winner_user_id'),
    winnerUsername: getNullableString(row, 'winner_username'),
    winnerAvatarUrl: getNullableString(row, 'winner_avatar_url'),
    winningTicketNumber: getNullableNumber(row, 'winning_ticket_number'),
    currentUserHasTicket: getBoolean(row, 'current_user_has_ticket'),
    currentUserTicketCount: getNumber(row, 'current_user_ticket_count'),
    currentUserIsWinner: getBoolean(row, 'current_user_is_winner'),
    resultViewedAt: getNullableString(row, 'result_viewed_at'),
    rewardClaimedAt: getNullableString(row, 'reward_claimed_at'),
    rewardAutoCreditedAt: getNullableString(row, 'reward_auto_credited_at'),
    rewardCreditStatus: normalizeRewardCreditStatus(
      row.reward_credit_status,
    ),
    rewardCreditEventId: getNullableString(row, 'reward_credit_event_id'),
    participants: getArray(row, 'participants').map(normalizeParticipant),
    serverNow: getString(row, 'server_now', new Date().toISOString()),
  };
}

function normalizeClaimResult(data: unknown): DailyJackpotClaimResult {
  const result = Array.isArray(data) ? data[0] : data;
  const row =
    result && typeof result === 'object' ? (result as SnapshotRecord) : {};
  const poolId = getNullableString(row, 'pool_id');

  if (!poolId) {
    throw new Error('Nie udało się odebrać nagrody Jackpot');
  }

  return {
    poolId,
    amount: getNumber(row, 'amount'),
    balanceAfter: getNumber(row, 'balance_after'),
    rewardCreditStatus: normalizeRewardCreditStatus(
      row.reward_credit_status,
    ),
    rewardClaimedAt: getNullableString(row, 'reward_claimed_at'),
    rewardAutoCreditedAt: getNullableString(row, 'reward_auto_credited_at'),
    alreadyCredited: getBoolean(row, 'already_credited'),
  };
}

export async function getDailyJackpotDraw(
  poolId: string,
): Promise<DailyJackpotDraw> {
  const { data, error } = await supabase.rpc('get_daily_jackpot_draw', {
    p_pool_id: poolId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return normalizeDailyJackpotDraw(data);
}

export async function revealDailyJackpotDraw(
  poolId: string,
): Promise<DailyJackpotDraw> {
  const { data, error } = await supabase.rpc('reveal_daily_jackpot_draw', {
    p_pool_id: poolId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return normalizeDailyJackpotDraw(data);
}

export async function claimDailyJackpotReward(
  poolId: string,
): Promise<DailyJackpotClaimResult> {
  const { data, error } = await supabase.rpc('claim_daily_jackpot_reward', {
    p_pool_id: poolId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return normalizeClaimResult(data);
}
