import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Lightbulb } from "lucide-react";
import { BetCard } from "./BetCard";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SectionLoader } from "@/components/SectionLoader";
import { useBets, SortMode } from "@/features/home/hooks/useBets";
import { Category } from "@/types/database";

interface BetListProps {
  selectedCategory: string | null;
  onSelectCategory?: (id: string | null) => void;
  categories: Category[];
  categoryMap: Record<string, Category>;
  onProposeClick?: () => void;
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
  onProposeClick,
}: BetListProps) {
  const [sort, setSort] = useState<SortMode>(readStoredSort);
  const { loading, loadingMore, hasMore, loadMore, liveBets, sortedBets } =
    useBets(selectedCategory, sort);
  const loadMoreRef = useRef<HTMLButtonElement | null>(null);
  const [actionsHidden, setActionsHidden] = useState(false);
  const lastScrollTopRef = useRef(0);

  const handleSelectSort = (value: SortMode) => {
    setSort(value);
    try {
      window.localStorage.setItem(SORT_STORAGE_KEY, value);
    } catch {
      // Storage unavailable — sort just won't be remembered.
    }
  };

  // Hide the action row while scrolling down through the list and bring it
  // back as soon as the user scrolls up a little.
  const handleListScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop } = event.currentTarget;
    const delta = scrollTop - lastScrollTopRef.current;
    if (scrollTop <= 32) {
      setActionsHidden(false);
    } else if (delta > 4) {
      setActionsHidden(true);
    } else if (delta < -4) {
      setActionsHidden(false);
    }
    lastScrollTopRef.current = scrollTop;
  };

  // Changing sort/category remounts the scroll container at the top, so the
  // row must be visible again.
  useEffect(() => {
    setActionsHidden(false);
    lastScrollTopRef.current = 0;
  }, [sort, selectedCategory]);

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
      <div
        className={cn(
          "grid shrink-0 transition-all duration-300 ease-out",
          actionsHidden
            ? "grid-rows-[0fr] opacity-0 -translate-y-2 pointer-events-none"
            : "grid-rows-[1fr] opacity-100 translate-y-0",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5">
            <div className="flex items-center gap-1.5">
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
            {onProposeClick && (
              <Button
                onClick={onProposeClick}
                size="sm"
                className="propose-cta-button relative flex items-center overflow-hidden rounded-full text-[13px] font-bold h-9 px-4 py-1.5 gradient-cta text-primary-foreground shadow-md hover:brightness-110 transition"
              >
                <Lightbulb className="h-3 w-3" /> Zaproponuj zakład
              </Button>
            )}
          </div>
        </div>
      </div>

      {onSelectCategory && (
        <div className="lg:hidden mb-3 -mx-3 px-3 shrink-0">
          <div className="overflow-x-auto scrollbar-hide touch-pan-x">
            <div className="flex min-w-full w-max gap-1.5 pb-1 pr-1">
              <button
                onClick={() => onSelectCategory(null)}
                className={cn(
                  "press-scale shrink-0 flex items-center gap-1 px-3.5 py-2 rounded-full text-[12px] font-semibold transition-all duration-200",
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
                    "press-scale shrink-0 flex items-center gap-1 px-3.5 py-2 rounded-full text-[12px] font-semibold transition-all duration-200",
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
        <SectionLoader label="Wczytywanie zakładów..." className="flex-1" />
      ) : (
        <div
          key={`${sort}:${selectedCategory ?? "all"}`}
          onScroll={handleListScroll}
          className="overflow-y-auto pb-3 min-h-0"
        >
          {liveBets.length > 0 && (
            <div className="mb-4">
              <div className="grid gap-2.5 sm:grid-cols-2">
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

          <div className="space-y-2.5 mb-8">
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
