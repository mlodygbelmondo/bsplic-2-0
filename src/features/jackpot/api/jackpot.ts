import { supabase } from '@/integrations/supabase/client';

import type { DailyJackpotSnapshot, DailyJackpotStatus } from '../types';

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

  return 'collecting';
}

export function normalizeDailyJackpotSnapshot(
  data: unknown,
): DailyJackpotSnapshot {
  const row = data && typeof data === 'object' ? (data as SnapshotRecord) : {};

  return {
    poolId: getString(row, 'pool_id'),
    poolDate: getString(row, 'pool_date'),
    status: normalizeStatus(row.status),
    prizeAmount: getNumber(row, 'prize_amount'),
    ticketPrice: getNumber(row, 'ticket_price'),
    minUniqueUsers: getNumber(row, 'min_unique_users', 3),
    participantCount: getNumber(row, 'participant_count'),
    ticketCount: getNumber(row, 'ticket_count'),
    drawScheduledAt: getString(row, 'draw_scheduled_at'),
    currentUserHasTicket: getBoolean(row, 'current_user_has_ticket'),
    currentUserTicketNumber: getNullableNumber(
      row,
      'current_user_ticket_number',
    ),
    winnerUserId: getNullableString(row, 'winner_user_id'),
    winnerUsername: getNullableString(row, 'winner_username'),
    winnerAvatarUrl: getNullableString(row, 'winner_avatar_url'),
    winningTicketNumber: getNullableNumber(row, 'winning_ticket_number'),
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
