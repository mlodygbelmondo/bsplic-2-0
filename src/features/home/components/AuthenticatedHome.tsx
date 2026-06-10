import { useEffect, useState } from "react";

import { Navbar } from "@/components/Navbar";
import { ProposeBetModal } from "@/components/ProposeBetModal";
import { useCategories } from "@/features/home/hooks/useCategories";
import { HomeShell } from "@/features/home/layout/HomeShell";

const CATEGORY_STORAGE_KEY = "bsplic.home.category";

function readStoredCategory(): string | null {
  try {
    return window.localStorage.getItem(CATEGORY_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredCategory(id: string | null) {
  try {
    if (id) {
      window.localStorage.setItem(CATEGORY_STORAGE_KEY, id);
    } else {
      window.localStorage.removeItem(CATEGORY_STORAGE_KEY);
    }
  } catch {
    // Storage unavailable — category just won't be remembered.
  }
}

export default function AuthenticatedHome() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    readStoredCategory,
  );
  const [proposeOpen, setProposeOpen] = useState(false);
  const {
    categories,
    categoryMap,
    loading: categoriesLoading,
  } = useCategories();

  const handleSelectCategory = (id: string | null) => {
    setSelectedCategory(id);
    writeStoredCategory(id);
  };

  useEffect(() => {
    if (categoriesLoading || !selectedCategory) return;
    if (!categoryMap[selectedCategory]) {
      setSelectedCategory(null);
      writeStoredCategory(null);
    }
  }, [categoriesLoading, categoryMap, selectedCategory]);

  return (
    <div className="h-safe-screen bg-background overflow-hidden flex flex-col">
      <Navbar />

      <HomeShell
        selectedCategory={selectedCategory}
        onSelectCategory={handleSelectCategory}
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
