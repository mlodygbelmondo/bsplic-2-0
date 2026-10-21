import { create } from 'zustand';

/**
 * True while the mandatory poll dialog is up. The bonus dialog waits for it,
 * which matches the web stacking (the poll dialog renders above the bonus one).
 */
export const useFeaturePollStore = create<{ open: boolean }>(() => ({ open: false }));

export const useFeaturePollOpen = () => useFeaturePollStore((s) => s.open);

export const setFeaturePollOpen = (open: boolean) => {
  if (useFeaturePollStore.getState().open !== open) useFeaturePollStore.setState({ open });
};
