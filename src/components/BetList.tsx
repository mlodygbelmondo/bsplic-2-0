import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Bet, Category } from '@/types/database';
import { BetCard } from './BetCard';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface BetListProps {
  selectedCategory: string | null;
  onSelectCategory?: (id: string | null) => void;
}

type SortMode = 'popular' | 'newest';

export function BetList({ selectedCategory, onSelectCategory }: BetListProps) {
  const [bets, setBets] = useState<Bet[]>([]);
  const [categories, setCategories] = useState<Record<string, Category>>({});
  const [catList, setCatList] = useState<Category[]>([]);
  const [sort, setSort] = useState<SortMode>('popular');
  const [loading, setLoading] = useState(true);

  const fetchBets = async () => {
    let query = supabase.from('bets').select('*').eq('is_active', true);
    if (selectedCategory) query = query.eq('category_id', selectedCategory);
    const { data } = await query;
    if (data) setBets(data as unknown as Bet[]);
    setLoading(false);
  };

  useEffect(() => {
    supabase.from('categories').select('*').order('sort_order').then(({ data }) => {
      if (data) {
        const map: Record<string, Category> = {};
        (data as Category[]).forEach(c => map[c.id] = c);
        setCategories(map);
        setCatList(data as Category[]);
      }
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchBets();
    const channel = supabase
      .channel('bets-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bets' }, () => fetchBets())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedCategory]);

  const liveBets = bets.filter(b => b.is_live);
  const regularBets = bets.filter(b => !b.is_live);

  const sorted = [...regularBets].sort((a, b) => {
    if (sort === 'popular') return b.bet_count - a.bet_count;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="flex-1 min-w-0">
      {/* Tabs */}
      <div className="flex items-center border-b border-border mb-3">
        <button
          onClick={() => setSort('popular')}
          className={cn('px-4 py-2 text-[13px] font-semibold border-b-2 -mb-[1px] transition-colors',
            sort === 'popular' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          Popularne
        </button>
        <button
          onClick={() => setSort('newest')}
          className={cn('px-4 py-2 text-[13px] font-semibold border-b-2 -mb-[1px] transition-colors',
            sort === 'newest' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          Najnowsze
        </button>
      </div>

      {/* Category pills - mobile only (hidden on lg where sidebar shows) */}
      {onSelectCategory && (
        <div className="lg:hidden flex gap-1.5 mb-3 overflow-x-auto scrollbar-hide pb-1 -mx-3 px-3">
          <button
            onClick={() => onSelectCategory(null)}
            className={cn(
              'shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all',
              !selectedCategory ? 'gradient-primary text-primary-foreground shadow-sm' : 'bg-card text-foreground border border-border hover:border-foreground/30'
            )}
          >
            🌐 Wszystkie
          </button>
          {catList.map(cat => (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={cn(
                'shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all',
                selectedCategory === cat.id ? 'gradient-primary text-primary-foreground shadow-sm' : 'bg-card text-foreground border border-border hover:border-foreground/30'
              )}
            >
              {cat.emoji} {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Loading skeletons */}
      {loading ? (
        <div className="space-y-2">
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
        <>
          {/* Live section */}
          {liveBets.length > 0 && (
            <div className="mb-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {liveBets.map(bet => (
                  <BetCard key={bet.id} bet={bet} category={bet.category_id ? categories[bet.category_id] : undefined} />
                ))}
              </div>
            </div>
          )}

          {/* Regular bets */}
          <div className="space-y-2">
            {sorted.length === 0 && liveBets.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <p className="text-base font-medium">Brak dostępnych zakładów</p>
                <p className="text-[13px] mt-1">Wróć później lub zmień kategorię</p>
              </div>
            ) : (
              sorted.map(bet => (
                <BetCard key={bet.id} bet={bet} category={bet.category_id ? categories[bet.category_id] : undefined} />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
