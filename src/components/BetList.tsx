import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
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
}: BetListProps) {
  const [sort, setSort] = useState<SortMode>(readStoredSort);
  const [activeOnly, setActiveOnly] = useState<boolean>(readStoredActiveOnly);
  const { loading, loadingMore, hasMore, loadMore, liveBets, sortedBets } =
    useBets(selectedCategory, sort, !activeOnly);
  const loadMoreRef = useRef<HTMLButtonElement | null>(null);
  const [actionsHidden, setActionsHidden] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<MobilePanelKind | null>(null);
  const scrollChromeStateRef = useRef<ScrollChromeState>();

  const toggleMobilePanel = (panel: MobilePanelKind) => {
    setMobilePanel((previous) => (previous === panel ? null : panel));
  };

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
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    const nextState = getNextScrollChromeState(scrollChromeStateRef.current, {
      scrollTop,
      scrollHeight,
      clientHeight,
    });

    scrollChromeStateRef.current = nextState;
    setActionsHidden(nextState.hidden);
    if (nextState.hidden) {
      setMobilePanel(null);
    }
  };

  const handleToggleActiveOnly = () => {
    setActiveOnly((previous) => {
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
      {/* Backdrop closing the mobile dropdowns. Lives outside the filter bar
          because the bar is transformed, which would re-anchor fixed
          positioning to the bar instead of the viewport. */}
      {mobilePanel !== null && (
        <div
          className="fixed inset-0 z-20 lg:hidden"
          aria-hidden="true"
          onClick={() => setMobilePanel(null)}
        />
      )}
      <div
        className={cn(
          // Explicit z-index keeps the floating mobile dropdowns above the
          // bet cards, which create their own stacking contexts via the
          // bet-card-enter animation.
          "relative z-30 grid shrink-0 transition-all duration-300 ease-out",
          actionsHidden
            ? "grid-rows-[0fr] opacity-0 -translate-y-2 pointer-events-none"
            : "grid-rows-[1fr] opacity-100 translate-y-0",
        )}
      >
        {/* overflow-hidden only while the bar is collapsing/collapsed —
            otherwise it would clip the floating mobile dropdowns. */}
        <div
          className={cn(
            "min-h-0",
            actionsHidden ? "overflow-hidden" : "overflow-visible",
          )}
        >
          <div className="hidden lg:flex flex-wrap items-center justify-between gap-2 pb-2.5">
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

          {/* Mobile: one bar split into two dropdown triggers — bet types on
              the left, categories on the right. */}
          <div className="lg:hidden flex items-start gap-2 pb-2.5">
            {/* Left column: bet view type + Aktywne, options stack under
                the trigger. */}
            <div className="relative z-30 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => toggleMobilePanel("sort")}
                aria-expanded={mobilePanel === "sort"}
                className={cn(
                  "press-scale flex w-full min-w-0 items-center justify-between gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-all duration-200",
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
                      "press-scale w-full px-3.5 py-2 rounded-full text-[12px] font-semibold text-left transition-all duration-200",
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
                    "press-scale flex w-full items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-semibold transition-all duration-200",
                    mobilePanel === "sort" && "filter-option-enter",
                    activeOnly
                      ? "bg-foreground text-background shadow-md"
                      : "bg-card text-muted-foreground border border-border hover:text-foreground hover:border-foreground/30",
                  )}
                  style={{ "--stagger": SORT_OPTIONS.length } as CSSProperties}
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
                    "press-scale flex w-full min-w-0 items-center justify-between gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-all duration-200",
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
                      "press-scale flex w-full items-center gap-1 px-3.5 py-2 rounded-full text-[12px] font-semibold transition-all duration-200",
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
                        "press-scale flex w-full items-center gap-1 px-3.5 py-2 rounded-full text-[12px] font-semibold transition-all duration-200",
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
      </div>

      {loading ? (
        <SectionLoader label="Wczytywanie zakładów..." className="flex-1" />
      ) : (
        <div
          key={`${sort}:${selectedCategory ?? "all"}:${activeOnly ? "active" : "all-states"}`}
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
