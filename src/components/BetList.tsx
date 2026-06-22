import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { ChevronDown, Lightbulb } from "lucide-react";
import { BetCard } from "./BetCard";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SectionLoader } from "@/components/SectionLoader";
import { useBets, SortMode } from "@/features/home/hooks/useBets";
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

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "newest", label: "Najnowsze" },
  { value: "popular", label: "Popularne" },
  { value: "ending_soon", label: "Kończące się" },
];

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

type MobilePanelKind = "sort" | "category";

// Floating dropdown under a mobile filter trigger — overlays the bet list
// instead of pushing it down. Options inside get the cascading
// filter-option-enter animation when it opens.
function MobileFilterPanel({
  open,
  children,
}: {
  open: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "absolute left-0 right-0 top-[calc(100%+8px)] z-30 flex max-h-[55dvh] flex-col gap-1.5 overflow-y-auto overscroll-contain bg-transparent transition-opacity duration-150 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        open
          ? "pointer-events-auto opacity-100"
          : "pointer-events-none opacity-0",
      )}
    >
      {children}
    </div>
  );
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
  const bets = useBets(selectedCategory, sort, !activeOnly);

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
  const mobileToolbarRef = useRef<HTMLDivElement | null>(null);
  const [actionsHidden, setActionsHidden] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<MobilePanelKind | null>(null);
  const scrollChromeStateRef = useRef<ScrollChromeState>();

  const toggleMobilePanel = (panel: MobilePanelKind) => {
    setMobilePanel((previous) => (previous === panel ? null : panel));
  };

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
    if (nextState.hidden) {
      setMobilePanel(null);
    }
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

  // Changing sort/category remounts the scroll container at the top, so the
  // row must be visible again.
  useEffect(() => {
    setActionsHidden(false);
    scrollChromeStateRef.current = undefined;
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

  useEffect(() => {
    if (mobilePanel === null) {
      return;
    }

    const handleOutsidePress = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (mobileToolbarRef.current?.contains(target)) {
        return;
      }
      setMobilePanel(null);
    };

    document.addEventListener("pointerdown", handleOutsidePress);
    document.addEventListener("mousedown", handleOutsidePress);
    document.addEventListener("touchstart", handleOutsidePress, {
      passive: true,
    });

    return () => {
      document.removeEventListener("pointerdown", handleOutsidePress);
      document.removeEventListener("mousedown", handleOutsidePress);
      document.removeEventListener("touchstart", handleOutsidePress);
    };
  }, [mobilePanel]);

  return (
    <div className="flex-1 min-w-0 h-full flex flex-col">
      {loading ? (
        <SectionLoader label="Wczytywanie zakładów..." className="flex-1" />
      ) : (
        <div
          data-testid="bet-list-scroll-container"
          key={`${sort}:${selectedCategory ?? "all"}:${activeOnly ? "active" : "all-states"}`}
          onScroll={handleListScroll}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(5.75rem+env(safe-area-inset-bottom))] lg:pb-3"
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
              transform does not change the scroll container height mid-gesture. */}
          <div
            ref={mobileToolbarRef}
            data-testid="bet-list-mobile-toolbar"
            className={cn(
              "sticky top-0 mb-2.5 lg:hidden transition-transform duration-200 ease-out",
              mobilePanel !== null ? "z-50" : "z-30",
              actionsHidden
                ? "-translate-y-full opacity-100 pointer-events-none"
                : "translate-y-0 opacity-100",
              !actionsHidden && mobilePanel === null && "will-change-transform",
            )}
          >
            <div className="flex items-start gap-2 bg-transparent pb-2 pt-2">
              {/* Left column: bet view type + Aktywne, options stack under
                  the trigger. */}
              <div className="relative z-30 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => toggleMobilePanel("sort")}
                  aria-expanded={mobilePanel === "sort"}
                  className={cn(
                    "press-scale flex h-11 w-full min-w-0 items-center justify-between gap-1.5 rounded-full border px-3.5 text-sm font-semibold leading-none transition-all duration-200",
                    mobilePanel === "sort"
                      ? "border-foreground/40 bg-card text-foreground shadow-md"
                      : "border-border bg-card/80 text-foreground",
                  )}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    {activeOnly && (
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-success"
                        aria-hidden="true"
                      />
                    )}
                    <span className="truncate">
                      {SORT_OPTIONS.find((option) => option.value === sort)
                        ?.label ?? "Sortowanie"}
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                      mobilePanel === "sort" && "rotate-180",
                    )}
                  />
                </button>

                <MobileFilterPanel open={mobilePanel === "sort"}>
                  {SORT_OPTIONS.map((option, index) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        handleSelectSort(option.value);
                        setMobilePanel(null);
                      }}
                      className={cn(
                        "press-scale h-11 w-full shrink-0 rounded-full px-3.5 text-left text-sm font-semibold leading-none transition-all duration-200",
                        mobilePanel === "sort" && "filter-option-enter",
                        sort === option.value
                          ? "bg-foreground text-background shadow-md"
                          : "bg-card text-foreground border border-border hover:border-foreground/30",
                      )}
                      style={{ "--stagger": index } as CSSProperties}
                    >
                      {option.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleToggleActiveOnly}
                    aria-pressed={activeOnly}
                    className={cn(
                      "press-scale flex h-11 w-full shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold leading-none transition-all duration-200",
                      mobilePanel === "sort" && "filter-option-enter",
                      activeOnly
                        ? "bg-foreground text-background shadow-md"
                        : "bg-card text-muted-foreground border border-border hover:text-foreground hover:border-foreground/30",
                    )}
                    style={
                      { "--stagger": SORT_OPTIONS.length } as CSSProperties
                    }
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
                </MobileFilterPanel>
              </div>

              {/* Right column: categories, stacked under the trigger. */}
              {onSelectCategory && (
                <div className="relative z-30 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => toggleMobilePanel("category")}
                    aria-expanded={mobilePanel === "category"}
                    className={cn(
                      "press-scale flex h-11 w-full min-w-0 items-center justify-between gap-1.5 rounded-full border px-3.5 text-sm font-semibold leading-none transition-all duration-200",
                      mobilePanel === "category"
                        ? "border-foreground/40 bg-card text-foreground shadow-md"
                        : "border-border bg-card/80 text-foreground",
                    )}
                  >
                    <span className="truncate">
                      {selectedCategory && categoryMap[selectedCategory]
                        ? `${categoryMap[selectedCategory].emoji} ${categoryMap[selectedCategory].name}`
                        : "🌐 Wszystkie"}
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                        mobilePanel === "category" && "rotate-180",
                      )}
                    />
                  </button>

                  <MobileFilterPanel open={mobilePanel === "category"}>
                    <button
                      onClick={() => {
                        onSelectCategory(null);
                        setMobilePanel(null);
                      }}
                      className={cn(
                        "press-scale flex h-11 w-full shrink-0 items-center gap-1 rounded-full px-3.5 text-sm font-semibold leading-none transition-all duration-200",
                        mobilePanel === "category" && "filter-option-enter",
                        !selectedCategory
                          ? "bg-foreground text-background shadow-md"
                          : "bg-card text-foreground border border-border hover:border-foreground/30",
                      )}
                      style={{ "--stagger": 0 } as CSSProperties}
                    >
                      🌐 Wszystkie
                    </button>
                    {categories.map((cat, index) => (
                      <button
                        key={cat.id}
                        onClick={() => {
                          onSelectCategory(cat.id);
                          setMobilePanel(null);
                        }}
                        className={cn(
                          "press-scale flex h-11 w-full shrink-0 items-center gap-1 rounded-full px-3.5 text-sm font-semibold leading-none transition-all duration-200",
                          mobilePanel === "category" && "filter-option-enter",
                          selectedCategory === cat.id
                            ? "bg-foreground text-background shadow-md"
                            : "bg-card text-foreground border border-border hover:border-foreground/30",
                        )}
                        style={{ "--stagger": index + 1 } as CSSProperties}
                      >
                        {cat.emoji} {cat.name}
                      </button>
                    ))}
                  </MobileFilterPanel>
                </div>
              )}
            </div>
          </div>

          {topBanner}

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
