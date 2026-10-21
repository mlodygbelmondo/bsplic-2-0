import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { ArrowUpDown, ChevronDown, Lightbulb } from "lucide-react";
import { BetCard } from "./BetCard";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SectionLoader } from "@/components/SectionLoader";
import { getCategoryFilterIds } from "@/features/home/categoryTree";
import { CategoryRail } from "@/features/home/components/CategoryRail";
import { SortSheet } from "@/features/home/components/SortSheet";
import { useBets, SortMode } from "@/features/home/hooks/useBets";
import { SORT_OPTIONS } from "@/features/home/sortOptions";
import { polishPlural } from "@/features/social/lib/socialFormatters";
import {
  getNextScrollChromeState,
  type ScrollChromeState,
} from "@/lib/scroll-chrome";
import { Bet, Category } from "@/types/database";

interface BetListProps {
  selectedCategory: string | null;
  onSelectCategory?: (id: string | null) => void;
  categories: Category[];
  categoryMap: Record<string, Category>;
  onProposeClick?: () => void;
  onScrollChromeHiddenChange?: (hidden: boolean) => void;
  topBanner?: ReactNode;
}

export interface BetListData {
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  loadMore: () => void | Promise<void>;
  liveBets: Bet[];
  sortedBets: Bet[];
}

interface BetListViewProps extends BetListProps {
  bets: BetListData;
}

const SORT_STORAGE_KEY = "bsplic.home.sort";
const ACTIVE_ONLY_STORAGE_KEY = "bsplic.home.activeOnly";

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

function readStoredActiveOnly(): boolean {
  try {
    return window.localStorage.getItem(ACTIVE_ONLY_STORAGE_KEY) !== "false";
  } catch {
    // Storage unavailable — default to active-only.
  }
  return true;
}

export function BetList({
  selectedCategory,
  onSelectCategory,
  categories,
  categoryMap,
  onProposeClick,
  onScrollChromeHiddenChange,
  topBanner,
}: BetListProps) {
  const [sort, setSort] = useState<SortMode>(readStoredSort);
  const [activeOnly, setActiveOnly] = useState<boolean>(readStoredActiveOnly);
  const categoryIds = useMemo(
    () => getCategoryFilterIds(categories, selectedCategory),
    [categories, selectedCategory],
  );
  // A remembered sport needs the category list to know its leagues; wait for
  // it instead of loading the sport alone and then reloading.
  const categoryIdsReady =
    !selectedCategory || Boolean(categoryMap[selectedCategory]);
  const bets = useBets(categoryIds, sort, !activeOnly, categoryIdsReady);

  return (
    <BetListView
      selectedCategory={selectedCategory}
      onSelectCategory={onSelectCategory}
      categories={categories}
      categoryMap={categoryMap}
      onProposeClick={onProposeClick}
      onScrollChromeHiddenChange={onScrollChromeHiddenChange}
      topBanner={topBanner}
      bets={bets}
      sort={sort}
      onSortChange={setSort}
      activeOnly={activeOnly}
      onActiveOnlyChange={setActiveOnly}
    />
  );
}

interface BetListViewInternalProps extends BetListViewProps {
  sort: SortMode;
  onSortChange: Dispatch<SetStateAction<SortMode>>;
  activeOnly: boolean;
  onActiveOnlyChange: Dispatch<SetStateAction<boolean>>;
}

