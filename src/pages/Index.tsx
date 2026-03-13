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
      <div className="min-h-screen bg-primary flex items-center justify-center">
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
      <div className="flex">
        <CategorySidebar selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} />
        <main className="flex-1 min-w-0 p-4">
          <div className="flex items-center justify-between mb-2">
            <div />
            <Button onClick={() => setProposeOpen(true)} variant="outline" size="sm" className="text-xs font-semibold">
              <Lightbulb className="h-3.5 w-3.5 mr-1.5" /> Zaproponuj zakład
            </Button>
          </div>
          <BetList selectedCategory={selectedCategory} />
        </main>
        <CouponDrawer />
      </div>
      <ProposeBetModal open={proposeOpen} onOpenChange={setProposeOpen} />
    </div>
  );
};

export default Index;
