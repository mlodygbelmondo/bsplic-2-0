import { useId, useMemo, useState } from 'react';

import { formatReplayDate, formatReplayMoney, replayChart, STATUS_LABELS, type ReplayModel } from './model';

export function ReplayChart({ model }: { model: ReplayModel }) {
  // Selection is an ID, not a stale array offset. A refresh can remove or settle coupons.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const id = useId();
  const chart = useMemo(() => replayChart(model.timeline.map((entry) => entry.cumulativeCents)), [model.timeline]);
  const found = model.timeline.findIndex((entry) => entry.coupon.id === selectedId);
  const selected = found >= 0 ? found : model.timeline.length - 1;
  const moment = model.timeline[selected];
  const point = chart.points[selected + 1];

  if (!moment) return <p className="py-10 text-sm text-muted-foreground">Wykres pojawi się po rozliczeniu kuponów.</p>;

  const select = (index: number) => setSelectedId(model.timeline[index]?.coupon.id ?? null);
  return (
    <div className="replay-chart mt-4">
      <svg viewBox="0 0 1000 320" preserveAspectRatio="none" role="img" aria-label="Bilans kuponów w kolejności postawienia" onPointerMove={(event) => {
        if (event.pointerType !== 'mouse') return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (!bounds.width) return;
        const fraction = ((event.clientX - bounds.left) / bounds.width * 1000 - 24) / 952;
        select(Math.max(0, Math.min(model.timeline.length - 1, Math.round(fraction * model.timeline.length) - 1)));
      }}>
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.14" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${chart.path} L976,${chart.zeroY} L24,${chart.zeroY} Z`} fill={`url(#${id}-fill)`} />
        <line x1="24" x2="976" y1={chart.zeroY} y2={chart.zeroY} className="replay-zero" />
        <path d={chart.path} className="replay-line" />
        <line x1={point.x} x2={point.x} y1="20" y2="300" className="replay-cursor" />
        <circle cx={point.x} cy={point.y} r="6" fill="currentColor" />
      </svg>
      <label htmlFor={id} className="sr-only">Wybierz kupon na wykresie</label>
      <input id={id} className="replay-scrubber" type="range" min={0} max={model.timeline.length - 1} value={selected} disabled={model.timeline.length < 2} onChange={(event) => select(Number(event.target.value))} aria-valuetext={`${formatReplayDate(moment.coupon.created_at)}, ${STATUS_LABELS[moment.coupon.status]}, bilans ${formatReplayMoney(moment.cumulativeCents, true)}`} />
      <output htmlFor={id} className="flex min-h-8 flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
        <span className="text-muted-foreground">{formatReplayDate(moment.coupon.created_at)} · {STATUS_LABELS[moment.coupon.status]}</span>
        <span className="font-semibold tabular-nums text-foreground">{formatReplayMoney(moment.cumulativeCents, true)}</span>
      </output>
    </div>
  );
}
