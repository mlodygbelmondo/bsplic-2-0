import { useEffect, useRef, useState, type CSSProperties } from "react";
import { BetCard } from "./BetCard";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useBets, SortMode } from "@/features/home/hooks/useBets";
import { Category } from "@/types/database";

interface BetListProps {
  selectedCategory: string | null;
  onSelectCategory?: (id: string | null) => void;
  categories: Category[];
  categoryMap: Record<string, Category>;
}

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "newest", label: "Najnowsze" },
  { value: "popular", label: "Popularne" },
  { value: "ending_soon", label: "Kończące się" },
];

const SORT_STORAGE_KEY = "bsplic.home.sort";

function readStoredSort(): SortMode {
  try {
    const raw = window.localStorage.getItem(SORT_STORAGE_KEY);
    if (SORT_OPTIONS.some((option) => option.value === raw)) {
      return raw as SortMode;
    }
  } catch {
    // Storage unavailable — use the default sort.
  }
  return "newest";
}

export function BetList({
  selectedCategory,
  onSelectCategory,
  categories,
  categoryMap,
}: BetListProps) {
  const [sort, setSort] = useState<SortMode>(readStoredSort);
  const { loading, loadingMore, hasMore, loadMore, liveBets, sortedBets } =
    useBets(selectedCategory, sort);
  const loadMoreRef = useRef<HTMLButtonElement | null>(null);

  const handleSelectSort = (value: SortMode) => {
    setSort(value);
    try {
      window.localStorage.setItem(SORT_STORAGE_KEY, value);
    } catch {
      // Storage unavailable — sort just won't be remembered.
    }
  };

  useEffect(() => {
    if (
      loading ||
      !hasMore ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }

    const sentinel = loadMoreRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMore();
        }
      },
      { rootMargin: "400px 0px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore, loading]);

  return (
    <div className="flex-1 min-w-0 h-full flex flex-col">
      <div className="flex items-center gap-1.5 mb-3 shrink-0">
        {SORT_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => handleSelectSort(option.value)}
            className={cn(
              "press-scale px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-all duration-200",
              sort === option.value
                ? "bg-foreground text-background shadow-md"
                : "bg-card/80 text-muted-foreground border border-border hover:text-foreground hover:border-foreground/30",
            )}
          >
            {option.label}
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
                  "press-scale shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all duration-200",
                  !selectedCategory
                    ? "bg-foreground text-background shadow-md"
                    : "bg-card text-foreground border border-border hover:border-foreground/30",
                )}
              >
                🌐 Wszystkie
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => onSelectCategory(cat.id)}
                  className={cn(
                    "press-scale shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all duration-200",
                    selectedCategory === cat.id
                      ? "bg-foreground text-background shadow-md"
                      : "bg-card text-foreground border border-border hover:border-foreground/30",
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
        <div className="space-y-2 overflow-y-auto px-1 pr-2 pb-3 -mx-1 min-h-0">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="bg-card border border-border/60 rounded-lg overflow-hidden card-shadow"
            >
              <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/50">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-10" />
              </div>
              <div className="px-3 py-2.5">
                <div className="mb-3 flex flex-col items-center gap-1.5">
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <Skeleton className="h-[52px] rounded-md" />
                  <Skeleton className="h-[52px] rounded-md" />
                  <Skeleton className="h-[52px] rounded-md" />
                </div>
                <Skeleton className="mt-2 h-[3px] w-full rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          key={`${sort}:${selectedCategory ?? "all"}`}
          className="overflow-y-auto px-1 pr-2 pb-3 -mx-1 min-h-0"
        >
          {liveBets.length > 0 && (
            <div className="mb-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {liveBets.map((bet, index) => (
                  <div
                    key={bet.id}
                    className="bet-card-enter"
                    style={{ "--stagger": Math.min(index, 8) } as CSSProperties}
                  >
                    <BetCard
                      bet={bet}
                      category={
                        bet.category_id
                          ? categoryMap[bet.category_id]
                          : undefined
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2 mb-8">
            {sortedBets.length === 0 && liveBets.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <p className="text-base font-medium">
                  Brak dostępnych zakładów
                </p>
                <p className="text-[13px] mt-1">
                  Wróć później lub zmień kategorię
                </p>
              </div>
            ) : (
              sortedBets.map((bet, index) => (
                <div
                  key={bet.id}
                  className="bet-card-enter"
                  style={
                    {
                      "--stagger": Math.min(index + liveBets.length, 8),
                    } as CSSProperties
                  }
                >
                  <BetCard
                    bet={bet}
                    category={
                      bet.category_id ? categoryMap[bet.category_id] : undefined
                    }
                  />
                </div>
              ))
            )}
            {hasMore && (
              <button
                type="button"
                ref={loadMoreRef}
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-wait disabled:opacity-70"
              >
                {loadingMore ? "Ładowanie..." : "Pokaż więcej"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
