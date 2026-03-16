import { Category } from '@/types/database';

const DEFAULT_CATEGORY_EMOJI = '⚽';

export function getCouponCategoryEmoji(
  categoryId: string | null | undefined,
  categoryMap: Record<string, Category>
): string {
  if (!categoryId) {
    return DEFAULT_CATEGORY_EMOJI;
  }

  return categoryMap[categoryId]?.emoji ?? DEFAULT_CATEGORY_EMOJI;
}
