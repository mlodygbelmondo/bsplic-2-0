import { buildCategoryTree } from '@/features/home/logic/category-tree';
import type { Category } from '@/types/database';
import { NO_CATEGORY_VALUE } from '../../constants';

export const CATEGORY_PAGE_SIZE = 10;

export interface CategoryForm {
  name: string;
  emoji: string;
  color: string;
  sort_order: number;
  parent_id: string | null;
}

export const createNewCategoryForm = (sortOrder = 0): CategoryForm => ({
  name: '',
  emoji: '⚽',
  color: '#dc2626',
  sort_order: sortOrder,
  parent_id: null,
});

export const toCategoryForm = (category: Category): CategoryForm => ({
  name: category.name,
  emoji: category.emoji,
  color: category.color,
  sort_order: category.sort_order,
  parent_id: category.parent_id ?? null,
});

export interface ParentCategoryChoices {
  /** Sports the category can be filed under. */
  options: Category[];
  /** The category has leagues, so it cannot get a parent of its own. */
  locked: boolean;
}

/**
 * Parent picker choices (web `CategoriesTab`): only top-level categories can
 * be parents (two levels max). A new category (`editing` null) may pick any
 * sport; an edited one may not pick itself, and one with leagues gets none.
 */
export function getParentCategoryChoices(
  categories: readonly Category[],
  editing: Category | null,
): ParentCategoryChoices {
  const tree = buildCategoryTree(categories);
  const topLevel = tree.map((node) => node.category);
  if (!editing) return { options: topLevel, locked: false };
  const locked = tree.some((node) => node.category.id === editing.id && node.children.length > 0);
  return { options: locked ? [] : topLevel.filter((category) => category.id !== editing.id), locked };
}

/** Select entries for the parent picker: "Brak" (top level) then the sports. */
export function getParentSelectOptions(options: readonly Category[]): { value: string; label: string }[] {
  return [
    { value: NO_CATEGORY_VALUE, label: 'Brak' },
    ...options.map((category) => ({ value: category.id, label: `${category.emoji} ${category.name}` })),
  ];
}

export const parentIdToSelectValue = (parentId: string | null): string => parentId ?? NO_CATEGORY_VALUE;

export const selectValueToParentId = (value: string): string | null =>
  value === NO_CATEGORY_VALUE ? null : value;

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
