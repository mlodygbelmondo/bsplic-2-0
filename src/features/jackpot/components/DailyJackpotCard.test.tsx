import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { DailyJackpotSnapshot } from '../types';

import { DailyJackpotCard } from './DailyJackpotCard';

const snapshot: DailyJackpotSnapshot = {
  poolId: 'pool-1',
  poolDate: '2026-06-17',
  status: 'collecting',
  prizeAmount: 125,
  ticketPrice: 5,
  minUniqueUsers: 3,
  participantCount: 2,
  ticketCount: 2,
  drawScheduledAt: '2026-06-17T18:00:00.000Z',
  currentUserHasTicket: false,
  currentUserTicketNumber: null,
  winnerUserId: null,
  winnerUsername: null,
  winnerAvatarUrl: null,
  winningTicketNumber: null,
  serverNow: '2026-06-17T10:00:00.000Z',
};

describe('DailyJackpotCard', () => {
  it('renders collecting state and buys a ticket', () => {
    const onBuy = vi.fn();

    render(
      <DailyJackpotCard
        snapshot={snapshot}
        loading={false}
        buying={false}
        balance={50}
        onBuy={onBuy}
      />,
    );

    expect(screen.getByText('Jackpot Dnia')).toBeInTheDocument();
    expect(screen.getByText('125,00 zł')).toBeInTheDocument();
    expect(screen.getByText('Losowanie dziś o 20:00')).toBeInTheDocument();
    expect(screen.getByText('2/3 graczy')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Kup ticket/i }));

    expect(onBuy).toHaveBeenCalledTimes(1);
  });

  it('shows owned ticket and disables buying', () => {
    render(
      <DailyJackpotCard
        snapshot={{
          ...snapshot,
          currentUserHasTicket: true,
          currentUserTicketNumber: 12,
        }}
        loading={false}
        buying={false}
        balance={50}
        onBuy={vi.fn()}
      />,
    );

    expect(screen.getByText('Masz ticket #12')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Masz ticket/i })).toBeDisabled();
  });

  it('renders drawn winner state', () => {
    render(
      <DailyJackpotCard
        snapshot={{
          ...snapshot,
          status: 'drawn',
          winnerUsername: 'LuckyFox',
          winningTicketNumber: 7,
        }}
        loading={false}
        buying={false}
        balance={50}
        onBuy={vi.fn()}
      />,
    );

    expect(screen.getByText('Wygrał LuckyFox')).toBeInTheDocument();
    expect(screen.getByText('Ticket #7')).toBeInTheDocument();
  });
});
