import { CategorySidebar } from '@/components/CategorySidebar';
import { BetList } from '@/components/BetList';
import { CouponDrawer } from '@/components/CouponDrawer';
import { Category } from '@/types/database';

interface HomeShellProps {
  selectedCategory: string | null;
  onSelectCategory: (id: string | null) => void;
  onOpenProposeModal: () => void;
  categories: Category[];
  categoryMap: Record<string, Category>;
  categoriesLoading: boolean;
}

export function HomeShell({
  selectedCategory,
  onSelectCategory,
  onOpenProposeModal,
  categories,
  categoryMap,
  categoriesLoading,
}: HomeShellProps) {
  return (
    <div className="flex-1 min-h-0 overflow-hidden">
      <div className="h-full max-w-[1600px] mx-auto px-3 py-3 flex flex-col gap-3">
        <div className="flex-1 min-h-0 flex">
          <CategorySidebar
            selectedCategory={selectedCategory}
            onSelectCategory={onSelectCategory}
            categories={categories}
            loading={categoriesLoading}
          />

          <main className="flex-1 min-w-0 px-1 lg:px-2 min-h-0 flex flex-col">
            <BetList
              selectedCategory={selectedCategory}
              onSelectCategory={onSelectCategory}
              categories={categories}
              categoryMap={categoryMap}
              onProposeClick={onOpenProposeModal}
            />
          </main>

          <CouponDrawer categoryMap={categoryMap} />
        </div>
      </div>
    </div>
  );
}
