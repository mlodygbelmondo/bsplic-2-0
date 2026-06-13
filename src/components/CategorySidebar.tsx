import { useMemo, useState } from 'react';
import { Category } from '@/types/database';
import { cn } from '@/lib/utils';
import { Search, X } from 'lucide-react';
import { SectionLoader } from '@/components/SectionLoader';

interface CategorySidebarProps {
  selectedCategory: string | null;
  onSelectCategory: (id: string | null) => void;
  categories: Category[];
  loading: boolean;
}

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export function CategorySidebar({ selectedCategory, onSelectCategory, categories, loading }: CategorySidebarProps) {
  const [search, setSearch] = useState('');

  const filteredCategories = useMemo(() => {
    const query = normalize(search);
    if (!query) return categories;
    return categories.filter((category) => normalize(category.name).includes(query));
  }, [categories, search]);

  return (
    <aside className="w-[250px] hidden lg:block shrink-0 h-full">
      <div className="h-full rounded-2xl bg-card border border-border card-shadow overflow-hidden flex flex-col">
        <div className="p-3 pb-2 border-b border-border/60">
          <h3 className="text-[15px] font-bold text-foreground mb-2">Kategorie</h3>
          <div className="flex items-center gap-2 border border-border rounded-md px-3 py-2 text-[13px] transition-colors focus-within:border-foreground/30 bg-background/60">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Szukaj kategorii..."
              className="bg-transparent outline-none w-full text-[13px] text-foreground placeholder:text-muted-foreground"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Wyczyść wyszukiwanie kategorii"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="px-3 py-2 space-y-1 flex-1 min-h-0 overflow-y-auto">
          <button
            onClick={() => onSelectCategory(null)}
            className={cn(
               'w-full text-left px-2.5 py-2 rounded-lg text-[14px] font-medium transition-colors flex items-center gap-2.5',
              selectedCategory === null ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'
            )}
          >
            <span className="text-sm">⭐</span>
            Wszystkie
          </button>

          {loading && <SectionLoader size="sm" label="Wczytywanie..." />}

          {!loading &&
            filteredCategories.map((category) => (
              <button
                key={category.id}
                onClick={() => onSelectCategory(category.id)}
                className={cn(
                   'w-full text-left px-2.5 py-2 rounded-lg text-[14px] font-medium transition-colors flex items-center gap-2.5',
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
      </div>
    </aside>
  );
}
