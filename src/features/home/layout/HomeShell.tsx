import { CategorySidebar } from '@/components/CategorySidebar';
import { BetList } from '@/components/BetList';
import { CouponDrawer } from '@/components/CouponDrawer';
import { DailyJackpotCard } from '@/features/jackpot/components/DailyJackpotCard';
import { useDailyJackpot } from '@/features/jackpot/hooks/useDailyJackpot';
import { Category } from '@/types/database';

interface HomeShellProps {
  selectedCategory: string | null;
  onSelectCategory: (id: string | null) => void;
  onOpenProposeModal: () => void;
  categories: Category[];
  categoryMap: Record<string, Category>;
  categoriesLoading: boolean;
  onMobileChromeHiddenChange?: (hidden: boolean) => void;
}

export function HomeShell({
  selectedCategory,
  onSelectCategory,
  onOpenProposeModal,
  categories,
  categoryMap,
  categoriesLoading,
  onMobileChromeHiddenChange,
}: HomeShellProps) {
  const jackpot = useDailyJackpot();

  return (
    <div className="flex-1 min-h-0 overflow-hidden">
      <div className="h-full max-w-[1600px] mx-auto px-3 pb-0 pt-0 lg:py-3 flex flex-col gap-3">
        {/* All three columns start at the same y; the bet list's scroll
            edge lines up with the sidebar/coupon card tops. */}
        <div className="flex-1 min-h-0 flex lg:gap-3">
          <CategorySidebar
            selectedCategory={selectedCategory}
            onSelectCategory={onSelectCategory}
            categories={categories}
            loading={categoriesLoading}
          />

          <main className="flex-1 min-w-0 min-h-0 flex flex-col">
            <BetList
              selectedCategory={selectedCategory}
              onSelectCategory={onSelectCategory}
              categories={categories}
              categoryMap={categoryMap}
              onProposeClick={onOpenProposeModal}
              onScrollChromeHiddenChange={onMobileChromeHiddenChange}
              topBanner={
                <DailyJackpotCard
                  snapshot={jackpot.snapshot}
                  loading={jackpot.loading}
                  buying={jackpot.buying}
                  balance={jackpot.balance}
                  onBuy={jackpot.buyTicket}
                />
              }
            />
          </main>

          <CouponDrawer categoryMap={categoryMap} />
        </div>
      </div>
    </div>
  );
}
