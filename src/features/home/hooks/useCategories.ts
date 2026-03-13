import { useEffect, useMemo, useState } from 'react';
import { Category } from '@/types/database';
import { fetchCategories, subscribeToCategoryChanges } from '@/features/home/api/categories';

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const data = await fetchCategories();
        if (mounted) {
          setCategories(data);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();

    const unsubscribe = subscribeToCategoryChanges(() => {
      void load();
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const categoryMap = useMemo(() => {
    const map: Record<string, Category> = {};
    categories.forEach((category) => {
      map[category.id] = category;
    });
    return map;
  }, [categories]);

  return {
    categories,
    categoryMap,
    loading,
  };
}
