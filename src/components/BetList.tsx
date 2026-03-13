import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Bet, Category } from '@/types/database';
import { BetCard } from './BetCard';
import { cn } from '@/lib/utils';

interface BetListProps {
  selectedCategory: string | null;
}

type SortMode = 'popular' | 'newest';

export function BetList({ selectedCategory }: BetListProps) {
  const [bets, setBets] = useState<Bet[]>([]);
  const [categories, setCategories] = useState<Record<string, Category>>({});
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
    supabase.from('categories').select('*').then(({ data }) => {
      if (data) {
        const map: Record<string, Category> = {};
        (data as Category[]).forEach(c => map[c.id] = c);
        setCategories(map);
      }
    });
  }, []);

  useEffect(() => {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0">
      {/* Tabs */}
      <div className="flex items-center border-b border-border mb-3">
        <button
          onClick={() => setSort('popular')}
          className={cn('px-4 py-2 text-[13px] font-semibold border-b-2 -mb-[1px] transition-colors',
            sort === 'popular' ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          Popularne
        </button>
        <button
          onClick={() => setSort('newest')}
          className={cn('px-4 py-2 text-[13px] font-semibold border-b-2 -mb-[1px] transition-colors',
            sort === 'newest' ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          Live
        </button>
      </div>

      {/* Category chips */}
      <div className="flex gap-1.5 mb-3 overflow-x-auto scrollbar-hide pb-1">
        {Object.values(categories).map((cat, i) => (
          <button
            key={cat.id}
            onClick={() => onCatChipClick(cat.id)}
            className={cn(
              'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-colors',
              i === 0
                ? 'bg-foreground text-card border-foreground'
                : 'bg-card text-foreground border-border hover:border-foreground/30'
            )}
          >
            <span className="text-sm">{cat.emoji}</span> {cat.name}
          </button>
        ))}
      </div>

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
    </div>
  );
}

function onCatChipClick(_id: string) {
  // handled by parent, chips are visual only for now
}
