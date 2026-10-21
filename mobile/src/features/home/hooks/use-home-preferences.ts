import { useState } from 'react';

import { kv } from '@/lib/storage';
import { SORT_OPTIONS, type SortMode } from '../logic/sort-bets';

/** Same keys and defaults as the web (`AuthenticatedHome`, `BetList`). */
const CATEGORY_STORAGE_KEY = 'bsplic.home.category';
const SORT_STORAGE_KEY = 'bsplic.home.sort';
const ACTIVE_ONLY_STORAGE_KEY = 'bsplic.home.activeOnly';

function readStoredCategory(): string | null {
  return kv.getString(CATEGORY_STORAGE_KEY) ?? null;
}

function readStoredSort(): SortMode {
  const raw = kv.getString(SORT_STORAGE_KEY);
  return SORT_OPTIONS.find((option) => option.value === raw)?.value ?? 'newest';
}

/** Only the literal string `"false"` turns Aktywne off. */
function readStoredActiveOnly(): boolean {
  return kv.getString(ACTIVE_ONLY_STORAGE_KEY) !== 'false';
}

export function forgetStoredCategory() {
  kv.remove(CATEGORY_STORAGE_KEY);
}

/** Category, sort and Aktywne, remembered across launches in MMKV. */
export function useHomePreferences() {
  const [storedCategory, setStoredCategory] = useState(readStoredCategory);
  const [sort, setSortState] = useState(readStoredSort);
  const [activeOnly, setActiveOnlyState] = useState(readStoredActiveOnly);

  const selectCategory = (id: string | null) => {
    setStoredCategory(id);
    if (id) {
      kv.set(CATEGORY_STORAGE_KEY, id);
    } else {
      kv.remove(CATEGORY_STORAGE_KEY);
    }
  };

  const setSort = (value: SortMode) => {
    setSortState(value);
    kv.set(SORT_STORAGE_KEY, value);
  };

  const toggleActiveOnly = () => {
    const next = !activeOnly;
    setActiveOnlyState(next);
    kv.set(ACTIVE_ONLY_STORAGE_KEY, String(next));
  };

  return { storedCategory, selectCategory, sort, setSort, activeOnly, toggleActiveOnly };
}
