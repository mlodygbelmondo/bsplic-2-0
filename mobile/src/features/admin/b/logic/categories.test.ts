import { describe, expect, it } from 'vitest';

import type { Category } from '@/types/database';

import {
  getCategoryPaginationRange,
  getParentCategoryChoices,
  getParentSelectOptions,
  normalizeHexColor,
  parentIdToSelectValue,
  parseSortOrder,
  selectValueToParentId,
  toCategoryForm,
} from './categories';

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

// Rows as the database returns them (sorted by sort_order only).
const DB_ROWS: Category[] = [
  category('premier', 'Premier League', 0, 'football'),
  category('ufc', 'UFC', 1),
  category('football', 'Piłka nożna', 2),
];

const ids = (categories: Category[]) => categories.map((entry) => entry.id);

describe('getParentCategoryChoices', () => {
  it('offers every sport, in tree order, as the parent of a new category', () => {
    const choices = getParentCategoryChoices(DB_ROWS, null);
    expect(ids(choices.options)).toEqual(['ufc', 'football']);
    expect(choices.locked).toBe(false);
  });

  it('does not let a sport with leagues get a parent of its own', () => {
    const football = DB_ROWS[2];
    expect(getParentCategoryChoices(DB_ROWS, football)).toEqual({ options: [], locked: true });
  });

  it('never offers a sport without leagues as its own parent', () => {
    const ufc = DB_ROWS[1];
    expect(ids(getParentCategoryChoices(DB_ROWS, ufc).options)).toEqual(['football']);
  });

  it('lets a league move to another sport', () => {
    const premier = DB_ROWS[0];
    const choices = getParentCategoryChoices(DB_ROWS, premier);
    expect(ids(choices.options)).toEqual(['ufc', 'football']);
    expect(choices.locked).toBe(false);
  });
});

describe('parent select', () => {
  it('lists "Brak" first, then each sport with its emoji', () => {
    const labels = getParentSelectOptions(getParentCategoryChoices(DB_ROWS, null).options).map(
      (option) => option.label,
    );
    expect(labels).toEqual(['Brak', '🏷️ UFC', '🏷️ Piłka nożna']);
  });

  it('maps "Brak" to a top-level category and back', () => {
    const [none, ufc] = getParentSelectOptions([DB_ROWS[1]]);
    expect(selectValueToParentId(none.value)).toBeNull();
    expect(selectValueToParentId(ufc.value)).toBe('ufc');
    expect(parentIdToSelectValue(null)).toBe(none.value);
    expect(parentIdToSelectValue('ufc')).toBe('ufc');
  });

  it('keeps the parent when an existing league is edited', () => {
    expect(toCategoryForm(DB_ROWS[0]).parent_id).toBe('football');
    expect(toCategoryForm(DB_ROWS[1]).parent_id).toBeNull();
  });
});

describe('getCategoryPaginationRange', () => {
  it('lists every page when there are at most seven', () => {
    expect(getCategoryPaginationRange(0, 3)).toEqual([0, 1, 2]);
    expect(getCategoryPaginationRange(6, 7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('collapses distant pages into ellipses around the current page', () => {
    expect(getCategoryPaginationRange(0, 10)).toEqual([0, 1, 'ellipsis', 9]);
    expect(getCategoryPaginationRange(5, 10)).toEqual([0, 'ellipsis', 4, 5, 6, 'ellipsis', 9]);
    expect(getCategoryPaginationRange(9, 10)).toEqual([0, 'ellipsis', 8, 9]);
  });
});

describe('parseSortOrder', () => {
  it('parses numbers and falls back to 0 like a number input', () => {
    expect(parseSortOrder('12')).toBe(12);
    expect(parseSortOrder('')).toBe(0);
    expect(parseSortOrder('abc')).toBe(0);
  });
});

describe('normalizeHexColor', () => {
  it('accepts short, long and alpha hex colors and lowercases them', () => {
    expect(normalizeHexColor('#DC2626')).toBe('#dc2626');
    expect(normalizeHexColor('f00')).toBe('#ff0000');
    expect(normalizeHexColor('#10B981FF')).toBe('#10b981');
  });

  it('rejects anything that is not a hex color', () => {
    expect(normalizeHexColor('red')).toBeNull();
    expect(normalizeHexColor('#12345')).toBeNull();
  });
});
