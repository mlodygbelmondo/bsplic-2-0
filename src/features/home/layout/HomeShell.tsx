import { CategorySidebar } from '@/components/CategorySidebar';
import { BetList } from '@/components/BetList';
import { CouponDrawer } from '@/components/CouponDrawer';
import { HomePromoBanner } from '@/features/home/components/HomePromoBanner';
import { HomeActionsBar } from '@/features/home/components/HomeActionsBar';
import type { Category } from '@/types/database';

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
    <div className="sportsbook-home-bg flex-1 min-h-0 overflow-hidden">
      <div className="app-mobile-content-pad mx-auto flex h-full max-w-[1600px] flex-col gap-3 px-3 py-3">
        <HomePromoBanner />

        <div className="flex-1 min-h-0 flex">
          <CategorySidebar
            selectedCategory={selectedCategory}
            onSelectCategory={onSelectCategory}
            categories={categories}
            loading={categoriesLoading}
          />

          <main className="flex min-h-0 min-w-0 flex-1 flex-col px-1 lg:px-2">
            <HomeActionsBar onProposeClick={onOpenProposeModal} />
            <BetList
              selectedCategory={selectedCategory}
              onSelectCategory={onSelectCategory}
              categories={categories}
              categoryMap={categoryMap}
            />
          </main>

          <CouponDrawer categoryMap={categoryMap} />
        </div>
      </div>
    </div>
  );
}
