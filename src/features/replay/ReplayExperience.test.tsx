import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildReplay, parseReplayHistory } from './model';
import { ReplayExperience } from './ReplayExperience';
import { coupon, replayFixtures, REPLAY_TEST_NOW } from './testing/fixtures';

vi.mock('./ReplayShare', () => ({ ReplayShare: () => <div>Finał testowy</div> }));
const model = buildReplay(parseReplayHistory(replayFixtures(), REPLAY_TEST_NOW), 'all');

function media(reduced = false) {
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    matches: reduced, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
}

beforeEach(() => media());
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('Replay experience', () => {
  it('starts manually, navigates all chapters, and restarts', () => {
    render(<ReplayExperience model={model} username="Astra Demo" />);
    expect(screen.getByRole('button', { name: 'Odtwórz automatycznie' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Wstecz' })).toBeDisabled();
    for (let chapter = 0; chapter < 4; chapter += 1) fireEvent.click(screen.getByRole('button', { name: 'Dalej' }));
    expect(screen.getByText('Finał testowy')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Od początku' }));
    expect(screen.getByRole('button', { name: 'Rozdział 1: Wejście' })).toHaveAttribute('aria-current', 'step');
  });
  it('supports arrow navigation without stealing the chart slider arrows', () => {
    render(<ReplayExperience model={model} username="Astra Demo" />);
    fireEvent.keyDown(screen.getByRole('region', { name: 'Twój Replay' }), { key: 'ArrowRight' });
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(screen.getByRole('button', { name: 'Rozdział 2: Bilans' })).toHaveAttribute('aria-current', 'step');
    fireEvent.change(slider, { target: { value: '0' } });
    expect(slider).toHaveValue('0');
    expect(slider.getAttribute('aria-valuetext')).toContain('bilans');
  });
  it('keeps keyboard focus on a persistent chapter control when a scene unmounts', () => {
    render(<ReplayExperience model={model} username="Astra Demo" />);
    fireEvent.click(screen.getByRole('button', { name: 'Rozdział 4: Mapa' }));
    const map = screen.getByRole('group', { name: /Mapa kuponów/ });
    const tile = within(map).getAllByRole('button')[0];
    tile.focus();
    fireEvent.keyDown(tile, { key: 'ArrowRight' });
    expect(screen.getByRole('button', { name: 'Rozdział 5: Finał' })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    expect(screen.getByRole('button', { name: 'Rozdział 4: Mapa' })).toHaveFocus();
  });
  it('never moves before opting in and pauses on interaction', () => {
    vi.useFakeTimers();
    render(<ReplayExperience model={model} username="Astra Demo" />);
    act(() => vi.advanceTimersByTime(15000));
    expect(screen.getByRole('button', { name: 'Rozdział 1: Wejście' })).toHaveAttribute('aria-current', 'step');
    fireEvent.click(screen.getByRole('button', { name: 'Odtwórz automatycznie' }));
    act(() => vi.advanceTimersByTime(7000));
    expect(screen.getByRole('slider')).toBeInTheDocument();
    fireEvent.focus(screen.getByRole('slider'));
    act(() => vi.advanceTimersByTime(14000));
    expect(screen.getByRole('slider')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Odtwórz automatycznie' })).toHaveAttribute('aria-pressed', 'false');
  });
  it('pauses when the page becomes hidden', () => {
    vi.useFakeTimers();
    render(<ReplayExperience model={model} username="Astra Demo" />);
    fireEvent.click(screen.getByRole('button', { name: 'Odtwórz automatycznie' }));
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    fireEvent(document, new Event('visibilitychange'));
    act(() => vi.advanceTimersByTime(14000));
    expect(screen.getByRole('button', { name: 'Rozdział 1: Wejście' })).toHaveAttribute('aria-current', 'step');
  });
  it('respects reduced motion and offers manual chapters', () => {
    vi.restoreAllMocks();
    media(true);
    render(<ReplayExperience model={model} username="Astra Demo" />);
    expect(screen.getByRole('button', { name: 'Odtwórz automatycznie' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Rozdział 3: Kadr' }));
    expect(screen.getByText('Szczegóły kuponu (1)')).toBeInTheDocument();
  });
  it('bounds the map and allows inspecting every loaded coupon', () => {
    render(<ReplayExperience model={model} username="Astra Demo" />);
    fireEvent.click(screen.getByRole('button', { name: 'Rozdział 4: Mapa' }));
    const map = screen.getByRole('group', { name: /Mapa kuponów/ });
    expect(within(map).getAllByRole('button')).toHaveLength(40);
    fireEvent.click(screen.getByRole('button', { name: 'Pokaż wszystkie (48)' }));
    expect(within(map).getAllByRole('button')).toHaveLength(48);
    fireEvent.click(within(map).getAllByRole('button')[0]);
    expect(within(map).getAllByRole('button')[0]).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Zwiń mapę' }));
    expect(within(map).getAllByRole('button')).toHaveLength(40);
  });
  it('shows truthful copy without a winning coupon', () => {
    const losses = buildReplay(parseReplayHistory([coupon({ status: 'lost', payout: 0 })], REPLAY_TEST_NOW), 'all');
    render(<ReplayExperience model={losses} username="<script>" />);
    fireEvent.click(screen.getByRole('button', { name: 'Rozdział 3: Kadr' }));
    expect(screen.getByText(/nie ma jeszcze wygranej/)).toBeInTheDocument();
    expect(screen.getByText('Przegrany')).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
  });
  it('cleans up the autoplay timer on unmount', () => {
    vi.useFakeTimers();
    const view = render(<ReplayExperience model={model} username="Astra Demo" />);
    fireEvent.click(screen.getByRole('button', { name: 'Odtwórz automatycznie' }));
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
