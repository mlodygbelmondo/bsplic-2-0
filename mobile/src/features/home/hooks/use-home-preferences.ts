import { create } from 'zustand';

import { kv } from '@/lib/storage';
import type { SortMode } from '../logic/sort-bets';
import { SORT_OPTIONS } from '../logic/sort-options';

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

interface HomePreferencesState {
  category: string | null;
  sort: SortMode;
  activeOnly: boolean;
  /** The sort sheet is presented (the trigger chevron points up). */
  sortSheetOpen: boolean;
}

/**
 * Category, sort and Aktywne, remembered across launches in MMKV. A store
 * rather than screen state because the sort sheet is its own route.
 */
export const useHomePreferences = create<HomePreferencesState>(() => ({
  category: readStoredCategory(),
  sort: readStoredSort(),
  activeOnly: readStoredActiveOnly(),
  sortSheetOpen: false,
}));

export const homePreferencesActions = {
  selectCategory(id: string | null) {
    useHomePreferences.setState({ category: id });
    if (id) {
      kv.set(CATEGORY_STORAGE_KEY, id);
    } else {
      kv.remove(CATEGORY_STORAGE_KEY);
    }
  },
  setSort(value: SortMode) {
    useHomePreferences.setState({ sort: value });
    kv.set(SORT_STORAGE_KEY, value);
  },
  toggleActiveOnly() {
    const next = !useHomePreferences.getState().activeOnly;
    useHomePreferences.setState({ activeOnly: next });
    kv.set(ACTIVE_ONLY_STORAGE_KEY, String(next));
  },
  setSortSheetOpen(open: boolean) {
    useHomePreferences.setState({ sortSheetOpen: open });
  },
};
