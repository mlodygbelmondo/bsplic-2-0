import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Category } from '@/types/database';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';

interface CategorySidebarProps {
  selectedCategory: string | null;
  onSelectCategory: (id: string | null) => void;
}

export function CategorySidebar({ selectedCategory, onSelectCategory }: CategorySidebarProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchCats = async () => {
      const { data } = await supabase.from('categories').select('*').order('sort_order');
      if (data) setCategories(data as Category[]);
    };
    fetchCats();
    const channel = supabase
      .channel('categories-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => fetchCats())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = categories.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <aside className="w-[250px] hidden lg:block shrink-0 bg-card border-r border-border overflow-y-auto max-h-[calc(100vh-2.75rem)] sticky top-[2.75rem]">
      {/* Search */}
      <div className="p-3 pb-2">
        <div className="flex items-center gap-2 border border-border rounded-md px-3 py-2 text-[13px] transition-colors focus-within:border-foreground/30">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Zawodnik, drużyna, turniej..."
            className="bg-transparent outline-none w-full text-[13px] text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Kategorie - single flat list, no sections, no arrows */}
      <div className="px-3 pb-3">
        <h3 className="text-[13px] font-bold text-foreground mb-1">Kategorie</h3>
        <button
          onClick={() => onSelectCategory(null)}
          className={cn(
            'w-full text-left px-2.5 py-2 rounded text-[13px] font-medium transition-colors flex items-center gap-2.5',
            selectedCategory === null
              ? 'bg-primary/10 text-primary'
              : 'hover:bg-muted text-foreground'
          )}
        >
          <span className="text-sm">⭐</span>
          Wszystkie
        </button>
        {filtered.map(cat => (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            className={cn(
              'w-full text-left px-2.5 py-2 rounded text-[13px] font-medium transition-colors flex items-center gap-2.5',
              selectedCategory === cat.id
                ? 'bg-primary/10 text-primary'
                : 'hover:bg-muted text-foreground'
            )}
          >
            <span className="text-sm">{cat.emoji}</span>
            {cat.name}
          </button>
        ))}
      </div>
    </aside>
  );
}
