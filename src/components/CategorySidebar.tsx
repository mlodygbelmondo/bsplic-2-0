import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Category } from '@/types/database';
import { cn } from '@/lib/utils';

interface CategorySidebarProps {
  selectedCategory: string | null;
  onSelectCategory: (id: string | null) => void;
}

export function CategorySidebar({ selectedCategory, onSelectCategory }: CategorySidebarProps) {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('categories').select('*').order('sort_order');
      if (data) setCategories(data as Category[]);
    };
    fetch();

    const channel = supabase
      .channel('categories-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => fetch())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <aside className="w-64 hidden lg:block shrink-0">
      <div className="sticky top-[3.5rem] p-4 space-y-1">
        <h3 className="text-sm font-bold text-muted-foreground mb-3 uppercase tracking-wider">Kategorie</h3>
        <button
          onClick={() => onSelectCategory(null)}
          className={cn(
            'w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors',
            selectedCategory === null ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
          )}
        >
          🏠 Wszystkie
        </button>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            className={cn(
              'w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              selectedCategory === cat.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
            )}
          >
            {cat.emoji} {cat.name}
          </button>
        ))}
      </div>
    </aside>
  );
}
