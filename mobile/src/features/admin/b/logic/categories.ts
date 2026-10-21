export const CATEGORY_PAGE_SIZE = 10;

export interface CategoryForm {
  name: string;
  emoji: string;
  color: string;
  sort_order: number;
}

export const createNewCategoryForm = (sortOrder = 0): CategoryForm => ({
  name: '',
  emoji: '⚽',
  color: '#dc2626',
  sort_order: sortOrder,
});

/** Web `getCategoryPaginationRange`: first, last, current ±1 and ellipses. */
export function getCategoryPaginationRange(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);

  const result: (number | 'ellipsis')[] = [0];
  if (current > 2) result.push('ellipsis');

  const rangeStart = Math.max(1, current - 1);
  const rangeEnd = Math.min(total - 2, current + 1);
  for (let i = rangeStart; i <= rangeEnd; i++) result.push(i);

  if (current < total - 3) result.push('ellipsis');
  result.push(total - 1);
  return result;
}

/** `<input type="number">` semantics: blank or invalid input becomes 0. */
export const parseSortOrder = (value: string): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Normalizes `#RGB`/`#RRGGBB` (any case) to `#rrggbb`; null when invalid. */
export const normalizeHexColor = (value: string): string | null => {
  const trimmed = value.trim().toLowerCase();
  const short = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(trimmed);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  const full = /^#?([0-9a-f]{6})(?:[0-9a-f]{2})?$/.exec(trimmed);
  return full ? `#${full[1]}` : null;
};
