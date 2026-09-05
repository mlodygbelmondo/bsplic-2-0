import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildReplay, parseReplayHistory } from './model';
import { createReplayPoster } from './poster';
import { coupon, REPLAY_TEST_NOW } from './testing/fixtures';

const model = buildReplay(parseReplayHistory([coupon()], REPLAY_TEST_NOW), 'all');
const text = vi.fn();
const fillRect = vi.fn();
const context = {
  fillText: text, fillRect, measureText: (value: string) => ({ width: value.length * 16 }),
  beginPath: vi.fn(), stroke: vi.fn(), save: vi.fn(), translate: vi.fn(), scale: vi.fn(),
  moveTo: vi.fn(), lineTo: vi.fn(), restore: vi.fn(), fillStyle: '',
} as unknown as CanvasRenderingContext2D;

beforeEach(() => {
  vi.clearAllMocks();
  document.documentElement.style.setProperty('--background', '220 14% 96%');
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (this: HTMLCanvasElement, callback, type) {
    expect(this.width).toBe(1080);
    expect(this.height).toBe(1920);
    expect(type).toBe('image/png');
    callback(new Blob(['png'], { type: 'image/png' }));
  });
});
afterEach(() => { vi.restoreAllMocks(); document.documentElement.removeAttribute('style'); });

describe('poster renderer', () => {
  it('exports actual numbers without slogans, an account ID or an unrequested name', async () => {
    const blob = await createReplayPoster(model);
    expect(blob.type).toBe('image/png');
    const lines = text.mock.calls.map(([value]) => value);
    expect(lines).toContain('Replay');
    expect(lines).toContain('Wynik kuponów, nie saldo konta.');
    expect(lines).toContain('Sportsbook · wirtualne zł');
    expect(lines.join(' ')).not.toMatch(/coupon-1|Bez filtra|Twoja gra/i);
  });
  it('reads the current app background rather than using a hardcoded poster palette', async () => {
    let background: string | CanvasGradient | CanvasPattern;
    fillRect.mockImplementationOnce(() => { background = context.fillStyle; });
    await createReplayPoster(model);
    expect(background!).toBe('hsl(220 14% 96%)');
  });
  it('bounds opt-in names and retains the partial-history disclosure', async () => {
    await createReplayPoster({ ...model, limited: true }, 'N'.repeat(100));
    const lines = text.mock.calls.map(([value]) => value);
    expect(lines).toContain('N'.repeat(40));
    expect(lines).toContain('Część historii · limit 200 kuponów');
  });
  it('does not present pending-only history as a settled result', async () => {
    await createReplayPoster(buildReplay(parseReplayHistory([coupon({ status: 'pending' })], REPLAY_TEST_NOW), 'all'));
    const lines = text.mock.calls.map(([value]) => value);
    expect(lines).toContain('Kupony czekają na rozliczenie');
    expect(lines).not.toContain('0,00 zł');
  });
  it('fails clearly when the canvas context is unavailable', async () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
    await expect(createReplayPoster(model)).rejects.toThrow('nie obsługuje');
  });
  it('rejects an empty encoding result so the UI can offer retry', async () => {
    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation((callback) => callback(null));
    await expect(createReplayPoster(model)).rejects.toThrow('Nie udało się przygotować');
  });
});
