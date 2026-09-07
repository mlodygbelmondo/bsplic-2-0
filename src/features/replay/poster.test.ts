import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildReplay, parseReplayHistory } from './model';
import { createReplayPoster } from './poster';
import { coupon, REPLAY_TEST_NOW } from './testing/fixtures';

const model = buildReplay(parseReplayHistory([coupon()], REPLAY_TEST_NOW), 'all');
const text = vi.fn();
const context = {
  fillText: text, measureText: () => ({ width: 100 }), fillRect: vi.fn(), beginPath: vi.fn(), stroke: vi.fn(), save: vi.fn(),
  translate: vi.fn(), scale: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), restore: vi.fn(),
} as unknown as CanvasRenderingContext2D;

beforeEach(() => {
  text.mockClear();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (this: HTMLCanvasElement, callback, type) {
    expect(this.width).toBe(1080);
    expect(this.height).toBe(1920);
    expect(type).toBe('image/png');
    callback(new Blob(['png'], { type: 'image/png' }));
  });
});
afterEach(() => vi.restoreAllMocks());

describe('summary PNG', () => {
  it('exports real numbers without account IDs, slogans or an unrequested nickname', async () => {
    const blob = await createReplayPoster(model);
    expect(blob.type).toBe('image/png');
    const lines = text.mock.calls.map(([value]) => value);
    expect(lines).toContain('+15,00 zł');
    expect(lines).toContain('Zakłady · wirtualne zł');
    expect(lines).toContain('Wirtualne zł. Bilans kuponów, nie saldo konta.');
    expect(lines.join(' ')).not.toMatch(/coupon-1|Bez filtra|Twoja gra/);
  });
  it('bounds opt-in names and discloses partial history', async () => {
    await createReplayPoster({ ...model, limited: true }, 'N'.repeat(100));
    const lines = text.mock.calls.map(([value]) => value);
    expect(lines).toContain('N'.repeat(40));
    expect(lines).toContain('Część historii · 200 najnowszych kuponów');
  });
  it('does not export pending results as a settled zero or a successful run', async () => {
    const pending = buildReplay(parseReplayHistory([coupon({ status: 'pending', payout: 0 })], REPLAY_TEST_NOW), 'all');
    await createReplayPoster(pending);
    const lines = text.mock.calls.map(([value]) => value);
    expect(lines).toContain('Brak rozliczeń');
    expect(lines).toContain('Kupony czekają na rozliczenie');
    expect(lines).not.toContain('0,00 zł');
  });
  it('fails clearly when canvas is unavailable', async () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
    await expect(createReplayPoster(model)).rejects.toThrow('nie obsługuje');
  });
  it('rejects an empty encoding result so the UI can retry', async () => {
    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation((callback) => callback(null));
    await expect(createReplayPoster(model)).rejects.toThrow('Nie udało się przygotować');
  });
});
