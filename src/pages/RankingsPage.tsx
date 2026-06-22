import { useEffect, useRef, useState, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { SectionLoader } from "@/components/SectionLoader";
import { Link } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
  getNextScrollChromeState,
  type ScrollChromeState,
} from "@/lib/scroll-chrome";

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
  usePageTitle("Rankingi");
  const [sortBy, setSortBy] = useState<SortKey>("total_profit");
  const [rankingType, setRankingType] = useState<RankingType>("sportsbook");
  const [mobileChromeHidden, setMobileChromeHidden] = useState(false);
  const mobileChromeStateRef = useRef<ScrollChromeState>();
  const { user } = useAuth();

  const {
    data: rankings = [],
    error,
    isLoading: loading,
    isFetching,
    refetch,
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

  const emptyRankingsMessage =
    rankingType === "sportsbook"
      ? "Brak danych — nikt jeszcze nie postawił zakładu"
      : "Brak danych — nikt jeszcze nie zagrał w kasynie";

  const getProfitTone = (profit: number) =>
    profit > 0
      ? "text-success"
      : profit < 0
        ? "text-destructive"
        : "";

  const formatProfit = (profit: number) =>
    `${profit >= 0 ? "+" : ""}${profit.toFixed(2)} zł`;

  const getPrimaryMetric = (entry: RankEntry) => {
    if (sortBy === "win_rate") {
      return {
        label: "Win rate",
        value: `${entry.win_rate.toFixed(1)}%`,
        className: "",
      };
    }

    if (sortBy === "total_bets") {
      return {
        label: "Zakłady",
        value: entry.total_bets.toString(),
        className: "",
      };
    }

    return {
      label: "Profit",
      value: formatProfit(entry.total_profit),
      className: getProfitTone(entry.total_profit),
    };
  };

  const renderRankingError = () => (
    <div className="px-4 py-8 text-center">
      <p className="text-sm font-semibold text-foreground">
        Nie udało się wczytać rankingu
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Sprawdź połączenie i spróbuj ponownie.
      </p>
      <button
        type="button"
        onClick={() => void refetch()}
        disabled={isFetching}
        className="mt-4 rounded-full border border-border px-4 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-60"
      >
        {isFetching ? "Ładowanie..." : "Spróbuj ponownie"}
      </button>
    </div>
  );

  const renderDesktopTableShell = (children: ReactNode) => (
    <div
      data-testid="rankings-desktop-table"
      className="app-surface hidden rounded-xl overflow-hidden sm:block"
    >
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
      {children}
    </div>
  );

  return (
    <div className="h-safe-screen bg-background overflow-hidden flex flex-col">
      <Navbar mobileBottomNavHidden={mobileChromeHidden} />
      <div
        data-testid="rankings-scroll-container"
        onScroll={(event) => {
          const element = event.currentTarget;
          const nextChromeState = getNextScrollChromeState(
            mobileChromeStateRef.current,
            {
              scrollTop: element.scrollTop,
              scrollHeight: element.scrollHeight,
              clientHeight: element.clientHeight,
            },
          );
          mobileChromeStateRef.current = nextChromeState;
          setMobileChromeHidden(nextChromeState.hidden);
        }}
        className="flex-1 min-h-0 overflow-y-auto max-w-3xl w-full mx-auto px-0 pt-2 pb-[var(--mobile-bottom-nav-scroll-padding)] sm:px-4 sm:pt-4 lg:pb-4"
      >
        <div className="mb-3 flex flex-col gap-3 px-3 sm:mb-4 sm:flex-row sm:items-center sm:justify-between sm:px-0">
          <h1 className="text-xl font-bold sm:text-2xl">Rankingi</h1>
          <div className="app-subsurface inline-flex w-max items-center rounded-lg p-1">
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
                    : "text-muted-foreground hover:bg-primary/10 hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-3 overflow-x-auto px-3 scrollbar-hide touch-pan-x sm:-mx-1 sm:mb-4 sm:px-1">
          <div className="flex w-max min-w-full gap-2 pb-1 pr-1">
            {sortTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSortBy(tab.key)}
                className={cn(
                  "shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all",
                  sortBy === tab.key
                    ? "gradient-primary text-primary-foreground shadow-sm"
                    : "border border-border/70 bg-muted/60 text-muted-foreground hover:border-primary/30 hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <>
            <div className="sm:hidden">
              <SectionLoader label="Wczytywanie rankingu..." />
            </div>
            {renderDesktopTableShell(<SectionLoader label="Wczytywanie rankingu..." />)}
          </>
        ) : error ? (
          <>
            <div className="app-surface social-edge-surface rounded-none sm:hidden">
              {renderRankingError()}
            </div>
            {renderDesktopTableShell(renderRankingError())}
          </>
        ) : (
          <>
            <div
              data-testid="rankings-mobile-list"
              className="divide-y divide-border border-y border-border bg-card/80 sm:hidden"
            >
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
                const primaryMetric = getPrimaryMetric(r);

                return (
                  <Link
                    key={r.id}
                    data-testid="rankings-mobile-row"
                    to={`/profile/${r.id}`}
                    className={cn(
                      "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 text-sm transition-colors hover:bg-muted/50",
                      r.id === user?.id && "bg-primary/10",
                      rank <= 3 && "font-semibold",
                    )}
                  >
                    <span className="w-8 text-center text-base font-bold">
                      {medal ?? rank}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {r.username}
                        {r.id === user?.id && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            (ty)
                          </span>
                        )}
                      </span>
                      <span className="mt-1 block truncate text-[11px] text-muted-foreground">
                        Profit {formatProfit(r.total_profit)} · WR{" "}
                        {r.win_rate.toFixed(1)}% · {r.total_bets} zakł.
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block text-[10px] font-semibold uppercase text-muted-foreground">
                        {primaryMetric.label}
                      </span>
                      <span className={cn("block font-bold", primaryMetric.className)}>
                        {primaryMetric.value}
                      </span>
                    </span>
                  </Link>
                );
              })}
              {sorted.length === 0 && (
                <p className="px-4 py-8 text-center text-muted-foreground">
                  {emptyRankingsMessage}
                </p>
              )}
            </div>

            {renderDesktopTableShell(
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
                  <Link
                    key={r.id}
                    to={`/profile/${r.id}`}
                    className={cn(
                      "grid grid-cols-5 gap-2 p-3 text-sm items-center border-b border-border last:border-0 transition-colors hover:bg-muted/50",
                      r.id === user?.id && "bg-primary/10",
                      rank <= 3 && "font-semibold",
                    )}
                  >
                    <span className="font-bold">{medal ?? rank}</span>
                    <span className="font-medium truncate">
                      {r.username}
                      {r.id === user?.id && (
                        <span className="text-xs text-muted-foreground ml-1">
                          (ty)
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        "text-right font-bold",
                        getProfitTone(r.total_profit),
                      )}
                    >
                      {formatProfit(r.total_profit)}
                    </span>
                    <span className="text-right">{r.win_rate.toFixed(1)}%</span>
                    <span className="text-right">{r.total_bets}</span>
                  </Link>
                );
                })}
                {sorted.length === 0 && (
                  <p className="text-center py-8 text-muted-foreground">
                    {emptyRankingsMessage}
                  </p>
                )}
              </>,
            )}
          </>
        )}
      </div>
    </div>
  );
}
