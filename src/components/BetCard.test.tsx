import { fireEvent, render, screen } from '@testing-library/react';

import { CouponProvider } from '@/contexts/CouponContext';
import { Bet } from '@/types/database';

import { BetCard } from './BetCard';

function createBet(overrides: Partial<Bet>): Bet {
  return {
    id: 'bet-1',
    title: 'Legia vs Lech',
    category_id: null,
    bet_type: '12',
    options: [
      { name: 'Legia', odds: 2.1 },
      { name: 'Lech', odds: 1.8 },
    ],
    ends_at: '2030-01-01T12:00:00.000Z',
    is_live: false,
    is_active: true,
    winning_option: null,
    bet_count: 10,
    created_at: '2030-01-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('BetCard', () => {
  it.each(['12', '1x2'] as const)('shows bet title for compact %s layout', (betType) => {
    const bet = createBet({
      bet_type: betType,
      options:
        betType === '1x2'
          ? [
              { name: 'Legia', odds: 2.1 },
              { name: 'X', odds: 3.2 },
              { name: 'Lech', odds: 1.8 },
            ]
          : [
              { name: 'Legia', odds: 2.1 },
              { name: 'Lech', odds: 1.8 },
            ],
    });

    render(
      <CouponProvider>
        <BetCard bet={bet} />
      </CouponProvider>,
    );

    expect(screen.getByText('Legia vs Lech')).toBeInTheDocument();
  });

  it('shows in-progress badge and keeps options disabled when event already started', () => {
    const bet = createBet({
      ends_at: new Date(Date.now() - 60_000).toISOString(),
      winning_option: null,
    });

    render(
      <CouponProvider>
        <BetCard bet={bet} />
      </CouponProvider>,
    );

    expect(screen.getByText('W trakcie')).toBeInTheDocument();
    expect(screen.getAllByRole('button').every((button) => button.hasAttribute('disabled'))).toBe(true);
  });

  it('hides in-progress badge for resolved events', () => {
    const bet = createBet({
      ends_at: new Date(Date.now() - 60_000).toISOString(),
      winning_option: 'Legia',
    });

    render(
      <CouponProvider>
        <BetCard bet={bet} />
      </CouponProvider>,
    );

    expect(screen.queryByText('W trakcie')).not.toBeInTheDocument();
  });

  it('hides in-progress badge for multi-winner resolved events (JSON array)', () => {
    const bet = createBet({
      ends_at: new Date(Date.now() - 60_000).toISOString(),
      winning_option: '["Legia","Lech"]',
    });

    render(
      <CouponProvider>
        <BetCard bet={bet} />
      </CouponProvider>,
    );

    expect(screen.queryByText('W trakcie')).not.toBeInTheDocument();
  });

  it('uses descriptive labels for odds buttons', () => {
    const bet = createBet({});

    render(
      <CouponProvider>
        <BetCard bet={bet} />
      </CouponProvider>,
    );

    const optionButton = screen.getByRole('button', {
      name: 'Legia vs Lech: wybierz Legia, kurs 2.10',
    });
    fireEvent.click(optionButton);

    expect(
      screen.getByRole('button', {
        name: 'Legia vs Lech: Legia wybrane, kurs 2.10',
      }),
    ).toBeInTheDocument();
  });
});
