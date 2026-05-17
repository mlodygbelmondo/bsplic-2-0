import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { Category } from '@/types/database';

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
    <aside className="hidden h-full w-[252px] shrink-0 p-2 pr-1 lg:block">
      <div className="sportsbook-panel flex h-full flex-col overflow-hidden rounded-lg border border-white/10">
        <div className="border-b border-white/10 p-3 pb-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-[14px] font-black text-foreground">Kategorie</h3>
            <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-black text-primary">
              SPORT
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-white/10 bg-black/[0.24] px-3 py-2 text-[13px] transition-colors focus-within:border-primary/70">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Szukaj kategorii"
              className="bg-transparent outline-none w-full text-[13px] text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-2">
          <button
            onClick={() => onSelectCategory(null)}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[14px] font-bold transition-colors',
              selectedCategory === null
                ? 'bg-primary text-primary-foreground shadow-[0_10px_24px_rgba(220,0,32,0.24)]'
                : 'text-foreground hover:bg-white/[0.06]'
            )}
          >
            <span className="text-sm">⭐</span>
            Wszystkie
          </button>

          {loading &&
            [...Array(5)].map((_, index) => (
              <Skeleton key={index} className="h-9 w-full rounded-md bg-white/[0.08]" />
            ))}

          {!loading &&
            filteredCategories.map((category) => (
              <button
                key={category.id}
                onClick={() => onSelectCategory(category.id)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[14px] font-bold transition-colors',
                  selectedCategory === category.id
                    ? 'bg-primary text-primary-foreground shadow-[0_10px_24px_rgba(220,0,32,0.24)]'
                    : 'text-foreground hover:bg-white/[0.06]'
                )}
              >
                <span className="text-sm">{category.emoji}</span>
                {category.name}
              </button>
            ))}

          {!loading && filteredCategories.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">Brak kategorii dla tej frazy</p>
          )}
        </div>
      </div>
    </aside>
  );
}
