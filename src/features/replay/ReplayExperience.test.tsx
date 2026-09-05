import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildReplay, formatReplayMoney, parseReplayHistory } from './model';
import { ReplayExperience } from './ReplayExperience';
import { coupon, replayFixtures, REPLAY_TEST_NOW } from './testing/fixtures';

vi.mock('./ReplayShare', () => ({ ReplayShare: () => <div>Podgląd testowy</div> }));
const model = buildReplay(parseReplayHistory(replayFixtures(), REPLAY_TEST_NOW), 'all');
afterEach(cleanup);

describe('Replay overview', () => {
  it('shows the result, chart and coupons immediately without an intro or autoplay', () => {
    render(<ReplayExperience model={model} username="Astra Demo" />);
    expect(screen.getByRole('heading', { name: 'Wynik netto' })).toBeInTheDocument();
    expect(screen.getByRole('slider')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /Mapa kuponów/ })).toBeInTheDocument();
    expect(screen.queryByText(/Bez filtra|BSPLIC ORIGINAL|Nie do podrobienia/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /Odtwórz automatycznie/ })).toBeNull();
    expect(screen.queryByText('Podgląd testowy')).toBeNull();
  });
  it('scrubs actual cumulative results and gives the range an accessible value', () => {
    render(<ReplayExperience model={model} username="Astra" />);
    const slider = screen.getByRole('slider', { name: 'Odtwórz bilans kuponów' });
    fireEvent.change(slider, { target: { value: '0' } });
    expect(slider).toHaveValue('0');
    expect(slider.getAttribute('aria-valuetext')).toContain(formatReplayMoney(model.timeline[0].cumulativeCents, true));
  });
  it('bounds the map and allows inspecting every loaded coupon', () => {
    render(<ReplayExperience model={model} username="Astra" />);
    const map = screen.getByRole('group', { name: /Mapa kuponów/ });
    expect(within(map).getAllByRole('button')).toHaveLength(40);
    fireEvent.click(screen.getByRole('button', { name: 'Pokaż wszystkie (48)' }));
    expect(within(map).getAllByRole('button')).toHaveLength(48);
    const tile = within(map).getAllByRole('button')[0];
    tile.focus();
    fireEvent.click(tile);
    expect(tile).toHaveAttribute('aria-pressed', 'true');
    expect(tile).toHaveFocus();
    expect(screen.getByRole('heading', { name: 'Wybrany kupon' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Zwiń mapę' }));
    expect(within(map).getAllByRole('button')).toHaveLength(40);
  });
  it('only mounts the export after an explicit action and restores focus on close', async () => {
    render(<ReplayExperience model={model} username="Astra" />);
    const trigger = screen.getByRole('button', { name: 'Udostępnij Replay' });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Udostępnij Replay' })).toBeInTheDocument();
    expect(screen.getByText('Podgląd testowy')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Zamknij' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await vi.waitFor(() => expect(trigger).toHaveFocus());
  });
  it('shows losses without inventing a winning highlight', () => {
    const losses = buildReplay(parseReplayHistory([coupon({ status: 'lost', payout: 0 })], REPLAY_TEST_NOW), 'all');
    const { container } = render(<ReplayExperience model={losses} username="Astra" />);
    expect(container.querySelector('.replay-big-money')).toHaveTextContent('-10,00');
    expect(screen.getByRole('heading', { name: 'Ostatni kupon' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Największa wypłata' })).toBeNull();
  });
  it('does not draw a zero-profit chart or show a payout for pending-only history', () => {
    const pending = buildReplay(parseReplayHistory([coupon({ status: 'pending', payout: 0 })], REPLAY_TEST_NOW), 'all');
    const { container } = render(<ReplayExperience model={pending} username="Astra" />);
    expect(screen.getByText('Kupony czekają na rozliczenie')).toBeInTheDocument();
    expect(screen.queryByRole('slider')).toBeNull();
    expect(container.querySelector('.replay-payout')).toHaveTextContent('—');
  });
  it('retains the selected coupon through a refresh and falls back when it disappears', () => {
    const view = render(<ReplayExperience model={model} username="Astra" />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '0' } });
    const value = screen.getByRole('slider').getAttribute('aria-valuetext');
    view.rerender(<ReplayExperience model={{ ...model, timeline: [...model.timeline] }} username="Astra" />);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', value);
    const pending = buildReplay(parseReplayHistory([coupon({ status: 'pending', payout: 0 })], REPLAY_TEST_NOW), 'all');
    view.rerender(<ReplayExperience model={pending} username="Astra" />);
    expect(screen.queryByRole('slider')).toBeNull();
    expect(screen.getByText('Kupon sportsbook')).toBeInTheDocument();
  });
  it('leaves a one-coupon timeline inspectable without a meaningless slider interaction', () => {
    const one = buildReplay(parseReplayHistory([coupon()], REPLAY_TEST_NOW), 'all');
    render(<ReplayExperience model={one} username="Astra" />);
    expect(screen.getByRole('slider')).toBeDisabled();
    expect(screen.getByRole('img', { name: /Bilans kuponów/ })).toBeInTheDocument();
  });
});
