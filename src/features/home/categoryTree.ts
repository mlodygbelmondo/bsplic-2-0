import type { Category } from '@/types/database';

// Sportsbook categories form a two-level tree: a sport (top level) and its
// leagues (children). Bets point at a single category; picking a sport shows
// the bets of the sport itself and of all its leagues.

export interface CategoryTreeNode {
  category: Category;
  children: Category[];
}

/** One row of the home category pickers (sidebar and mobile panel). */
export interface CategoryPickerRow {
  category: Category;
  depth: 0 | 1;
  hasChildren: boolean;
  expanded: boolean;
}

/** One entry of a flat category select: parents followed by their children. */
export interface CategoryOption {
  category: Category;
  parent: Category | null;
}

const compareCategories = (a: Category, b: Category) =>
  a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'pl');

/**
 * Groups categories into sports and their leagues, both sorted by
 * `sort_order` then name. A category whose parent is missing is top level.
 */
export function buildCategoryTree(categories: readonly Category[]): CategoryTreeNode[] {
  const byId = new Map(categories.map((category) => [category.id, category]));

  const getParent = (category: Category) =>
    category.parent_id && category.parent_id !== category.id ? byId.get(category.parent_id) : undefined;
  // Only two levels are shown: a category nested under a child (or caught in
  // a cycle) is promoted to the top level instead of disappearing.
  const isTopLevel = (category: Category) => {
    const parent = getParent(category);
    return !parent || getParent(parent) !== undefined;
  };

  const roots = categories.filter(isTopLevel).sort(compareCategories);
  const childrenByParent = new Map<string, Category[]>();
  for (const category of categories) {
    if (isTopLevel(category)) continue;
    const siblings = childrenByParent.get(category.parent_id as string) ?? [];
    siblings.push(category);
    childrenByParent.set(category.parent_id as string, siblings);
  }

  return roots.map((category) => ({
    category,
    children: (childrenByParent.get(category.id) ?? []).sort(compareCategories),
  }));
}

/**
 * Category ids whose bets match the selection: `null` for "all", the sport
 * plus all its leagues for a sport, just the category itself otherwise.
 */
export function getCategoryFilterIds(
  categories: readonly Category[],
  selectedId: string | null,
): string[] | null {
  if (!selectedId) return null;
  const node = buildCategoryTree(categories).find((entry) => entry.category.id === selectedId);
  return [selectedId, ...(node?.children.map((child) => child.id) ?? [])];
}

/**
 * Rows to render in the pickers. A sport's leagues are listed only while the
 * sport or one of its leagues is selected.
 */
export function getVisibleCategoryRows(
  categories: readonly Category[],
  selectedId: string | null,
): CategoryPickerRow[] {
  const rows: CategoryPickerRow[] = [];

  for (const { category, children } of buildCategoryTree(categories)) {
    const expanded =
      children.length > 0 &&
      (category.id === selectedId || children.some((child) => child.id === selectedId));

    rows.push({ category, depth: 0, hasChildren: children.length > 0, expanded });

    if (expanded) {
      for (const child of children) {
        rows.push({ category: child, depth: 1, hasChildren: false, expanded: false });
      }
    }
  }

  return rows;
}

/** Every category in picker order: each sport followed by its leagues. */
export function getCategoryOptions(categories: readonly Category[]): CategoryOption[] {
  return buildCategoryTree(categories).flatMap(({ category, children }) => [
    { category, parent: null },
    ...children.map((child) => ({ category: child, parent: category })),
  ]);
}

/** "Piłka nożna › Premier League" for a league, the plain name for a sport. */
export function getCategoryLabel(category: Category, parent?: Category | null): string {
  return parent ? `${parent.name} › ${category.name}` : category.name;
}
