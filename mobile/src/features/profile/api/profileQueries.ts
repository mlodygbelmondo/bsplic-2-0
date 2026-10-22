import { queryOptions } from '@tanstack/react-query';

import { PAGE_DATA_QUERY_OPTIONS, queryClient } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';
import type { Badge, CasinoHistoryEntry, CouponHistoryEntry, PublicProfile } from '@/types/database';

/** Port of the web `src/features/profile/api/profileQueries.ts`. */

export const HISTORY_PREVIEW_SIZE = 10;
const HISTORY_PREVIEW_FETCH_LIMIT = HISTORY_PREVIEW_SIZE + 1;
export const HISTORY_BATCH_SIZE = 30;
const HISTORY_BATCH_FETCH_LIMIT = HISTORY_BATCH_SIZE + 1;

export interface RankingStats {
  totalBets: number;
  wins: number;
  losses: number;
  winRate: number;
  totalProfit: number;
}

interface UserStatsRow {
  total_bets: number;
  won_bets: number;
  lost_bets: number;
  win_rate: number;
  total_profit: number;
}

export interface HistoryPreview<Entry> {
  entries: Entry[];
  hasMore: boolean;
}

export interface HistoryPage<Entry> {
  entries: Entry[];
  hasMore: boolean;
}

export function toRankingStats(stats: UserStatsRow): RankingStats {
  return {
    totalBets: Number(stats.total_bets),
    wins: Number(stats.won_bets),
    losses: Number(stats.lost_bets),
    winRate: Number(stats.win_rate),
    totalProfit: Number(stats.total_profit),
  };
}

export function toCasinoHistoryEntries(data: unknown): CasinoHistoryEntry[] {
  return ((data as CasinoHistoryEntry[] | null) ?? []).map((entry) => ({
    ...entry,
    stake: Number(entry.stake),
    payout: Number(entry.payout),
  }));
}

/**
 * `get_public_profile` returns `{}` for a missing (or hidden) player; treat
 * anything without an id as "not found".
 */
function toPublicProfile(data: unknown): PublicProfile | null {
  if (!data || typeof data !== 'object' || !('id' in data) || !(data as { id?: unknown }).id) return null;
  return data as PublicProfile;
}

async function fetchCouponHistory(userId: string, limit: number, offset: number): Promise<CouponHistoryEntry[]> {
  const { data, error } = await supabase.rpc('get_user_coupon_history', {
    p_user_id: userId,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;
  return (data as unknown as CouponHistoryEntry[] | null) ?? [];
}

async function fetchCasinoHistory(userId: string, limit: number, offset: number): Promise<CasinoHistoryEntry[]> {
  const { data, error } = await supabase.rpc('get_user_casino_history', {
    p_user_id: userId,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;
  return toCasinoHistoryEntries(data);
}

export const profileBadgesQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: ['profile', userId, 'badges'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_public_badges', { p_user_id: userId });
      if (error) throw error;
      return (data as unknown as Badge[] | null) ?? [];
    },
    ...PAGE_DATA_QUERY_OPTIONS,
  });

/** The signed-in player's own stats, without recomputing the leaderboard. */
export const profileStatsQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: ['profile', userId, 'stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_user_stats', { p_user_id: userId });
      if (error) throw error;
      return data?.[0] ? toRankingStats(data[0]) : null;
    },
    ...PAGE_DATA_QUERY_OPTIONS,
  });

/** Another player's name, avatar and sportsbook stats (SECURITY DEFINER-gated RPC). */
export const publicProfileQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: ['profile', userId, 'public'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_public_profile', { p_user_id: userId });
      if (error) throw error;
      return toPublicProfile(data);
    },
    ...PAGE_DATA_QUERY_OPTIONS,
  });

export const sportsbookHistoryPreviewQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: ['profile', userId, 'history', 'sportsbook'],
    queryFn: async (): Promise<HistoryPreview<CouponHistoryEntry>> => {
      const entries = await fetchCouponHistory(userId, HISTORY_PREVIEW_FETCH_LIMIT, 0);
      return {
        entries: entries.slice(0, HISTORY_PREVIEW_SIZE),
        hasMore: entries.length > HISTORY_PREVIEW_SIZE,
      };
    },
    ...PAGE_DATA_QUERY_OPTIONS,
  });

export const casinoHistoryPreviewQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: ['profile', userId, 'history', 'casino'],
    queryFn: async (): Promise<HistoryPreview<CasinoHistoryEntry>> => {
      const entries = await fetchCasinoHistory(userId, HISTORY_PREVIEW_FETCH_LIMIT, 0);
      return {
        entries: entries.slice(0, HISTORY_PREVIEW_SIZE),
        hasMore: entries.length > HISTORY_PREVIEW_SIZE,
      };
    },
    ...PAGE_DATA_QUERY_OPTIONS,
  });

/** "Pokaż więcej" batch (30 entries) after `offset` loaded entries. */
export async function fetchSportsbookHistoryPage(userId: string, offset: number): Promise<HistoryPage<CouponHistoryEntry>> {
  const entries = await fetchCouponHistory(userId, HISTORY_BATCH_FETCH_LIMIT, offset);
  return { entries: entries.slice(0, HISTORY_BATCH_SIZE), hasMore: entries.length > HISTORY_BATCH_SIZE };
}

export async function fetchCasinoHistoryPage(userId: string, offset: number): Promise<HistoryPage<CasinoHistoryEntry>> {
  const entries = await fetchCasinoHistory(userId, HISTORY_BATCH_FETCH_LIMIT, offset);
  return { entries: entries.slice(0, HISTORY_BATCH_SIZE), hasMore: entries.length > HISTORY_BATCH_SIZE };
}

/** `/profile/<username>` links: case-insensitive username lookup (web `ProfilePage`). */
export const profileIdByUsernameQueryOptions = (username: string) =>
  queryOptions({
    queryKey: ['profile', 'by-username', username.toLowerCase()],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', username)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.id ?? null;
    },
  });

/**
 * Press-in delay for rows in scrolling lists that warm data on press-in: a
 * scroll that starts on the row cancels the press before it fires, so scrolling
 * past avatars and names fetches nothing. A quicker tap still fires press-in.
 */
export const PREFETCH_PRESS_DELAY_MS = 130;

/**
 * Warms another player's profile screen (call on press-in of an avatar or
 * name, with `PREFETCH_PRESS_DELAY_MS` inside lists): public profile, badges
 * and the sportsbook history preview.
 */
export function prefetchPublicProfile(userId: string) {
  void queryClient.prefetchQuery(publicProfileQueryOptions(userId));
  void queryClient.prefetchQuery(profileBadgesQueryOptions(userId));
  void queryClient.prefetchQuery(sportsbookHistoryPreviewQueryOptions(userId));
}
