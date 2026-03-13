import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bet } from '@/types/database';
import { fetchActiveBets, subscribeToBetsChanges } from '@/features/home/api/bets';

export type SortMode = 'popular' | 'newest';

export function useBets(selectedCategory: string | null, sort: SortMode) {
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchActiveBets(selectedCategory);
        if (mounted) {
          setBets(data);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();

    const unsubscribe = subscribeToBetsChanges(() => {
      void load();
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [selectedCategory]);

  const sortByMode = useCallback(
    (a: Bet, b: Bet) => {
      if (sort === 'popular') {
        const popularityDiff = Number(b.bet_count) - Number(a.bet_count);
        if (popularityDiff !== 0) {
          return popularityDiff;
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    },
    [sort]
  );

  const liveBets = useMemo(() => {
    return bets.filter((bet) => bet.is_live).sort(sortByMode);
  }, [bets, sortByMode]);

  const regularBets = useMemo(() => {
    return bets.filter((bet) => !bet.is_live);
  }, [bets]);

  const sortedBets = useMemo(() => {
    return [...regularBets].sort(sortByMode);
  }, [regularBets, sortByMode]);

  return {
    loading,
    liveBets,
    sortedBets,
  };
}
