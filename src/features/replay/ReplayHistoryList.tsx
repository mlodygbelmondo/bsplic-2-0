import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CouponHistoryEntry } from '@/types/database';

import { formatReplayDate, formatReplayMoney, STATUS_LABELS, type ReplayModel } from './model';
import { ReplayCouponDetails } from './ReplayCouponDetails';

const PAGE_SIZE = 20;
const FILTERS = { all: 'Wszystkie', won: 'Wygrane', lost: 'Przegrane', pending: 'W grze', refund: 'Zwroty' };
type Filter = keyof typeof FILTERS;

export function ReplayHistoryList({ model }: { model: ReplayModel }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const coupons = model.coupons.slice().reverse().filter((coupon) => filter === 'all' || coupon.status === filter);
  const visible = coupons.slice(0, limit);
  return (
    <section className="app-surface min-w-0 rounded-xl" aria-label="Kupony">
      <div className="flex items-center justify-between gap-3 px-5 pt-5"><h2 className="text-base font-semibold">Kupony <span className="ml-1 font-normal text-muted-foreground">{model.coupons.length}</span></h2><span className="text-sm text-muted-foreground">Wypłata</span></div>
      <div className="replay-filters mx-5 my-4 flex gap-1 overflow-x-auto pb-1" role="group" aria-label="Filtr kuponów">
        {(Object.entries(FILTERS) as [Filter, string][]).map(([value, label]) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => { setFilter(value); setLimit(PAGE_SIZE); }} className={cn(
          'min-h-11 shrink-0 rounded-full px-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring',
          filter === value ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}>{label}{value !== 'all' && <span className="ml-1.5 tabular-nums">{model.counts[value]}</span>}</button>)}
      </div>
      {visible.length > 0 ? <ul className="divide-y divide-border border-t border-border">
        {visible.map((coupon) => <CouponRow key={coupon.id} coupon={coupon} />)}
      </ul> : <p className="px-5 pb-6 text-sm text-muted-foreground" role="status">Brak kuponów z tym wynikiem.</p>}
      {coupons.length > PAGE_SIZE && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border p-3">
        <span className="px-2 text-sm text-muted-foreground">{visible.length} z {coupons.length}</span>
        {limit < coupons.length ? <Button type="button" variant="ghost" onClick={() => setLimit((current) => current + PAGE_SIZE)}>Pokaż więcej</Button> : <Button type="button" variant="ghost" onClick={() => setLimit(PAGE_SIZE)}>Pokaż mniej</Button>}
      </div>}
    </section>
  );
}

function CouponRow({ coupon }: { coupon: CouponHistoryEntry }) {
  const title = coupon.legs?.[0]?.bet_title || 'Kupon';
  return (
    <li>
      <details className="replay-coupon-row group">
        <summary className="grid min-h-20 cursor-pointer grid-cols-[minmax(0,1fr)_auto_16px] items-center gap-3 px-5 py-4 hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{title}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{formatReplayDate(coupon.created_at)}{coupon.legs && coupon.legs.length > 1 && ` · AKO ${coupon.legs.length}`}</span>
          </span>
          <span className="flex flex-col items-end gap-1 text-right">
            <span className="replay-status text-xs font-medium" data-status={coupon.status}>{STATUS_LABELS[coupon.status]}</span>
            <span className="text-sm font-semibold tabular-nums">{coupon.status === 'pending' ? '—' : formatReplayMoney(Math.round(coupon.payout * 100))}<span className="sr-only"> wypłaty</span></span>
          </span>
          <ChevronDown aria-hidden="true" size={16} className="text-muted-foreground group-open:rotate-180" />
        </summary>
        <div className="border-t border-border bg-muted/20 px-5 py-4"><ReplayCouponDetails coupon={coupon} /></div>
      </details>
    </li>
  );
}
