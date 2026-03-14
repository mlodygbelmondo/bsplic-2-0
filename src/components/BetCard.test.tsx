import { render, screen } from '@testing-library/react';

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
});
