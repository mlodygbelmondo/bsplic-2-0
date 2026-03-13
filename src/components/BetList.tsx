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
    const fetchCats = async () => {
      const { data } = await supabase.from('categories').select('*');
      if (data) {
        const map: Record<string, Category> = {};
        (data as Category[]).forEach(c => map[c.id] = c);
        setCategories(map);
      }
    };
    fetchCats();
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
      {/* Tabs: Popularne / Live */}
      <div className="flex items-center gap-1 mb-4 border-b border-border">
        <button
          onClick={() => setSort('popular')}
          className={cn('px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors',
            sort === 'popular' ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          Popularne
        </button>
        <button
          onClick={() => setSort('newest')}
          className={cn('px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors',
            sort === 'newest' ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          Najnowsze
        </button>
        {liveBets.length > 0 && (
          <div className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-primary">
            <span className="h-2 w-2 rounded-full bg-primary pulse-live" />
            Live ({liveBets.length})
          </div>
        )}
      </div>

      {/* Category filter chips */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
        {Object.values(categories).slice(0, 5).map(cat => (
          <button
            key={cat.id}
            onClick={() => {}}
            className="shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-muted hover:bg-muted/80 transition-colors"
          >
            <span>{cat.emoji}</span> {cat.name}
          </button>
        ))}
      </div>

      {/* Live section */}
      {liveBets.length > 0 && (
        <div className="mb-5">
          <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-primary pulse-live" />
            Na żywo
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {liveBets.map(bet => (
              <BetCard key={bet.id} bet={bet} category={bet.category_id ? categories[bet.category_id] : undefined} />
            ))}
          </div>
        </div>
      )}

      {/* Regular bets */}
      <div className="grid gap-3">
        {sorted.length === 0 && liveBets.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg font-medium">Brak dostępnych zakładów</p>
            <p className="text-sm mt-1">Wróć później lub zmień kategorię</p>
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
