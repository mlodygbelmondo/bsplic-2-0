import { useState } from "react";
import { Clock3, Flame, SearchX, Timer } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useBets, type SortMode } from "@/features/home/hooks/useBets";
import type { Category } from "@/types/database";

import { BetCard } from "./BetCard";

interface BetListProps {
  selectedCategory: string | null;
  onSelectCategory?: (id: string | null) => void;
  categories: Category[];
  categoryMap: Record<string, Category>;
}

const SORT_TABS: Array<{ mode: SortMode; label: string; Icon: LucideIcon }> = [
  { mode: "newest", label: "Najnowsze", Icon: Clock3 },
  { mode: "popular", label: "Popularne", Icon: Flame },
  { mode: "ending_soon", label: "Kończące się", Icon: Timer },
];

export function BetList({
  selectedCategory,
  onSelectCategory,
  categories,
  categoryMap,
}: BetListProps) {
  const [sort, setSort] = useState<SortMode>("newest");
  const { loading, liveBets, sortedBets } = useBets(selectedCategory, sort);

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <div className="mb-3 grid shrink-0 grid-cols-3 gap-1 rounded-lg border border-white/10 bg-black/[0.22] p-1">
        {SORT_TABS.map(({ mode, label, Icon }) => (
          <button
            key={mode}
            onClick={() => setSort(mode)}
            aria-pressed={sort === mode}
            className={cn(
              "flex h-9 min-w-0 items-center justify-center gap-1 rounded-md px-1.5 text-[11px] font-black transition-colors sm:gap-1.5 sm:px-2 sm:text-[13px]",
              sort === mode
                ? "bg-primary text-primary-foreground shadow-[0_10px_26px_rgba(220,0,32,0.28)]"
                : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="whitespace-nowrap">{label}</span>
          </button>
        ))}
      </div>

      {onSelectCategory && (
        <div className="lg:hidden mb-3 -mx-3 px-3 shrink-0">
          <div className="overflow-x-auto scrollbar-hide touch-pan-x">
            <div className="flex min-w-full w-max gap-1.5 pb-1 pr-1">
              <button
                onClick={() => onSelectCategory(null)}
                className={cn(
                  "flex h-8 shrink-0 items-center gap-1 rounded-full border px-3 text-[12px] font-black transition-all",
                  !selectedCategory
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-white/10 bg-card text-foreground hover:border-white/25",
                )}
              >
                🌐 Wszystkie
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => onSelectCategory(cat.id)}
                  className={cn(
                    "flex h-8 shrink-0 items-center gap-1 rounded-full border px-3 text-[12px] font-black transition-all",
                    selectedCategory === cat.id
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-white/10 bg-card text-foreground hover:border-white/25",
                  )}
                >
                  {cat.emoji} {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="-mx-1 min-h-0 space-y-2 overflow-y-auto px-1 pb-[calc(var(--app-bottom-nav-space)+1rem)] pr-2 lg:pb-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="sportsbook-event-skeleton space-y-3 rounded-lg border border-white/10 p-3"
            >
              <div className="flex justify-between gap-3">
                <Skeleton className="h-3 w-28 bg-white/[0.08]" />
                <Skeleton className="h-3 w-16 bg-white/[0.08]" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-4/5 bg-white/[0.08]" />
                <Skeleton className="h-3 w-44 bg-white/[0.08]" />
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <Skeleton className="h-12 rounded-md bg-white/[0.08]" />
                <Skeleton className="h-12 rounded-md bg-white/[0.08]" />
                <Skeleton className="h-12 rounded-md bg-white/[0.08]" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="-mx-1 min-h-0 overflow-y-auto px-1 pb-[calc(var(--app-bottom-nav-space)+1rem)] pr-2 lg:pb-3">
          {liveBets.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-primary">
                <Flame className="h-3.5 w-3.5" />
                Live teraz
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {liveBets.map((bet) => (
                  <BetCard
                    key={bet.id}
                    bet={bet}
                    category={
                      bet.category_id ? categoryMap[bet.category_id] : undefined
                    }
                  />
                ))}
              </div>
            </div>
          )}

          <div className="mb-8 space-y-2">
            {sortedBets.length === 0 && liveBets.length === 0 ? (
              <div className="rounded-lg border border-white/10 bg-card/70 px-5 py-12 text-center text-muted-foreground card-shadow">
                <SearchX className="mx-auto mb-3 h-7 w-7 text-primary/80" />
                <p className="text-base font-black text-foreground">
                  Brak dostępnych zdarzeń
                </p>
                <p className="text-[13px] mt-1">
                  Wróć później lub zmień kategorię
                </p>
              </div>
            ) : (
              <div className="grid gap-2 xl:grid-cols-2">
                {sortedBets.map((bet) => (
                  <BetCard
                    key={bet.id}
                    bet={bet}
                    category={
                      bet.category_id ? categoryMap[bet.category_id] : undefined
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
