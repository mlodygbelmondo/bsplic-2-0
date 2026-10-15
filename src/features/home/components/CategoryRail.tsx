import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { buildCategoryTree, type CategoryTreeNode } from '@/features/home/categoryTree';
import { cn } from '@/lib/utils';
import type { Category } from '@/types/database';

interface CategoryRailProps {
  categories: Category[];
  selectedCategory: string | null;
  onSelectCategory: (id: string | null) => void;
}

const REVEAL_MARGIN_PX = 24;

// Scrolls a horizontal strip just enough to show the item with some room.
function revealInStrip(strip: HTMLElement | null, item: HTMLElement | null, smooth: boolean) {
  if (!strip || !item || typeof strip.scrollTo !== 'function') return;
  const start = item.offsetLeft - REVEAL_MARGIN_PX;
  const end = item.offsetLeft + item.offsetWidth + REVEAL_MARGIN_PX;
  const behavior = smooth ? 'smooth' : 'auto';
  if (start < strip.scrollLeft) {
    strip.scrollTo({ left: start, behavior });
  } else if (end > strip.scrollLeft + strip.clientWidth) {
    strip.scrollTo({ left: end - strip.clientWidth, behavior });
  }
}

/**
 * Mobile home category picker: a scrollable rail of sport tiles and, under a
 * sport that has leagues, underline tabs for "Wszystkie" and each league.
 */
export function CategoryRail({ categories, selectedCategory, onSelectCategory }: CategoryRailProps) {
  const tree = useMemo(() => buildCategoryTree(categories), [categories]);
  const activeSport = useMemo(
    () =>
      tree.find(
        (node) =>
          node.category.id === selectedCategory ||
          node.children.some((child) => child.id === selectedCategory),
      ) ?? null,
    [tree, selectedCategory],
  );
  const activeSportId = activeSport?.category.id ?? null;

  const railRef = useRef<HTMLDivElement | null>(null);
  const tileRefs = useRef(new Map<string, HTMLButtonElement>());
  const revealedOnceRef = useRef(false);

  useEffect(() => {
    const tile = tileRefs.current.get(activeSportId ?? '');
    revealInStrip(railRef.current, tile ?? null, revealedOnceRef.current);
    revealedOnceRef.current = true;
  }, [activeSportId]);

  const tiles: { id: string | null; emoji: string; name: string }[] = [
    { id: null, emoji: '🌐', name: 'Wszystko' },
    ...tree.map(({ category }) => ({ id: category.id, emoji: category.emoji, name: category.name })),
  ];

  return (
    <div data-testid="category-rail">
      <div
        ref={railRef}
        className="relative flex gap-2.5 overflow-x-auto overscroll-x-contain px-3 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tiles.map((tile) => {
          const selected = tile.id === activeSportId;
          return (
            <button
              key={tile.id ?? 'all'}
              ref={(node) => {
                if (node) tileRefs.current.set(tile.id ?? '', node);
                else tileRefs.current.delete(tile.id ?? '');
              }}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelectCategory(tile.id)}
              className="press-scale flex w-14 shrink-0 flex-col items-center gap-1.5 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                aria-hidden="true"
                className={cn(
                  'grid h-12 w-12 place-items-center rounded-2xl border text-[22px] leading-none transition-[background-color,border-color,box-shadow] duration-200',
                  selected ? 'sport-rail-glow sport-rail-pop border-primary bg-primary' : 'border-border bg-card/80',
                )}
              >
                {tile.emoji}
              </span>
              <span
                className={cn(
                  'w-full truncate text-center text-[10.5px] leading-none transition-colors duration-200',
                  selected ? 'font-semibold text-foreground' : 'text-muted-foreground',
                )}
              >
                {tile.name}
              </span>
            </button>
          );
        })}
      </div>

      {activeSport && activeSport.children.length > 0 && (
        <LeagueTabs
          key={activeSport.category.id}
          sport={activeSport}
          selectedCategory={selectedCategory}
          onSelectCategory={onSelectCategory}
        />
      )}
    </div>
  );
}

function LeagueTabs({
  sport,
  selectedCategory,
  onSelectCategory,
}: {
  sport: CategoryTreeNode;
  selectedCategory: string | null;
  onSelectCategory: (id: string | null) => void;
}) {
  const stripRef = useRef<HTMLDivElement | null>(null);
  const activeTabRef = useRef<HTMLButtonElement | null>(null);
  const [indicator, setIndicator] = useState<{ x: number; width: number; animate: boolean } | null>(null);
  const tabs = [{ id: sport.category.id, name: 'Wszystkie' }, ...sport.children];

  // The underline slides between tabs; it jumps into place on first render.
  useLayoutEffect(() => {
    const tab = activeTabRef.current;
    if (!tab) return;
    setIndicator((previous) => ({ x: tab.offsetLeft, width: tab.offsetWidth, animate: previous !== null }));
    revealInStrip(stripRef.current, tab, true);
  }, [selectedCategory]);

  return (
    <div
      ref={stripRef}
      data-testid="league-tabs"
      className="league-tabs-enter relative flex h-10 gap-5 overflow-x-auto overscroll-x-contain px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((tab) => {
        const selected = tab.id === selectedCategory;
        return (
          <button
            key={tab.id}
            ref={selected ? activeTabRef : undefined}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelectCategory(tab.id)}
            className={cn(
              'shrink-0 whitespace-nowrap text-[13px] outline-none transition-colors duration-200 focus-visible:text-foreground',
              selected ? 'font-semibold text-foreground' : 'text-muted-foreground',
            )}
          >
            {tab.name}
          </button>
        );
      })}
      {indicator && (
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute bottom-0 left-0 h-[2px] rounded-full bg-primary',
            indicator.animate && 'league-tab-indicator',
          )}
          style={{ width: indicator.width, transform: `translateX(${indicator.x}px)` }}
        />
      )}
    </div>
  );
}
