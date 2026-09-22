import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PAGE_DATA_QUERY_OPTIONS } from "@/lib/query-client";
import type {
  Badge,
  CasinoHistoryEntry,
  CouponHistoryEntry,
  PublicProfile,
} from "@/types/database";

export const HISTORY_PREVIEW_SIZE = 10;
const HISTORY_PREVIEW_FETCH_LIMIT = HISTORY_PREVIEW_SIZE + 1;

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

export const profileBadgesQuery = (userId: string) =>
  queryOptions({
    queryKey: ["profile", userId, "badges"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_badges", {
        p_user_id: userId,
      });
      if (error) throw error;
      return (data as unknown as Badge[] | null) ?? [];
    },
    ...PAGE_DATA_QUERY_OPTIONS,
  });

/** The signed-in player's own stats, without recomputing the leaderboard. */
export const profileStatsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["profile", userId, "stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_user_stats", {
        p_user_id: userId,
      });
      if (error) throw error;
      return data?.[0] ? toRankingStats(data[0]) : null;
    },
    ...PAGE_DATA_QUERY_OPTIONS,
  });

export const publicProfileQuery = (userId: string) =>
  queryOptions({
    queryKey: ["profile", userId, "public"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_profile", {
        p_user_id: userId,
      });
      if (error) throw error;
      return (data as unknown as PublicProfile | null) ?? null;
    },
    ...PAGE_DATA_QUERY_OPTIONS,
  });

export const sportsbookHistoryPreviewQuery = (userId: string) =>
  queryOptions({
    queryKey: ["profile", userId, "history", "sportsbook"],
    queryFn: async (): Promise<HistoryPreview<CouponHistoryEntry>> => {
      const { data, error } = await supabase.rpc("get_user_coupon_history", {
        p_user_id: userId,
        p_limit: HISTORY_PREVIEW_FETCH_LIMIT,
        p_offset: 0,
      });
      if (error) throw error;
      const entries = (data as unknown as CouponHistoryEntry[] | null) ?? [];
      return {
        entries: entries.slice(0, HISTORY_PREVIEW_SIZE),
        hasMore: entries.length > HISTORY_PREVIEW_SIZE,
      };
    },
    ...PAGE_DATA_QUERY_OPTIONS,
  });

export const casinoHistoryPreviewQuery = (userId: string) =>
  queryOptions({
    queryKey: ["profile", userId, "history", "casino"],
    queryFn: async (): Promise<HistoryPreview<CasinoHistoryEntry>> => {
      const { data, error } = await supabase.rpc("get_user_casino_history", {
        p_user_id: userId,
        p_limit: HISTORY_PREVIEW_FETCH_LIMIT,
        p_offset: 0,
      });
      if (error) throw error;
      const entries = toCasinoHistoryEntries(data);
      return {
        entries: entries.slice(0, HISTORY_PREVIEW_SIZE),
        hasMore: entries.length > HISTORY_PREVIEW_SIZE,
      };
    },
    ...PAGE_DATA_QUERY_OPTIONS,
  });
