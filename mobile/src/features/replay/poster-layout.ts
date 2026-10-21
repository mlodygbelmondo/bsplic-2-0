import { formatReplayMoney, replayChart, type ReplayChartPoint, type ReplayModel } from './model';

export const POSTER_WIDTH = 1080;
export const POSTER_HEIGHT = 1920;

export type PosterColor = 'background' | 'card' | 'foreground' | 'muted' | 'accent' | 'border';
export type PosterWeight = 400 | 500 | 600 | 700 | 800;

/**
 * Draw operations of the web canvas poster (`poster.ts`), in order. Text `y`
 * is the alphabetic baseline; `width` is canvas `fillText`'s maxWidth: the
 * size shrinks to 16 px to fit, then the text is squeezed horizontally.
 */
export type PosterOp =
  | { kind: 'rect'; x: number; y: number; width: number; height: number; color: PosterColor }
  | { kind: 'text'; value: string; x: number; y: number; size: number; color: PosterColor; weight: PosterWeight; width: number }
  | { kind: 'rule'; y: number }
  | { kind: 'chart'; points: ReplayChartPoint[]; zeroY: number };

/** On-device export. No remote images, uploads or account IDs. */
export function replayPosterOps(model: ReplayModel, name?: string): PosterOp[] {
  const ops: PosterOp[] = [];
  const text = (value: string, x: number, y: number, size: number, color: PosterColor = 'foreground', weight: PosterWeight = 600, width = 904) => {
    ops.push({ kind: 'text', value, x, y, size, color, weight, width });
  };

  ops.push({ kind: 'rect', x: 0, y: 0, width: POSTER_WIDTH, height: POSTER_HEIGHT, color: 'background' });
  ops.push({ kind: 'rect', x: 88, y: 88, width: 64, height: 6, color: 'accent' });
  text('BSPLIC 2.0', 88, 160, 34, 'foreground', 700);
  text('Replay', 80, 340, 144, 'foreground', 800);
  text(model.periodLabel, 88, 415, 34, 'muted', 500);
  if (name) {
    const safeName = Array.from(name.replace(/[\r\n\t]/g, ' ')).slice(0, 40).join('');
    text(safeName, 88, 480, 36, 'foreground', 600);
  }
  ops.push({ kind: 'rule', y: 540 });
  text('Bilans', 88, 620, 34, 'muted', 500);
  text(model.settledCount ? formatReplayMoney(model.netCents, true) : 'Brak rozliczeń', 80, 760, 112, 'foreground', 800);

  ops.push({ kind: 'rect', x: 64, y: 828, width: 952, height: 414, color: 'card' });
  if (model.timeline.length) {
    const chart = replayChart(model.timeline.map((moment) => moment.cumulativeCents));
    ops.push({ kind: 'chart', points: chart.points, zeroY: chart.zeroY });
  } else {
    text('Kupony czekają na rozliczenie', 100, 1050, 36, 'muted', 500, 880);
  }

  const metrics = [
    [String(model.coupons.length), 'Kupony'],
    [model.winRate === null ? '—' : `${model.winRate}%`, 'Skuteczność'],
    [model.settledCount ? formatReplayMoney(model.stakeCents) : '—', 'Stawki rozliczonych'],
    [model.settledCount ? formatReplayMoney(model.payoutCents) : '—', 'Wypłaty rozliczonych'],
  ];
  metrics.forEach(([value, label], index) => {
    const x = index % 2 === 0 ? 88 : 570;
    const y = index < 2 ? 1375 : 1575;
    text(value, x, y, 58, 'foreground', 700, 422);
    text(label, x, y + 55, 28, 'muted', 500, 422);
  });
  ops.push({ kind: 'rule', y: 1690 });
  text(model.rangeLabel, 88, 1755, 29, 'foreground', 500);
  text(model.limited ? 'Część historii · 200 najnowszych kuponów' : 'Zakłady · wirtualne zł', 88, 1810, 28, 'muted', 500);
  text('Wirtualne zł. Bilans kuponów, nie saldo konta.', 88, 1860, 26, 'muted', 400);
  return ops;
}
