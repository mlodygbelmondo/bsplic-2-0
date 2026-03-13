import { useState } from 'react';
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
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex max-w-7xl mx-auto">
        <CategorySidebar selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} />
        <main className="flex-1 min-w-0 p-4">
          {user && (
            <div className="mb-4">
              <Button onClick={() => setProposeOpen(true)} variant="outline" className="font-medium">
                <Lightbulb className="h-4 w-4 mr-2" /> Zaproponuj zakład
              </Button>
            </div>
          )}
          <BetList selectedCategory={selectedCategory} />
        </main>
        <CouponDrawer />
      </div>
      <ProposeBetModal open={proposeOpen} onOpenChange={setProposeOpen} />
    </div>
  );
};

export default Index;
