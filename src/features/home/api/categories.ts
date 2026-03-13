import { supabase } from '@/integrations/supabase/client';
import { Category } from '@/types/database';

export async function fetchCategories() {
  const { data, error } = await supabase.from('categories').select('*').order('sort_order');

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Category[];
}

export function subscribeToCategoryChanges(onChange: () => void) {
  const channel = supabase
    .channel('categories-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, onChange)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
