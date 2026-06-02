import { useState } from "react";

import { Navbar } from "@/components/Navbar";
import { ProposeBetModal } from "@/components/ProposeBetModal";
import { useCategories } from "@/features/home/hooks/useCategories";
import { HomeShell } from "@/features/home/layout/HomeShell";

export default function AuthenticatedHome() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [proposeOpen, setProposeOpen] = useState(false);
  const {
    categories,
    categoryMap,
    loading: categoriesLoading,
  } = useCategories();

  return (
    <div className="h-safe-screen bg-background overflow-hidden flex flex-col">
      <Navbar />

      <HomeShell
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        onOpenProposeModal={() => setProposeOpen(true)}
        categories={categories}
        categoryMap={categoryMap}
        categoriesLoading={categoriesLoading}
      />

      <ProposeBetModal
        open={proposeOpen}
        onOpenChange={setProposeOpen}
        categories={categories}
      />
    </div>
  );
}
