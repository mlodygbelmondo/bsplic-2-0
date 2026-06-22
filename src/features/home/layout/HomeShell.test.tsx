import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HomeShell } from './HomeShell';

const dailyJackpotCardMock = vi.hoisted(() => vi.fn());
const useDailyJackpotMock = vi.hoisted(() =>
  vi.fn(() => ({
    snapshot: { poolId: 'pool-1' },
    loading: false,
    buying: false,
    balance: 500,
    buyTicket: vi.fn(),
  })),
);

vi.mock('@/components/CategorySidebar', () => ({
  CategorySidebar: () => <aside data-testid="category-sidebar" />,
}));

vi.mock('@/components/CouponDrawer', () => ({
  CouponDrawer: () => <aside data-testid="coupon-drawer" />,
}));

vi.mock('@/components/BetList', () => ({
  BetList: (props: { topBanner?: ReactNode }) => (
    <div data-testid="bet-list">{props.topBanner}</div>
  ),
}));

vi.mock('@/features/jackpot/hooks/useDailyJackpot', () => ({
  useDailyJackpot: () => useDailyJackpotMock(),
}));

vi.mock('@/features/jackpot/components/DailyJackpotCard', () => ({
  DailyJackpotCard: (props: unknown) => {
    dailyJackpotCardMock(props);
    return <section data-testid="daily-jackpot-card" />;
  },
}));

describe('HomeShell jackpot banner composition', () => {
  beforeEach(() => {
    dailyJackpotCardMock.mockClear();
    useDailyJackpotMock.mockClear();
  });

  it('owns jackpot loading and renders the card through the BetList banner slot', () => {
    const { container } = render(
      <HomeShell
        selectedCategory={null}
        onSelectCategory={vi.fn()}
        onOpenProposeModal={vi.fn()}
        categories={[]}
        categoryMap={{}}
        categoriesLoading={false}
      />,
    );

    expect(screen.getByTestId('daily-jackpot-card')).toBeInTheDocument();
    expect(container.querySelector('.max-w-\\[1600px\\]')).toHaveClass(
      'pt-2',
      'lg:py-3',
    );
    expect(useDailyJackpotMock).toHaveBeenCalledTimes(1);
    expect(dailyJackpotCardMock).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshot: { poolId: 'pool-1' },
        loading: false,
        buying: false,
        balance: 500,
        onBuy: expect.any(Function),
      }),
    );
  });
});
