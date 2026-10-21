import { describe, expect, it } from 'vitest';

import { buildReplay, parseReplayHistory } from './model';
import { replayPosterOps, type PosterOp } from './poster-layout';
import { coupon, REPLAY_TEST_NOW } from './testing/fixtures';

const model = buildReplay(parseReplayHistory([coupon()], REPLAY_TEST_NOW), 'all');
const lines = (ops: PosterOp[]) => ops.flatMap((op) => (op.kind === 'text' ? [op.value] : []));

describe('summary PNG layout', () => {
  it('exports real numbers without account IDs, slogans or an unrequested nickname', () => {
    const ops = replayPosterOps(model);
    const values = lines(ops);
    expect(values).toContain('+15,00 zł');
    expect(values).toContain('Zakłady · wirtualne zł');
    expect(values).toContain('Wirtualne zł. Bilans kuponów, nie saldo konta.');
    expect(values.join(' ')).not.toMatch(/coupon-1|Bez filtra|Twoja gra/);
    expect(ops.some((op) => op.kind === 'text' && op.y === 480)).toBe(false);
  });
  it('bounds opt-in names and discloses partial history', () => {
    const values = lines(replayPosterOps({ ...model, limited: true }, `N\n${'N'.repeat(100)}`));
    expect(values).toContain(`N ${'N'.repeat(38)}`);
    expect(values).toContain('Część historii · 200 najnowszych kuponów');
  });
  it('does not export pending results as a settled zero or a successful run', () => {
    const pending = buildReplay(parseReplayHistory([coupon({ status: 'pending', payout: 0 })], REPLAY_TEST_NOW), 'all');
    const ops = replayPosterOps(pending);
    const values = lines(ops);
    expect(values).toContain('Brak rozliczeń');
    expect(values).toContain('Kupony czekają na rozliczenie');
    expect(values).not.toContain('0,00 zł');
    expect(ops.some((op) => op.kind === 'chart')).toBe(false);
  });
  it('draws the settled curve from the zero origin in placement order', () => {
    // +15 zł win, then a 10 zł loss: cumulative 0 → +15 → +5.
    const history = parseReplayHistory([coupon(), coupon({ id: 'loss', status: 'lost', payout: 0 })], REPLAY_TEST_NOW);
    const chart = replayPosterOps(buildReplay(history, 'all')).find((op) => op.kind === 'chart');
    expect(chart).toEqual({ kind: 'chart', zeroY: 280, points: [{ x: 24, y: 280 }, { x: 500, y: 40 }, { x: 976, y: 200 }] });
  });
});
