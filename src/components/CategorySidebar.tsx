import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Category } from '@/types/database';
import { cn } from '@/lib/utils';
import { Search, ChevronDown } from 'lucide-react';

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
    <aside className="w-[260px] hidden lg:block shrink-0 border-r border-border bg-card">
      <div className="sticky top-12 overflow-y-auto max-h-[calc(100vh-3rem)]">
        {/* Search */}
        <div className="p-3">
          <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground">
            <Search className="h-4 w-4 shrink-0" />
            <span>Zawodnik, drużyna, turniej...</span>
          </div>
        </div>

        {/* Popularne */}
        <div className="px-3 pb-2">
          <h3 className="text-sm font-bold mb-2">Popularne</h3>
          <button
            onClick={() => onSelectCategory(null)}
            className={cn(
              'w-full text-left px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors flex items-center gap-3',
              selectedCategory === null
                ? 'bg-primary/10 text-primary font-semibold'
                : 'hover:bg-muted text-foreground'
            )}
          >
            <span className="text-base">🏠</span>
            Wszystkie
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={cn(
                'w-full text-left px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors flex items-center gap-3',
                selectedCategory === cat.id
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'hover:bg-muted text-foreground'
              )}
            >
              <span className="text-base">{cat.emoji}</span>
              {cat.name}
            </button>
          ))}
        </div>

        {/* Sport section */}
        <div className="border-t border-border px-3 pt-3">
          <h3 className="text-sm font-bold mb-2">Sport</h3>
          {categories.map(cat => (
            <button
              key={`sport-${cat.id}`}
              onClick={() => onSelectCategory(cat.id)}
              className="w-full text-left px-3 py-2.5 text-[13px] font-medium hover:bg-muted rounded-lg flex items-center justify-between text-foreground"
            >
              <div className="flex items-center gap-3">
                <span className="text-base">{cat.emoji}</span>
                {cat.name}
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
