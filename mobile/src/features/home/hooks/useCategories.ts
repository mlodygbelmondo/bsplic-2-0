import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Category } from "@/types/database";
import {
  fetchCategories,
  subscribeToCategoryChanges,
} from "@/features/home/api/categories";

const CATEGORIES_QUERY_KEY = ["home", "categories"] as const;

export function useCategories(active = true) {
  const queryClient = useQueryClient();
  const { data: categories = [], isLoading: loading } = useQuery({
    queryKey: CATEGORIES_QUERY_KEY,
    queryFn: fetchCategories,
    enabled: active,
  });

  useEffect(() => {
    if (!active) return;
    const unsubscribe = subscribeToCategoryChanges(() => {
      void queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
    });

    return unsubscribe;
  }, [active, queryClient]);

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
