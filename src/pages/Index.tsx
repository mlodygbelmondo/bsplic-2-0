import { useState } from 'react';
import { LoginPage } from '@/components/LoginPage';
import { Navbar } from '@/components/Navbar';
import { ProposeBetModal } from '@/components/ProposeBetModal';
import { HomeShell } from '@/features/home/layout/HomeShell';
import { useCategories } from '@/features/home/hooks/useCategories';
import { useAuth } from '@/contexts/AuthContext';

const Index = () => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [proposeOpen, setProposeOpen] = useState(false);
  const { user, loading } = useAuth();
  const { categories, categoryMap, loading: categoriesLoading } = useCategories();

  if (loading) {
    return (
      <div className="min-safe-screen gradient-primary flex items-center justify-center">
        <div className="h-10 w-10 border-4 border-primary-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-safe-screen bg-background overflow-hidden flex flex-col">
      <Navbar />

      <HomeShell
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        onOpenProposeModal={() => setProposeOpen(true)}
        categories={categories}
        categoryMap={categoryMap}
        categoriesLoading={categoriesLoading}
      />

      <ProposeBetModal open={proposeOpen} onOpenChange={setProposeOpen} categories={categories} />
    </div>
  );
};

export default Index;
