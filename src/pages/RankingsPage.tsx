import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";

interface RankEntry {
  id: string;
  username: string;
  total_profit: number;
  win_rate: number;
  total_bets: number;
  won_bets: number;
  lost_bets: number;
  balance: number;
}

type SortKey = "total_profit" | "win_rate" | "total_bets";
type RankingType = "sportsbook" | "casino";

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

export default function RankingsPage() {
  const [sortBy, setSortBy] = useState<SortKey>("total_profit");
  const [rankingType, setRankingType] = useState<RankingType>("sportsbook");
  const { user } = useAuth();

  const {
    data: rankings = [],
    error,
    isLoading: loading,
  } = useQuery({
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
  });

  useEffect(() => {
    if (error) {
      console.error("Rankings fetch error:", error);
    }
  }, [error]);

  const sorted = useMemo(() => {
    return [...rankings].sort((a, b) => b[sortBy] - a[sortBy]);
  }, [rankings, sortBy]);

  const sortTabs: Array<{ key: SortKey; label: string }> = [
    { key: "total_profit", label: "Profit" },
    { key: "win_rate", label: "Win rate" },
    { key: "total_bets", label: "Zakłady" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-3xl mx-auto p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold">Rankingi</h1>
          <div className="inline-flex w-max items-center rounded-lg border border-border bg-card p-1">
            {(
              [
                ["sportsbook", "Zakłady"],
                ["casino", "Kasyno"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setRankingType(value)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                  rankingType === value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="-mx-1 mb-4 px-1 overflow-x-auto scrollbar-hide touch-pan-x">
          <div className="flex w-max min-w-full gap-2 pb-1 pr-1">
            {sortTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSortBy(tab.key)}
                className={cn(
                  "shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all",
                  sortBy === tab.key
                    ? "gradient-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-xl overflow-hidden card-shadow">
          <div className="grid grid-cols-5 gap-2 p-3 text-xs font-bold text-muted-foreground border-b">
            <span>#</span>
            <span>Gracz</span>
            <span
              className={cn(
                "text-right cursor-pointer hover:text-foreground transition-colors",
                sortBy === "total_profit" && "text-foreground",
              )}
              onClick={() => setSortBy("total_profit")}
            >
              Profit
            </span>
            <span
              className={cn(
                "text-right cursor-pointer hover:text-foreground transition-colors",
                sortBy === "win_rate" && "text-foreground",
              )}
              onClick={() => setSortBy("win_rate")}
            >
              Win rate
            </span>
            <span
              className={cn(
                "text-right cursor-pointer hover:text-foreground transition-colors",
                sortBy === "total_bets" && "text-foreground",
              )}
              onClick={() => setSortBy("total_bets")}
            >
              Zakłady
            </span>
          </div>

          {loading ? (
            <div className="space-y-0">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="grid grid-cols-5 gap-2 p-3 items-center"
                >
                  <Skeleton className="h-4 w-6" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-14 ml-auto" />
                  <Skeleton className="h-4 w-10 ml-auto" />
                  <Skeleton className="h-4 w-8 ml-auto" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {sorted.map((r, i) => {
                const rank = i + 1;
                const medal =
                  rank === 1
                    ? "🥇"
                    : rank === 2
                      ? "🥈"
                      : rank === 3
                        ? "🥉"
                        : null;

                return (
                  <div
                    key={r.id}
                    className={cn(
                      "grid grid-cols-5 gap-2 p-3 text-sm items-center border-b border-border last:border-0 transition-colors",
                      r.id === user?.id && "bg-primary/10",
                      rank <= 3 && "font-semibold",
                    )}
                  >
                    <span className="font-bold">{medal ?? rank}</span>
                    <Link
                      to={`/profile/${r.id}`}
                      className="font-medium truncate hover:text-primary transition-colors"
                    >
                      {r.username}
                      {r.id === user?.id && (
                        <span className="text-xs text-muted-foreground ml-1">
                          (ty)
                        </span>
                      )}
                    </Link>
                    <span
                      className={cn(
                        "text-right font-bold",
                        r.total_profit > 0
                          ? "text-success"
                          : r.total_profit < 0
                            ? "text-destructive"
                            : "",
                      )}
                    >
                      {r.total_profit >= 0 ? "+" : ""}
                      {r.total_profit.toFixed(2)} zł
                    </span>
                    <span className="text-right">{r.win_rate.toFixed(1)}%</span>
                    <span className="text-right">{r.total_bets}</span>
                  </div>
                );
              })}
              {sorted.length === 0 && (
                <p className="text-center py-8 text-muted-foreground">
                  {rankingType === "sportsbook"
                    ? "Brak danych — nikt jeszcze nie postawił zakładu"
                    : "Brak danych — nikt jeszcze nie zagrał w kasynie"}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
