import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CouponDrawer } from './CouponDrawer';

const createCouponItem = (id: string, title = `Bet ${id}`) => ({
  bet: {
    id,
    title,
    category_id: null,
    bet_type: '12' as const,
    options: [],
    ends_at: '2030-01-01T12:00:00.000Z',
    is_live: false,
    is_active: true,
    winning_option: null,
    bet_count: 0,
    created_at: '2030-01-01T10:00:00.000Z',
  },
  selectedOption: 'Legia',
  odds: 2,
});

const couponMock = vi.hoisted(() => ({
  items: [
    {
      bet: {
        id: 'bet-1',
        title: 'Legia vs Lech',
        category_id: null,
        bet_type: '12',
        options: [],
        ends_at: '2030-01-01T12:00:00.000Z',
        is_live: false,
        is_active: true,
        winning_option: null,
        bet_count: 0,
        created_at: '2030-01-01T10:00:00.000Z',
      },
      selectedOption: 'Legia',
      odds: 2,
    },
  ],
  addItems: vi.fn(),
  removeItem: vi.fn(),
  clearCoupon: vi.fn(),
  preferredCouponType: null,
  setPreferredCouponType: vi.fn(),
}));

const fetchAkoExclusionsForBetsMock = vi.hoisted(() => vi.fn());

vi.mock('@/contexts/CouponContext', () => ({
  useCoupon: () => couponMock,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    profile: {
      balance: 100,
    },
  }),
}));

vi.mock('@/features/home/hooks/useCouponPlacement', () => ({
  useCouponPlacement: () => ({
    placing: false,
    placeBet: vi.fn(),
    potentialWin: 20,
    effectiveTotalOdds: 2,
    totalStake: 10,
  }),
}));

vi.mock('@/features/coupons/akoExclusionApi', () => ({
  fetchAkoExclusionsForBets: (...args: unknown[]) =>
    fetchAkoExclusionsForBetsMock(...args),
}));

describe('CouponDrawer', () => {
  beforeEach(() => {
    couponMock.items = [createCouponItem('bet-1', 'Legia vs Lech')];
    couponMock.preferredCouponType = null;
    fetchAkoExclusionsForBetsMock.mockResolvedValue([]);
    vi.clearAllMocks();
  });

  it('lets users double the AKO stake with one tap', () => {
    render(<CouponDrawer categoryMap={{}} />);

    fireEvent.click(screen.getByRole('button', { name: 'AKO' }));
    fireEvent.click(screen.getByRole('button', { name: 'Podwój stawkę' }));

    expect(screen.getByPlaceholderText('Stawka (zł)')).toHaveValue(20);
  });

  it('positions the mobile trigger from the shared floating CTA stack offset', () => {
    render(<CouponDrawer categoryMap={{}} />);

    expect(screen.getByRole('button', { name: 'Otwórz kupon' })).toHaveClass(
      'bottom-[calc(1rem+var(--mobile-floating-stack-offset,4.75rem)+env(safe-area-inset-bottom))]',
      'transition-[bottom,background-color,color,border-color,box-shadow,transform]',
    );
  });

  it('blocks AKO submission when selected bets have an exclusion pair', async () => {
    couponMock.items = [
      createCouponItem('bet-1', 'Team X wygra mapę 1'),
      createCouponItem('bet-2', 'Team X wygra mecz'),
    ];
    fetchAkoExclusionsForBetsMock.mockResolvedValue([
      { betIdA: 'bet-1', betIdB: 'bet-2', reason: 'Ten sam mecz' },
    ]);

    render(<CouponDrawer categoryMap={{}} />);

    fireEvent.click(screen.getByRole('button', { name: 'AKO' }));

    expect(
      await screen.findByText(
        /Tych zdarzeń nie można łączyć na AKO: Team X wygra mapę 1 \+ Team X wygra mecz/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Powód: Ten sam mecz/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Obstaw' })).toBeDisabled();
  });

  it('keeps singles submittable when selected bets have an AKO exclusion pair', async () => {
    couponMock.items = [
      createCouponItem('bet-1', 'Team X wygra mapę 1'),
      createCouponItem('bet-2', 'Team X wygra mecz'),
    ];
    fetchAkoExclusionsForBetsMock.mockResolvedValue([
      { betIdA: 'bet-1', betIdB: 'bet-2', reason: null },
    ]);

    render(<CouponDrawer categoryMap={{}} />);

    await screen.findByText(/Team X wygra mapę 1/);

    expect(
      screen.queryByText(/Tych zdarzeń nie można łączyć na AKO/i),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Obstaw' })).toBeEnabled();
  });
});
