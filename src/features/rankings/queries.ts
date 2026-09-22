import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PAGE_DATA_QUERY_OPTIONS } from "@/lib/query-client";

export interface RankEntry {
  id: string;
  username: string;
  total_profit: number;
  win_rate: number;
  total_bets: number;
  won_bets: number;
  lost_bets: number;
  balance: number;
}

export type RankingType = "sportsbook" | "casino";

function normalizeRankingRows(data: unknown): RankEntry[] {
  return ((data ?? []) as RankEntry[]).map((r) => ({
    ...r,
    total_profit: Number(r.total_profit),
    win_rate: Number(r.win_rate),
    total_bets: Number(r.total_bets),
    won_bets: Number(r.won_bets),
    lost_bets: Number(r.lost_bets),
    balance: Number(r.balance),
  }));
}

export const rankingsQuery = (rankingType: RankingType) =>
  queryOptions({
    queryKey: ["rankings", rankingType],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        rankingType === "sportsbook"
          ? "get_user_rankings"
          : "get_casino_rankings",
      );

      if (error) {
        throw error;
      }

      return normalizeRankingRows(data);
    },
    ...PAGE_DATA_QUERY_OPTIONS,
  });
