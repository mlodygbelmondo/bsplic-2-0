import { supabase } from '@/lib/supabase';
import type { CategoryForm } from '../logic/categories';

/** Category list comes from the shared `categoriesQueryOptions` (home). */
export { CATEGORIES_QUERY_KEY, categoriesQueryOptions } from '@/features/home/api/categories';

export async function insertCategory(form: CategoryForm): Promise<void> {
  const { error } = await supabase.from('categories').insert(form);
  if (error) throw error;
}

export async function updateCategory(id: string, form: CategoryForm): Promise<void> {
  const { error } = await supabase
    .from('categories')
    .update({
      name: form.name.trim(),
      emoji: form.emoji,
      color: form.color,
      sort_order: form.sort_order,
    })
    .eq('id', id);
  if (error) throw error;
}

/** Web check before deleting: a category with active bets cannot be removed. */
export async function countActiveBetsInCategory(id: string): Promise<number> {
  const { count } = await supabase
    .from('bets')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', id)
    .eq('is_active', true);
  return count ?? 0;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw error;
}
