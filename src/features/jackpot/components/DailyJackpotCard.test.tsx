import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { DailyJackpotSnapshot } from '../types';

import { DailyJackpotCard } from './DailyJackpotCard';

const snapshot: DailyJackpotSnapshot = {
  poolId: 'pool-1',
  poolDate: '2026-06-17',
  status: 'collecting',
  prizeAmount: 125,
  ticketPrice: 100,
  maxTicketsPerPlayer: 2,
  minUniqueUsers: 3,
  participantCount: 2,
  ticketCount: 2,
  drawScheduledAt: '2026-06-17T18:00:00.000Z',
  currentUserHasTicket: false,
  currentUserTicketCount: 0,
  currentUserTicketNumber: null,
  currentUserTicketNumbers: [],
  winnerUserId: null,
  winnerUsername: null,
  winnerAvatarUrl: null,
  winningTicketNumber: null,
  maintenanceAutoCreditedCount: 0,
  serverNow: '2026-06-17T10:00:00.000Z',
};

describe('DailyJackpotCard', () => {
  it('does not render when there is no funded jackpot', () => {
    const { container } = render(
      <DailyJackpotCard
        snapshot={{
          ...snapshot,
          poolId: null,
          prizeAmount: 0,
          ticketCount: 0,
          participantCount: 0,
        }}
        loading={false}
        buying={false}
        balance={50}
        onBuy={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders a zero-prize collecting pool so the first ticket can seed it', () => {
    const onBuy = vi.fn();

    render(
      <DailyJackpotCard
        snapshot={{
          ...snapshot,
          prizeAmount: 0,
          ticketCount: 0,
          participantCount: 0,
        }}
        loading={false}
        buying={false}
        balance={150}
        onBuy={onBuy}
      />,
    );

    expect(
      screen.getByRole('region', { name: 'Jackpot Dnia' }),
    ).toBeInTheDocument();
    expect(screen.getByText('0 zł')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Kup ticket/i }));

    expect(onBuy).toHaveBeenCalledTimes(1);
  });

  it('renders collecting state and buys a ticket', () => {
    const onBuy = vi.fn();

    const { container } = render(
      <DailyJackpotCard
        snapshot={snapshot}
        loading={false}
        buying={false}
        balance={150}
        onBuy={onBuy}
      />,
    );

    expect(
      screen.getByRole('region', { name: 'Jackpot Dnia' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /daily jackpot/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('PULA')).not.toBeInTheDocument();
    expect(screen.getByText('Pula')).toBeInTheDocument();
    expect(screen.getByText('125 zł')).toBeInTheDocument();
    expect(screen.getByText('Losowanie dziś o 20:00')).toBeInTheDocument();
    expect(screen.getByText('Minimum 3 graczy')).toBeInTheDocument();
    expect(screen.queryByText(/ticketów w puli/i)).not.toBeInTheDocument();
    expect(screen.getByText('Twoje tickety')).toBeInTheDocument();
    expect(screen.queryByText('Twój stan')).not.toBeInTheDocument();
    expect(screen.getByText('Maks. 2')).toBeInTheDocument();
    expect(screen.queryByText('Maks 2')).not.toBeInTheDocument();
    expect(screen.queryByText('Maks. 2 tickety')).not.toBeInTheDocument();
    expect(
      container.querySelector('.daily-jackpot-card__state-label')?.textContent,
    ).toBe('Losowanie dziś o 20:00');
    expect(
      container.querySelector('.daily-jackpot-card__state-dot')?.textContent,
    ).toBe('•');
    expect(
      container.querySelector('.daily-jackpot-card__price-label-desktop')?.textContent,
    ).toBe('Cena ticketu');
    expect(
      container.querySelector('.daily-jackpot-card__price-label-mobile')?.textContent,
    ).toBe('Cena');

    fireEvent.click(screen.getByRole('button', { name: /Kup ticket/i }));

    expect(onBuy).toHaveBeenCalledTimes(1);
  });

  it('opens a short funding explanation from the pool label info icon', () => {
    const { container } = render(
      <DailyJackpotCard
        snapshot={snapshot}
        loading={false}
        buying={false}
        balance={150}
        onBuy={vi.fn()}
      />,
    );

    const amountHeading = container.querySelector(
      '.daily-jackpot-card__amount-heading',
    );

    expect(amountHeading).not.toBeNull();
    expect(amountHeading).toHaveTextContent('Pula');
    expect(
      within(amountHeading as HTMLElement)
        .getByRole('button', { name: 'Skąd bierze się Jackpot?' })
        .querySelector('svg'),
    ).toHaveClass('h-3', 'w-3');

    fireEvent.click(
      within(amountHeading as HTMLElement).getByRole('button', {
        name: 'Skąd bierze się Jackpot?',
      }),
    );

    expect(
      screen.getByRole('dialog', { name: 'Skąd bierze się Jackpot?' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Pula Jackpotu bierze się z 20% stawek przegranych kuponów z poprzedniego dnia/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/kupionych ticketów w aktualnym losowaniu/i),
    ).toBeInTheDocument();
  });

  it('shows a draw CTA for a participated finished round without spoiling the winner', () => {
    const onOpenDraw = vi.fn();

    render(
      <DailyJackpotCard
        snapshot={{
          ...snapshot,
          status: 'drawn',
          currentUserHasTicket: true,
          currentUserTicketCount: 1,
          winnerUsername: 'LuckyWinner',
          winningTicketNumber: 7,
        }}
        loading={false}
        buying={false}
        balance={150}
        onBuy={vi.fn()}
        onOpenDraw={onOpenDraw}
      />,
    );

    expect(screen.getByText('Wynik gotowy do obejrzenia')).toBeInTheDocument();
    expect(screen.queryByText(/LuckyWinner/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ticket #7/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Przejdź do losowania/i }));

    expect(onOpenDraw).toHaveBeenCalledWith('pool-1');
  });

  it('opens the rollover settlement for a participated round without enough players', () => {
    const onOpenDraw = vi.fn();

    render(
      <DailyJackpotCard
        snapshot={{
          ...snapshot,
          status: 'rolled_over',
          currentUserHasTicket: true,
          currentUserTicketCount: 1,
          currentUserTicketNumber: 12,
          currentUserTicketNumbers: [12],
        }}
        loading={false}
        buying={false}
        balance={150}
        onBuy={vi.fn()}
        onOpenDraw={onOpenDraw}
      />,
    );

    expect(screen.getByText('Pula przechodzi dalej')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Za mało uczestników. Ticket zwrócony, pula przechodzi na jutro.',
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Zobacz rozliczenie/i }));

    expect(onOpenDraw).toHaveBeenCalledWith('pool-1');
  });

  it('allows buying a second ticket when the player has one ticket', () => {
    const onBuy = vi.fn();

    render(
      <DailyJackpotCard
        snapshot={{
          ...snapshot,
          currentUserHasTicket: true,
          currentUserTicketCount: 1,
          currentUserTicketNumber: 12,
          currentUserTicketNumbers: [12],
        }}
        loading={false}
        buying={false}
        balance={150}
        onBuy={onBuy}
      />,
    );

    expect(screen.getByText('Masz 1/2 ticketów')).toBeInTheDocument();
    expect(screen.getByText('#12')).toBeInTheDocument();
    expect(screen.queryByText('1 / 2')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Kup drugi ticket/i }));

    expect(onBuy).toHaveBeenCalledTimes(1);
  });

  it('disables buying after two tickets', () => {
    render(
      <DailyJackpotCard
        snapshot={{
          ...snapshot,
          currentUserHasTicket: true,
          currentUserTicketCount: 2,
          currentUserTicketNumber: 12,
          currentUserTicketNumbers: [12, 18],
        }}
        loading={false}
        buying={false}
        balance={150}
        onBuy={vi.fn()}
      />,
    );

    expect(screen.getByText('Limit ticketów 2/2')).toBeInTheDocument();
    expect(screen.getByText('#12 #18')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Limit ticketów/i })).toBeDisabled();
  });

  it('keeps finished public state spoiler-free for non participants', () => {
    render(
      <DailyJackpotCard
        snapshot={{
          ...snapshot,
          status: 'drawn',
          currentUserHasTicket: false,
          currentUserTicketCount: 0,
          winnerUsername: 'LuckyFox',
          winningTicketNumber: 7,
        }}
        loading={false}
        buying={false}
        balance={50}
        onBuy={vi.fn()}
      />,
    );

    expect(screen.getByText('Losowanie zakończone')).toBeInTheDocument();
    expect(screen.queryByText('Wygrał LuckyFox')).not.toBeInTheDocument();
    expect(screen.queryByText('Ticket #7')).not.toBeInTheDocument();
  });
});
