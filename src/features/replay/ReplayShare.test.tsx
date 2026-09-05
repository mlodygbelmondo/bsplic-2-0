import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildReplay, parseReplayHistory } from './model';
import { ReplayShare } from './ReplayShare';
import { coupon, REPLAY_TEST_NOW } from './testing/fixtures';

const mocks = vi.hoisted(() => ({ poster: vi.fn(), info: vi.fn(), error: vi.fn(), theme: 'dark' }));
vi.mock('@/contexts/ThemeContext', () => ({ useTheme: () => ({ theme: mocks.theme }) }));
vi.mock('./poster', () => ({ createReplayPoster: mocks.poster }));
vi.mock('sonner', () => ({ toast: { info: mocks.info, error: mocks.error } }));
const model = buildReplay(parseReplayHistory([coupon()], REPLAY_TEST_NOW), 'all');
const createUrl = vi.fn();
const revokeUrl = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mocks.theme = 'dark';
  mocks.poster.mockResolvedValue(new Blob(['png'], { type: 'image/png' }));
  let index = 0;
  createUrl.mockImplementation(() => `blob:poster-${++index}`);
  vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL: createUrl, revokeObjectURL: revokeUrl }));
  Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined });
  Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('private on-device poster sharing', () => {
  it('omits the username by default and prepares a downloadable file', async () => {
    render(<ReplayShare model={model} username="Prywatny nick" />);
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    const download = await screen.findByRole('link', { name: 'Zapisz PNG' });
    expect(download).toHaveAttribute('download', 'bsplic-replay.png');
    expect(mocks.poster).toHaveBeenCalledWith(model, undefined);
    expect(screen.getByRole('img')).toHaveAccessibleName(/bez nicku/);
  });
  it('regenerates only after name consent and revokes old object URLs', async () => {
    const view = render(<ReplayShare model={model} username="Prywatny nick" />);
    await screen.findByRole('link', { name: 'Zapisz PNG' });
    fireEvent.click(screen.getByRole('checkbox'));
    await waitFor(() => expect(mocks.poster).toHaveBeenLastCalledWith(model, 'Prywatny nick'));
    await screen.findByRole('img', { name: /gracza Prywatny nick/ });
    expect(revokeUrl).toHaveBeenCalledWith('blob:poster-1');
    view.unmount();
    expect(revokeUrl).toHaveBeenCalledWith('blob:poster-2');
  });
  it('keeps a PNG fallback when file sharing is unsupported', async () => {
    render(<ReplayShare model={model} username="Astra" />);
    await screen.findByRole('link', { name: 'Zapisz PNG' });
    fireEvent.click(screen.getByRole('button', { name: 'Udostępnij' }));
    expect(mocks.info).toHaveBeenCalledOnce();
    expect(screen.getByRole('link', { name: 'Zapisz PNG' })).toBeInTheDocument();
  });
  it('shares a prebuilt PNG and treats cancellation as normal', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError'));
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    render(<ReplayShare model={model} username="Astra" />);
    await screen.findByRole('link', { name: 'Zapisz PNG' });
    fireEvent.click(screen.getByRole('button', { name: 'Udostępnij' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Udostępnij' })).toBeEnabled());
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ files: [expect.any(File)] }));
    expect(mocks.error).not.toHaveBeenCalled();
  });
  it('regenerates for a different app theme', async () => {
    const view = render(<ReplayShare model={model} username="Astra" />);
    await screen.findByRole('link', { name: 'Zapisz PNG' });
    mocks.theme = 'light';
    view.rerender(<ReplayShare model={model} username="Astra" />);
    await waitFor(() => expect(mocks.poster).toHaveBeenCalledTimes(2));
    expect(revokeUrl).toHaveBeenCalledWith('blob:poster-1');
  });
  it('recovers from canvas failure via an explicit retry', async () => {
    mocks.poster.mockRejectedValueOnce(new Error('canvas unavailable'));
    render(<ReplayShare model={model} username="Astra" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się utworzyć plakatu');
    fireEvent.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    expect(await screen.findByRole('link', { name: 'Zapisz PNG' })).toBeInTheDocument();
  });
});
