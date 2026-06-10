import { ChevronDown, ChevronUp } from "lucide-react";

import { SectionLoader } from "@/components/SectionLoader";
import {
  deriveCouponStatus,
  getDisplayedCouponOdds,
  getDisplayedCouponWin,
} from "@/features/coupons/display";
import { cn } from "@/lib/utils";

import {
  HISTORY_PREVIEW_SIZE,
  type ProfileHistoryState,
  type ProfileHistoryType,
  type SportsbookHistoryFilter,
} from "../hooks/useProfileHistory";

const HISTORY_TYPE_OPTIONS: [ProfileHistoryType, string][] = [
  ["sportsbook", "Zakłady"],
  ["casino", "Kasyno"],
];

const SPORTSBOOK_FILTER_LABELS: Record<SportsbookHistoryFilter, string> = {
  all: "Wszystkie",
  won: "Wygrane",
  lost: "Przegrane",
  pending: "W toku",
  refund: "Zwroty",
};

interface ProfileHistoryPanelProps {
  history: ProfileHistoryState;
}

export function ProfileHistoryPanel({ history }: ProfileHistoryPanelProps) {
  const visibleCoupons = history.sportsbookHistoryExpanded
    ? history.coupons
    : history.coupons.slice(0, HISTORY_PREVIEW_SIZE);
  const visibleCasinoHistory = history.casinoHistoryExpanded
    ? history.casinoHistory
    : history.casinoHistory.slice(0, HISTORY_PREVIEW_SIZE);

  const filtered = deriveSportsbookCouponRows(visibleCoupons, history.filter);

  return (
    <div className="app-surface rounded-xl p-4">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-bold">Historia</h2>
        <div className="app-subsurface inline-flex w-max items-center rounded-lg p-1">
          {HISTORY_TYPE_OPTIONS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => history.setHistoryType(value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                history.historyType === value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-primary/10 hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {history.historyType === "sportsbook" && (
        <SportsbookHistory history={history} filteredCoupons={filtered} />
      )}

      {history.historyType === "casino" && (
        <CasinoHistory
          history={history}
          visibleCasinoHistory={visibleCasinoHistory}
        />
      )}
    </div>
  );
}

function SportsbookHistory({
  history,
  filteredCoupons,
}: {
  history: ProfileHistoryState;
  filteredCoupons: ReturnType<typeof deriveSportsbookCouponRows>;
}) {
  return (
    <>
      <div className="-mx-1 mb-3 px-1 overflow-x-auto scrollbar-hide touch-pan-x">
        <div className="flex w-max min-w-full gap-2 pb-1 pr-1">
          {(
            Object.keys(SPORTSBOOK_FILTER_LABELS) as SportsbookHistoryFilter[]
          ).map((value) => (
            <button
              key={value}
              onClick={() => history.setFilter(value)}
              className={cn(
                "press-scale shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200",
                history.filter === value
                  ? "bg-foreground text-background shadow-md"
                  : "border border-border/70 bg-muted/60 text-muted-foreground hover:border-primary/30 hover:text-foreground",
              )}
            >
              {SPORTSBOOK_FILTER_LABELS[value]}
            </button>
          ))}
        </div>
      </div>

      {history.loadingCoupons ? (
        <HistorySkeleton />
      ) : (
        <div className="space-y-2">
          {history.sportsbookHistoryError ? (
            <p className="text-sm text-destructive text-center py-4">
              {history.sportsbookHistoryError}
            </p>
          ) : filteredCoupons.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Brak zakładów
            </p>
          ) : (
            filteredCoupons.map((coupon) => (
              <SportsbookCouponRow
                key={coupon.id}
                coupon={coupon}
                expanded={history.expandedCoupons.has(coupon.id)}
                onToggle={() => history.toggleCoupon(coupon.id)}
              />
            ))
          )}
        </div>
      )}

      {!history.loadingCoupons &&
        !history.sportsbookHistoryError &&
        history.coupons.length > 0 &&
        (history.sportsbookHistoryExpanded ||
          history.coupons.length > HISTORY_PREVIEW_SIZE ||
          history.hasMoreCoupons) && (
          <div className="mt-3 flex gap-2">
            {history.sportsbookHistoryExpanded && (
              <button
                type="button"
                onClick={history.collapseSportsbookHistory}
                className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                Pokaż mniej
              </button>
            )}
            {(!history.sportsbookHistoryExpanded || history.hasMoreCoupons) && (
              <button
                type="button"
                onClick={history.showMoreSportsbookHistory}
                disabled={history.loadingMoreCoupons}
                className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-wait disabled:opacity-70"
              >
                {history.loadingMoreCoupons ? "Ładowanie..." : "Pokaż więcej"}
              </button>
            )}
          </div>
        )}
    </>
  );
}

function SportsbookCouponRow({
  coupon,
  expanded,
  onToggle,
}: {
  coupon: ReturnType<typeof deriveSportsbookCouponRows>[number];
  expanded: boolean;
  onToggle: () => void;
}) {
  const ako = coupon.legs !== null && coupon.legs.length > 1;
  const displayedOdds = getDisplayedCouponOdds({
    totalOdds: Number(coupon.total_odds),
    legs: (coupon.legs ?? []).map((leg) => ({
      oddsAtTime: Number(leg.odds_at_time),
      result: leg.result,
    })),
  });
  const displayedWin = getDisplayedCouponWin({
    status: coupon.status,
    isAko: ako,
    stake: Number(coupon.stake),
    displayedOdds,
    couponPayout: Number(coupon.payout),
    legs: (coupon.legs ?? []).map((leg) => ({
      legPayout: Number(leg.leg_payout ?? 0),
    })),
  });

  return (
    <div className="app-subsurface rounded-lg overflow-hidden">
      <button
        type="button"
        className="flex items-center justify-between p-3 w-full text-sm text-left"
        onClick={() => ako && onToggle()}
      >
        <div className="min-w-0 flex-1">
          {ako ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary">
                AKO {coupon.legs!.length}
              </span>
              <span className="font-medium text-xs text-muted-foreground">
                kurs {displayedOdds.toFixed(2)}
              </span>
              {expanded ? (
                <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </div>
          ) : (
            <>
              <p className="font-medium truncate">
                {coupon.legs?.[0]?.bet_title || "Zakład"}
              </p>
              <p className="text-xs text-muted-foreground">
                {coupon.legs?.[0]?.selected_option} • kurs{" "}
                {displayedOdds.toFixed(2)}
              </p>
            </>
          )}
        </div>
        <div className="text-right ml-3 shrink-0">
          <p className="font-bold">{Number(coupon.stake).toFixed(2)} zł</p>
          <p
            className={cn(
              "text-xs font-medium",
              coupon.status === "won"
                ? "text-success"
                : coupon.status === "lost"
                  ? "text-destructive"
                  : coupon.status === "refund"
                    ? "text-primary"
                    : "text-muted-foreground",
            )}
          >
            {coupon.status === "won"
              ? `+${displayedWin.toFixed(2)} zł`
              : coupon.status === "lost"
                ? "Przegrana"
                : coupon.status === "refund"
                  ? `Zwrot ${displayedWin.toFixed(2)} zł`
                  : "W toku"}
          </p>
        </div>
      </button>

      {ako && expanded && (
        <div className="border-t border-border px-3 pb-3 pt-2 space-y-1.5">
          {coupon.legs!.map((leg) => (
            <div
              key={leg.id}
              className="flex items-center justify-between text-xs"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {leg.bet_title || "Zakład"}
                </p>
                <p className="text-muted-foreground">
                  {leg.selected_option} • kurs{" "}
                  {Number(leg.odds_at_time).toFixed(2)}
                </p>
              </div>
              <span
                className={cn(
                  "ml-2 shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded",
                  leg.result === "won"
                    ? "bg-success/10 text-success"
                    : leg.result === "lost"
                      ? "bg-destructive/10 text-destructive"
                      : leg.result === "refund"
                        ? "bg-primary/10 text-primary"
                        : "bg-muted-foreground/10 text-muted-foreground",
                )}
              >
                {leg.result === "won"
                  ? "Wygrana"
                  : leg.result === "lost"
                    ? "Przegrana"
                    : leg.result === "refund"
                      ? "Zwrot"
                      : "W toku"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CasinoHistory({
  history,
  visibleCasinoHistory,
}: {
  history: ProfileHistoryState;
  visibleCasinoHistory: ProfileHistoryState["casinoHistory"];
}) {
  return (
    <>
      {history.loadingCasinoHistory ? (
        <HistorySkeleton />
      ) : (
        <div className="space-y-2">
          {history.casinoHistoryError ? (
            <p className="text-sm text-destructive text-center py-4">
              {history.casinoHistoryError}
            </p>
          ) : history.casinoHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Brak betów z kasyna
            </p>
          ) : (
            visibleCasinoHistory.map((entry) => (
              <div
                key={entry.id}
                className="app-subsurface flex items-center justify-between rounded-lg p-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{entry.game_type}</p>
                    {entry.round_label && (
                      <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                        {entry.round_label}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {entry.bet_label}
                  </p>
                </div>
                <div className="ml-3 shrink-0 text-right">
                  <p className="font-bold">{entry.stake.toFixed(2)} zł</p>
                  <p
                    className={cn(
                      "text-xs font-medium",
                      entry.status === "won"
                        ? "text-success"
                        : entry.status === "lost"
                          ? "text-destructive"
                          : entry.status === "push"
                            ? "text-primary"
                            : "text-muted-foreground",
                    )}
                  >
                    {entry.status === "won"
                      ? `+${entry.payout.toFixed(2)} zł`
                      : entry.status === "lost"
                        ? "Przegrana"
                        : entry.status === "push"
                          ? `Zwrot ${entry.payout.toFixed(2)} zł`
                          : "W toku"}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {!history.loadingCasinoHistory &&
        !history.casinoHistoryError &&
        history.casinoHistory.length > 0 &&
        (history.casinoHistoryExpanded ||
          history.casinoHistory.length > HISTORY_PREVIEW_SIZE ||
          history.hasMoreCasinoHistory) && (
          <div className="mt-3 flex gap-2">
            {history.casinoHistoryExpanded && (
              <button
                type="button"
                onClick={history.collapseCasinoHistory}
                className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                Pokaż mniej
              </button>
            )}
            {(!history.casinoHistoryExpanded ||
              history.hasMoreCasinoHistory) && (
              <button
                type="button"
                onClick={history.showMoreCasinoHistory}
                disabled={history.loadingMoreCasinoHistory}
                className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-wait disabled:opacity-70"
              >
                {history.loadingMoreCasinoHistory
                  ? "Ładowanie..."
                  : "Pokaż więcej"}
              </button>
            )}
          </div>
        )}
    </>
  );
}

function HistorySkeleton() {
  return <SectionLoader size="sm" label="Wczytywanie historii..." />;
}

function deriveSportsbookCouponRows(
  coupons: ProfileHistoryState["coupons"],
  filter: SportsbookHistoryFilter,
) {
  return coupons
    .map((coupon) => ({
      ...coupon,
      status: deriveCouponStatus({
        status: coupon.status,
        legs: (coupon.legs ?? []).map((leg) => ({ result: leg.result })),
      }),
    }))
    .filter((coupon) => filter === "all" || coupon.status === filter);
}
