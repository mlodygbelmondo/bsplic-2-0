import { describe, expect, it } from 'vitest';

import type { Category } from '@/types/database';

import {
  buildCategoryTree,
  getCategoryFilterIds,
  getCategoryLabel,
  getCategoryOptions,
  getVisibleCategoryRows,
} from './category-tree';

function category(id: string, name: string, sortOrder: number, parentId: string | null = null): Category {
  return {
    id,
    name,
    emoji: '🏷️',
    color: '#000000',
    sort_order: sortOrder,
    created_at: '2026-10-01T00:00:00.000Z',
    parent_id: parentId,
    slug: null,
  };
}

// Deliberately shuffled so ordering comes from sort_order/name, not input order.
const CATEGORIES: Category[] = [
  category('ekstraklasa', 'Ekstraklasa', 2, 'football'),
  category('ufc', 'UFC', 3),
  category('wta', 'WTA', 2, 'tennis'),
  category('tennis', 'Tenis', 2),
  category('premier', 'Premier League', 1, 'football'),
  category('esport', 'Esport', 2),
  category('football', 'Piłka nożna', 1),
  category('atp', 'ATP', 1, 'tennis'),
  category('champions', 'Liga Mistrzów', 1, 'football'),
];

const sorted = (ids: string[] | null) => (ids ? [...ids].sort() : ids);

describe('buildCategoryTree', () => {
  it('orders sports by sort_order then name and nests leagues under their sport', () => {
    const tree = buildCategoryTree(CATEGORIES);

    expect(tree.map((node) => node.category.id)).toEqual(['football', 'esport', 'tennis', 'ufc']);
    expect(tree.map((node) => node.children.map((child) => child.id))).toEqual([
      ['champions', 'premier', 'ekstraklasa'],
      [],
      ['atp', 'wta'],
      [],
    ]);
  });

  it('treats a category whose parent no longer exists as a top-level category', () => {
    const tree = buildCategoryTree([
      category('football', 'Piłka nożna', 1),
      category('orphan', 'Liga Europy', 0, 'deleted-sport'),
    ]);

    expect(tree.map((node) => node.category.id)).toEqual(['orphan', 'football']);
    expect(tree.every((node) => node.children.length === 0)).toBe(true);
  });
});

describe('getCategoryFilterIds', () => {
  it('returns null when no category is selected', () => {
    expect(getCategoryFilterIds(CATEGORIES, null)).toBeNull();
  });

  it('includes the sport and every one of its leagues when a sport is selected', () => {
    expect(sorted(getCategoryFilterIds(CATEGORIES, 'football'))).toEqual([
      'champions',
      'ekstraklasa',
      'football',
      'premier',
    ]);
  });

  it('returns only the league itself when a league is selected', () => {
    expect(getCategoryFilterIds(CATEGORIES, 'premier')).toEqual(['premier']);
  });

  it('returns only the category itself for a sport without leagues', () => {
    expect(getCategoryFilterIds(CATEGORIES, 'ufc')).toEqual(['ufc']);
  });
});

describe('getVisibleCategoryRows', () => {
  const summarize = (selectedId: string | null) =>
    getVisibleCategoryRows(CATEGORIES, selectedId).map(
      (row) => `${row.depth}:${row.category.id}:${row.hasChildren ? 'group' : 'leaf'}:${row.expanded ? 'open' : 'closed'}`,
    );

  it('lists only sports, all collapsed, when nothing is selected', () => {
    expect(summarize(null)).toEqual([
      '0:football:group:closed',
      '0:esport:leaf:closed',
      '0:tennis:group:closed',
      '0:ufc:leaf:closed',
    ]);
  });

  it('expands the selected sport and lists its leagues right below it', () => {
    expect(summarize('tennis')).toEqual([
      '0:football:group:closed',
      '0:esport:leaf:closed',
      '0:tennis:group:open',
      '1:atp:leaf:closed',
      '1:wta:leaf:closed',
      '0:ufc:leaf:closed',
    ]);
  });

  it('keeps the sport expanded while one of its leagues is selected', () => {
    expect(summarize('ekstraklasa')).toEqual([
      '0:football:group:open',
      '1:champions:leaf:closed',
      '1:premier:leaf:closed',
      '1:ekstraklasa:leaf:closed',
      '0:esport:leaf:closed',
      '0:tennis:group:closed',
      '0:ufc:leaf:closed',
    ]);
  });

  it('expands nothing when a sport without leagues is selected', () => {
    expect(summarize('ufc')).toEqual(summarize(null));
  });
});

describe('getCategoryOptions and getCategoryLabel', () => {
  it('lists every sport followed by its leagues with readable labels', () => {
    const labels = getCategoryOptions(CATEGORIES).map((option) =>
      getCategoryLabel(option.category, option.parent),
    );

    expect(labels).toEqual([
      'Piłka nożna',
      'Piłka nożna › Liga Mistrzów',
      'Piłka nożna › Premier League',
      'Piłka nożna › Ekstraklasa',
      'Esport',
      'Tenis',
      'Tenis › ATP',
      'Tenis › WTA',
      'UFC',
    ]);
  });
});
