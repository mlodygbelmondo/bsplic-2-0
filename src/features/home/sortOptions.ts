import type { SortMode } from '@/features/home/hooks/sortBets';

export const SORT_OPTIONS: { value: SortMode; label: string; hint: string }[] = [
  { value: 'newest', label: 'Najnowsze', hint: 'Świeżo dodane zakłady na górze' },
  { value: 'popular', label: 'Popularne', hint: 'Najczęściej obstawiane' },
  { value: 'ending_soon', label: 'Kończące się', hint: 'Najbliżej końca obstawiania' },
];
