import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildReplay, parseReplayHistory } from './model';
import { createReplayPoster } from './poster';
import { coupon, REPLAY_TEST_NOW } from './testing/fixtures';

const model = buildReplay(parseReplayHistory([coupon()], REPLAY_TEST_NOW), 'all');
const text = vi.fn();
const context = {
  fillText: text, fillRect: vi.fn(), createLinearGradient: () => ({ addColorStop: vi.fn() }),
  beginPath: vi.fn(), arc: vi.fn(), stroke: vi.fn(), save: vi.fn(),
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

describe('poster renderer', () => {
  it('renders the real summary, coverage and play-money disclaimer into a portrait PNG', async () => {
    const blob = await createReplayPoster(model);
    expect(blob.type).toBe('image/png');
    const lines = text.mock.calls.map(([value]) => value);
    expect(lines).toContain('Twoja gra. Twoja historia.');
    expect(lines).toContain('Pełny dostępny zakres');
    expect(lines).toContain('Zabawa za wirtualne zł. To nie saldo konta.');
    expect(lines.join(' ')).not.toContain('coupon-1');
  });
  it('bounds opt-in names and retains the partial-history disclosure', async () => {
    await createReplayPoster({ ...model, limited: true, coverageLabel: 'Część historii · limit 200 kuponów' }, 'N'.repeat(100));
    const lines = text.mock.calls.map(([value]) => value);
    expect(lines).toContain('N'.repeat(40));
    expect(lines).toContain('Część historii · limit 200 kuponów');
  });
  it('fails clearly when the canvas context is unavailable', async () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
    await expect(createReplayPoster(model)).rejects.toThrow('nie obsługuje');
  });
  it('rejects an empty browser encoding result so the UI can offer retry', async () => {
    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation((callback) => callback(null));
    await expect(createReplayPoster(model)).rejects.toThrow('Nie udało się przygotować');
  });
});
