import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { buildReplay, parseReplayHistory } from './model';
import { ReplaySummary } from './ReplaySummary';
import { coupon, replayFixtures, REPLAY_TEST_NOW } from './testing/fixtures';

const modelFor = (rows = replayFixtures()) => buildReplay(parseReplayHistory(rows, REPLAY_TEST_NOW), 'all');
afterEach(cleanup);

describe('summary-first Replay', () => {
  it('shows results, chart, highlight and history without an intro or chapter controls', () => {
    render(<ReplaySummary model={modelFor()} />);
    expect(screen.getByRole('region', { name: 'Bilans kuponów' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Wybierz kupon na wykresie' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Najwyższa wypłata' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Kupony' })).toBeInTheDocument();
    expect(screen.queryByText(/Bez filtra|BSPLIC ORIGINAL|Dalej|Odtwórz/)).not.toBeInTheDocument();
    expect(screen.getByText('Jak liczymy?').closest('details')).not.toHaveAttribute('open');
  });

  it('exposes each coupon through native keyboard-accessible disclosure rows', () => {
    render(<ReplaySummary model={modelFor()} />);
    const history = screen.getByRole('region', { name: 'Kupony' });
    const rows = history.querySelectorAll('.replay-coupon-row');
    expect(rows).toHaveLength(20);
    expect(rows[0].querySelector('summary')).toHaveTextContent('Wieczór derbowy');
    expect(rows[0].querySelector('.replay-coupon-details')).toHaveTextContent('Gospodarze');
    fireEvent.click(within(history).getByRole('button', { name: 'Pokaż więcej' }));
    expect(history.querySelectorAll('.replay-coupon-row')).toHaveLength(40);
    fireEvent.click(within(history).getByRole('button', { name: 'Pokaż więcej' }));
    expect(history.querySelectorAll('.replay-coupon-row')).toHaveLength(48);
    fireEvent.click(within(history).getByRole('button', { name: 'Pokaż mniej' }));
    expect(history.querySelectorAll('.replay-coupon-row')).toHaveLength(20);
  });

  it('filters outcomes locally and resets pagination', () => {
    const model = modelFor();
    render(<ReplaySummary model={model} />);
    const history = screen.getByRole('region', { name: 'Kupony' });
    fireEvent.click(within(history).getByRole('button', { name: /^Wygrane/ }));
    expect(history.querySelectorAll('.replay-coupon-row')).toHaveLength(Math.min(20, model.counts.won));
    expect(within(history).queryByText('Przegrany')).not.toBeInTheDocument();
    fireEvent.click(within(history).getByRole('button', { name: /^W grze/ }));
    expect(history.querySelectorAll('.replay-coupon-row')).toHaveLength(model.counts.pending);
  });

  it('does not invent wins, profit or a curve for pending history', () => {
    render(<ReplaySummary model={modelFor([coupon({ status: 'pending', payout: 0 })])} />);
    expect(screen.getByText('Brak rozliczonych kuponów.')).toBeInTheDocument();
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Najwyższa wypłata' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Ostatni kupon' })).toBeInTheDocument();
  });

  it('keeps negative results visible and falls back honestly when there is no win', () => {
    render(<ReplaySummary model={modelFor([coupon({ status: 'lost', payout: 0, stake: 10 })])} />);
    expect(screen.getByRole('region', { name: 'Bilans kuponów' }).querySelector('.replay-net')).toHaveTextContent('-10,00 zł');
    expect(screen.getByRole('region', { name: 'Ostatni kupon' })).toBeInTheDocument();
    expect(screen.getByRole('slider')).toBeDisabled();
  });

  it('updates chart selection safely when a refreshed snapshot removes a selected coupon', () => {
    const view = render(<ReplaySummary model={modelFor()} />);
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '0' } });
    expect(slider).toHaveValue('0');
    view.rerender(<ReplaySummary model={modelFor([coupon({ id: 'replacement', stake: 30, payout: 0, status: 'lost' })])} />);
    expect(screen.getByRole('slider')).toHaveValue('0');
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', expect.stringContaining('-30,00 zł'));
    view.rerender(<ReplaySummary model={modelFor([coupon({ status: 'pending' })])} />);
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });

  it('keeps all 200 loaded coupons inspectable', () => {
    render(<ReplaySummary model={modelFor(replayFixtures(200))} />);
    const history = screen.getByRole('region', { name: 'Kupony' });
    for (let i = 0; i < 9; i++) fireEvent.click(within(history).getByRole('button', { name: 'Pokaż więcej' }));
    expect(history.querySelectorAll('.replay-coupon-row')).toHaveLength(200);
    expect(within(history).queryByRole('button', { name: 'Pokaż więcej' })).not.toBeInTheDocument();
  });

  it('has a useful empty filter and tolerates missing leg details', () => {
    render(<ReplaySummary model={modelFor([coupon()])} />);
    const history = screen.getByRole('region', { name: 'Kupony' });
    expect(history).toHaveTextContent('Brak szczegółów tego kuponu.');
    fireEvent.click(within(history).getByRole('button', { name: /^Przegrane/ }));
    expect(within(history).getByRole('status')).toHaveTextContent('Brak kuponów z tym wynikiem.');
  });
});
