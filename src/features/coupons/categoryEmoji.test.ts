import { describe, expect, it } from 'vitest';

import { Category } from '@/types/database';

import { getCouponCategoryEmoji } from './categoryEmoji';

const categoryMap: Record<string, Category> = {
  football: {
    id: 'football',
    name: 'Piłka nożna',
    emoji: '⚽',
    color: '#111111',
    sort_order: 1,
    created_at: '2030-01-01T00:00:00.000Z',
  },
  tennis: {
    id: 'tennis',
    name: 'Tenis',
    emoji: '🎾',
    color: '#222222',
    sort_order: 2,
    created_at: '2030-01-01T00:00:00.000Z',
  },
};

describe('getCouponCategoryEmoji', () => {
  it('returns emoji for existing category id', () => {
    expect(getCouponCategoryEmoji('tennis', categoryMap)).toBe('🎾');
  });

  it('returns fallback when category id is missing', () => {
    expect(getCouponCategoryEmoji(null, categoryMap)).toBe('⚽');
  });

  it('returns fallback when category id is unknown', () => {
    expect(getCouponCategoryEmoji('unknown', categoryMap)).toBe('⚽');
  });
});
