import { deriveCouponStatus } from '@/features/coupon/display';
import type { CouponHistoryEntry } from '@/types/database';

export type ProfileHistoryType = 'sportsbook' | 'casino';
export type SportsbookHistoryFilter = 'all' | 'won' | 'lost' | 'pending' | 'refund';

export type SportsbookCouponRow = CouponHistoryEntry & { status: ReturnType<typeof deriveCouponStatus> };

/**
 * The preview refreshes in the background, so an entry loaded with "show
 * more" can shift into it; keep the first occurrence.
 */
export function mergeById<Entry extends { id: string }>(preview: Entry[], more: Entry[]): Entry[] {
  const seen = new Set(preview.map((entry) => entry.id));
  return [...preview, ...more.filter((entry) => !seen.has(entry.id))];
}

/** Rows with the displayed status (derived from the legs), filtered by it. */
export function deriveSportsbookCouponRows(
  coupons: CouponHistoryEntry[],
  filter: SportsbookHistoryFilter,
): SportsbookCouponRow[] {
  return coupons
    .map((coupon) => ({
      ...coupon,
      status: deriveCouponStatus({
        status: coupon.status,
        legs: (coupon.legs ?? []).map((leg) => ({ result: leg.result })),
      }),
    }))
    .filter((coupon) => filter === 'all' || coupon.status === filter);
}
