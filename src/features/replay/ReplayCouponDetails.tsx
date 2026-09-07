import type { CouponHistoryEntry } from '@/types/database';

import { formatReplayMoney, STATUS_LABELS } from './model';

export function ReplayCouponDetails({ coupon }: { coupon: CouponHistoryEntry }) {
  return (
    <div className="replay-coupon-details">
      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div><dt className="text-muted-foreground">Stawka</dt><dd className="mt-1 font-semibold tabular-nums">{formatReplayMoney(Math.round(coupon.stake * 100))}</dd></div>
        <div><dt className="text-muted-foreground">Kurs łączny</dt><dd className="mt-1 font-semibold tabular-nums">×{coupon.total_odds.toFixed(2)}</dd></div>
      </dl>
      {coupon.legs?.length ? <ul className="mt-4 divide-y divide-border">
        {coupon.legs.map((leg) => <li key={leg.id} className="py-3 first:pt-0 last:pb-0">
          <p className="break-words text-sm font-medium">{leg.bet_title || 'Wydarzenie'}</p>
          <p className="mt-1 break-words text-sm text-muted-foreground">{leg.selected_option} · ×{leg.odds_at_time.toFixed(2)} · {STATUS_LABELS[leg.result]}</p>
        </li>)}
      </ul> : <p className="mt-4 text-sm text-muted-foreground">Brak szczegółów tego kuponu.</p>}
    </div>
  );
}
