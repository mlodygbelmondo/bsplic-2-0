import { queryOptions, useQuery } from '@tanstack/react-query';

import { PAGE_DATA_QUERY_OPTIONS } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';
import type { Category } from '@/types/database';

/** Shared by the sportsbook, the coupon sheet and the propose-bet sheet. */
export const CATEGORIES_QUERY_KEY = ['home', 'categories'] as const;

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select('*').order('sort_order');
  if (error) throw new Error(error.message);
  return (data ?? []) as Category[];
}

export const categoriesQueryOptions = () =>
  queryOptions({
    queryKey: CATEGORIES_QUERY_KEY,
    queryFn: fetchCategories,
    ...PAGE_DATA_QUERY_OPTIONS,
  });

export function toCategoryMap(categories: Category[]): Record<string, Category> {
  const map: Record<string, Category> = {};
  categories.forEach((category) => {
    map[category.id] = category;
  });
  return map;
}

export function useCategoryMap(): Record<string, Category> {
  const { data } = useQuery({ ...categoriesQueryOptions(), select: toCategoryMap });
  return data ?? {};
}