export function BetListView({
  selectedCategory,
  onSelectCategory,
  categories,
  categoryMap,
  onProposeClick,
  onScrollChromeHiddenChange,
  topBanner,
  bets,
  sort,
  onSortChange,
  activeOnly,
  onActiveOnlyChange,
}: BetListViewInternalProps) {
  const { loading, loadingMore, hasMore, loadMore, liveBets, sortedBets } =
    bets;
  const loadMoreRef = useRef<HTMLButtonElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [actionsHidden, setActionsHidden] = useState(false);
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const scrollChromeStateRef = useRef<ScrollChromeState>();

  // Only the very first load shows the loader. Later sort/category changes
  // keep the filters and the previous bets on screen (dimmed) until the new
  // ones arrive, then the list re-enters with its card animation.
  const [hasShownBets, setHasShownBets] = useState(!loading);
  if (!loading && !hasShownBets) {
    setHasShownBets(true);
  }
  const refreshing = loading && hasShownBets;
  const criteriaKey = `${sort}:${selectedCategory ?? "all"}:${activeOnly ? "active" : "all-states"}`;
  const [listKey, setListKey] = useState(criteriaKey);
  if (!loading && listKey !== criteriaKey) {
    setListKey(criteriaKey);
  }

  const betCount = liveBets.length + sortedBets.length;
  const sortLabel =
    SORT_OPTIONS.find((option) => option.value === sort)?.label ?? "Sortowanie";

  const handleSelectSort = (value: SortMode) => {
    onSortChange(value);
    try {
      window.localStorage.setItem(SORT_STORAGE_KEY, value);
    } catch {
      // Storage unavailable — sort just won't be remembered.
    }
  };

  // Hide the action row while scrolling down through the list and bring it
  // back as soon as the user scrolls up a little.
  const handleListScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    const nextState = getNextScrollChromeState(scrollChromeStateRef.current, {
      scrollTop,
      scrollHeight,
      clientHeight,
    });

    scrollChromeStateRef.current = nextState;
    setActionsHidden((current) =>
      current === nextState.hidden ? current : nextState.hidden,
    );
  };

  const handleToggleActiveOnly = () => {
    onActiveOnlyChange((previous) => {
      const next = !previous;
      try {
        window.localStorage.setItem(ACTIVE_ONLY_STORAGE_KEY, String(next));
      } catch {
        // Storage unavailable — preference just won't be remembered.
      }
      return next;
    });
  };

  // A new sort/category starts at the top of the list with the filters shown.
  useEffect(() => {
    setActionsHidden(false);
    scrollChromeStateRef.current = undefined;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [sort, selectedCategory, activeOnly]);

  useEffect(() => {
    onScrollChromeHiddenChange?.(actionsHidden);
  }, [actionsHidden, onScrollChromeHiddenChange]);

  useEffect(() => {
    if (loading || !hasMore || typeof IntersectionObserver === "undefined") {
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
      {loading && !hasShownBets ? (
        <SectionLoader label="Wczytywanie zakładów..." className="flex-1" />
      ) : (
        <div
          ref={scrollContainerRef}
          data-testid="bet-list-scroll-container"
          onScroll={handleListScroll}
          className="-mx-3 min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[calc(5.75rem+env(safe-area-inset-bottom))] lg:mx-0 lg:px-0 lg:pb-3"
        >
          <div
            data-testid="bet-list-desktop-toolbar"
            className={cn(
              "sticky top-0 z-30 hidden bg-transparent pb-2.5 transition-[transform,opacity] duration-200 ease-out will-change-transform lg:block",
              actionsHidden
                ? "-translate-y-full opacity-0 pointer-events-none"
                : "translate-y-0 opacity-100",
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
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
                <span className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />
                <button
                  type="button"
                  onClick={handleToggleActiveOnly}
                  aria-pressed={activeOnly}
                  title={
                    activeOnly
                      ? "Pokazywane są tylko zakłady, które można obstawić"
                      : "Pokazywane są też zakłady w trakcie rozliczania"
                  }
                  className={cn(
                    "press-scale flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-all duration-200",
                    activeOnly
                      ? "bg-foreground text-background shadow-md"
                      : "bg-card/80 text-muted-foreground border border-border hover:text-foreground hover:border-foreground/30",
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full transition-colors duration-200",
                      activeOnly ? "bg-success" : "bg-muted-foreground/50",
                    )}
                    aria-hidden="true"
                  />
                  Aktywne
                </button>
              </div>
              {onProposeClick && (
                <Button
                  onClick={onProposeClick}
                  size="sm"
                  className="propose-cta-button relative hidden lg:inline-flex items-center overflow-hidden rounded-full text-[13px] font-bold h-9 px-4 py-1.5 gradient-cta text-primary-foreground shadow-md hover:brightness-110 transition"
                >
                  <Lightbulb className="h-3 w-3" /> Zaproponuj zakład
                </Button>
              )}
            </div>
          </div>

          {/* Mobile: sticky inside the scroll container, so hiding it with a
              transform does not change the scroll container height mid-gesture.
              It bleeds into the container's side padding to span the screen. */}
          <div
            data-testid="bet-list-mobile-toolbar"
            className={cn(
              "home-filter-bar sticky top-0 z-30 -mx-3 mb-2.5 border-b border-border/60 transition-transform duration-200 ease-out lg:hidden",
              actionsHidden
                ? "-translate-y-full opacity-100 pointer-events-none"
                : "translate-y-0 opacity-100 will-change-transform",
            )}
          >
            {onSelectCategory && categories.length > 0 && (
              <CategoryRail
                categories={categories}
                selectedCategory={selectedCategory}
                onSelectCategory={onSelectCategory}
              />
            )}
            <div className="flex h-11 items-center justify-between gap-3 px-3">
              <p
                data-testid="bet-list-count"
                className={cn(
                  "min-w-0 truncate text-[13px] text-muted-foreground transition-opacity duration-200",
                  refreshing && "opacity-40",
                )}
              >
                <span className="font-semibold tabular-nums text-foreground">
                  {betCount}
                  {hasMore ? "+" : ""}
                </span>{" "}
                {polishPlural(betCount, {
                  one: "zakład",
                  few: "zakłady",
                  many: "zakładów",
                })}
                {!activeOnly && " · też w trakcie"}
              </p>
              <button
                type="button"
                data-testid="bet-list-sort-trigger"
                onClick={() => setSortSheetOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={sortSheetOpen}
                className="press-scale -mr-1.5 flex h-9 shrink-0 items-center gap-1.5 rounded-full px-1.5 text-[13px] font-semibold text-foreground"
              >
                <ArrowUpDown
                  className="h-3.5 w-3.5 text-muted-foreground"
                  aria-hidden="true"
                />
                {sortLabel}
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 text-muted-foreground transition-transform duration-300",
                    sortSheetOpen && "rotate-180",
                  )}
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>

          <SortSheet
            open={sortSheetOpen}
            onClose={() => setSortSheetOpen(false)}
            sort={sort}
            onSortChange={handleSelectSort}
            activeOnly={activeOnly}
            onToggleActiveOnly={handleToggleActiveOnly}
          />

          {topBanner}

          <div
            key={listKey}
            data-testid="bet-list-results"
            aria-busy={refreshing}
            className={cn(
              "transition-opacity duration-200",
              refreshing && "pointer-events-none opacity-40",
            )}
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
        </div>
      )}
    </div>
  );
}
