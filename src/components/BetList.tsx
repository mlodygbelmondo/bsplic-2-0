import { useState } from 'react';
import { BetCard } from './BetCard';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useBets, SortMode } from '@/features/home/hooks/useBets';
import { Category } from '@/types/database';

interface BetListProps {
  selectedCategory: string | null;
  onSelectCategory?: (id: string | null) => void;
  categories: Category[];
  categoryMap: Record<string, Category>;
}

export function BetList({ selectedCategory, onSelectCategory, categories, categoryMap }: BetListProps) {
  const [sort, setSort] = useState<SortMode>('popular');
  const { loading, liveBets, sortedBets } = useBets(selectedCategory, sort);

  return (
    <div className="flex-1 min-w-0 h-full flex flex-col">
      <div className="flex items-center border-b border-border mb-3 shrink-0">
        <button
          onClick={() => setSort('popular')}
          className={cn(
            'px-4 py-2 text-[13px] font-semibold border-b-2 -mb-[1px] transition-colors',
            sort === 'popular' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          Popularne
        </button>
        <button
          onClick={() => setSort('newest')}
          className={cn(
            'px-4 py-2 text-[13px] font-semibold border-b-2 -mb-[1px] transition-colors',
            sort === 'newest' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          Najnowsze
        </button>
      </div>

      {onSelectCategory && (
        <div className="lg:hidden mb-3 -mx-3 px-3 shrink-0">
          <div className="overflow-x-auto scrollbar-hide touch-pan-x">
            <div className="flex min-w-full w-max gap-1.5 pb-1 pr-1">
              <button
                onClick={() => onSelectCategory(null)}
                className={cn(
                  'shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all',
                  !selectedCategory
                    ? 'gradient-primary text-primary-foreground shadow-sm'
                    : 'bg-card text-foreground border border-border hover:border-foreground/30'
                )}
              >
                🌐 Wszystkie
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => onSelectCategory(cat.id)}
                  className={cn(
                    'shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all',
                    selectedCategory === cat.id
                      ? 'gradient-primary text-primary-foreground shadow-sm'
                      : 'bg-card text-foreground border border-border hover:border-foreground/30'
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
        <div className="space-y-2 overflow-y-auto px-1 pb-1 -mx-1">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card rounded-lg card-shadow p-4 space-y-3">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-12" />
              </div>
              <div className="flex justify-center gap-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <Skeleton className="h-12 rounded-md" />
                <Skeleton className="h-12 rounded-md" />
                <Skeleton className="h-12 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-y-auto px-1 pb-1 -mx-1 min-h-0">
          {liveBets.length > 0 && (
            <div className="mb-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {liveBets.map((bet) => (
                  <BetCard key={bet.id} bet={bet} category={bet.category_id ? categoryMap[bet.category_id] : undefined} />
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            {sortedBets.length === 0 && liveBets.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <p className="text-base font-medium">Brak dostępnych zakładów</p>
                <p className="text-[13px] mt-1">Wróć później lub zmień kategorię</p>
              </div>
            ) : (
              sortedBets.map((bet) => (
                <BetCard key={bet.id} bet={bet} category={bet.category_id ? categoryMap[bet.category_id] : undefined} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
