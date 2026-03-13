import { useState } from 'react';
import { LoginPage } from '@/components/LoginPage';
import { Navbar } from '@/components/Navbar';
import { CategorySidebar } from '@/components/CategorySidebar';
import { BetList } from '@/components/BetList';
import { CouponDrawer } from '@/components/CouponDrawer';
import { ProposeBetModal } from '@/components/ProposeBetModal';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Lightbulb } from 'lucide-react';

const Index = () => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [proposeOpen, setProposeOpen] = useState(false);
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen gradient-primary flex items-center justify-center">
        <div className="h-10 w-10 border-4 border-primary-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Promo banner */}
      <div className="max-w-[1600px] mx-auto px-3 pt-3">
        <div className="gradient-banner rounded-xl p-4 flex items-center justify-between overflow-hidden relative card-shadow">
          <div className="relative z-10">
            <p className="text-primary-foreground/80 text-[11px] font-medium uppercase tracking-wider">Promocja</p>
            <h2 className="text-primary-foreground text-xl font-black">Multiboost 400%</h2>
            <p className="text-primary-foreground/70 text-[12px] mt-0.5">Wygrywaj jeszcze więcej — z Multiboost i bez podatku</p>
          </div>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20">
            <div className="text-[80px]">🏆</div>
          </div>
        </div>
      </div>

      <div className="flex max-w-[1600px] mx-auto">
        <CategorySidebar selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} />

        <main className="flex-1 min-w-0 px-3 py-3">
          <div className="flex items-center justify-end mb-2">
            <Button onClick={() => setProposeOpen(true)} size="sm" className="text-[11px] font-bold h-8 gradient-cta text-primary-foreground shadow-md hover:brightness-110 transition">
              <Lightbulb className="h-3 w-3 mr-1" /> Zaproponuj zakład
            </Button>
          </div>
          <BetList selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} />
        </main>

        <CouponDrawer />
      </div>

      <ProposeBetModal open={proposeOpen} onOpenChange={setProposeOpen} />
    </div>
  );
};

export default Index;
