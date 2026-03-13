import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Category } from '@/types/database';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface CategorySidebarProps {
  selectedCategory: string | null;
  onSelectCategory: (id: string | null) => void;
}

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export function CategorySidebar({ selectedCategory, onSelectCategory }: CategorySidebarProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCats = async () => {
      const { data } = await supabase.from('categories').select('*').order('sort_order');
      if (data) setCategories(data as Category[]);
      setLoading(false);
    };

    fetchCats();

    const channel = supabase
      .channel('categories-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => fetchCats())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredCategories = useMemo(() => {
    const query = normalize(search);
    if (!query) return categories;
    return categories.filter((category) => normalize(category.name).includes(query));
  }, [categories, search]);

  return (
    <aside className="w-[250px] hidden lg:block shrink-0 bg-card border-r border-border overflow-y-auto max-h-[calc(100vh-2.75rem)] sticky top-[2.75rem]">
      <div className="p-3 pb-2 border-b border-border/60">
        <h3 className="text-[13px] font-bold text-foreground mb-2">Kategorie</h3>
        <div className="flex items-center gap-2 border border-border rounded-md px-3 py-2 text-[13px] transition-colors focus-within:border-foreground/30 bg-background/60">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Szukaj kategorii..."
            className="bg-transparent outline-none w-full text-[13px] text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="px-3 py-2 space-y-1">
        <button
          onClick={() => onSelectCategory(null)}
          className={cn(
            'w-full text-left px-2.5 py-2 rounded text-[13px] font-medium transition-colors flex items-center gap-2.5',
            selectedCategory === null ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'
          )}
        >
          <span className="text-sm">⭐</span>
          Wszystkie
        </button>

        {loading &&
          [...Array(5)].map((_, index) => <Skeleton key={index} className="h-9 w-full rounded-md" />)}

        {!loading &&
          filteredCategories.map((category) => (
            <button
              key={category.id}
              onClick={() => onSelectCategory(category.id)}
              className={cn(
                'w-full text-left px-2.5 py-2 rounded text-[13px] font-medium transition-colors flex items-center gap-2.5',
                selectedCategory === category.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'
              )}
            >
              <span className="text-sm">{category.emoji}</span>
              {category.name}
            </button>
          ))}

        {!loading && filteredCategories.length === 0 && (
          <p className="text-xs text-muted-foreground px-2 py-4 text-center">Brak kategorii dla tej frazy</p>
        )}
      </div>
    </aside>
  );
}
