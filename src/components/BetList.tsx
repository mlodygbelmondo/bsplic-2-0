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
    if (data) setBets(data as Bet[]);
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
      {/* Live section */}
      {liveBets.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-primary pulse-live" />
            Na żywo
          </h2>
          <div className="grid gap-3">
            {liveBets.map(bet => (
              <BetCard key={bet.id} bet={bet} category={bet.category_id ? categories[bet.category_id] : undefined} />
            ))}
          </div>
        </div>
      )}

      {/* Sort tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setSort('popular')}
          className={cn('px-4 py-2 rounded-full text-sm font-medium transition-colors',
            sort === 'popular' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
          )}
        >
          🔥 Najpopularniejsze
        </button>
        <button
          onClick={() => setSort('newest')}
          className={cn('px-4 py-2 rounded-full text-sm font-medium transition-colors',
            sort === 'newest' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
          )}
        >
          🆕 Najnowsze
        </button>
      </div>

      {/* Bet grid */}
      <div className="grid gap-3">
        {sorted.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg">Brak dostępnych zakładów</p>
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
