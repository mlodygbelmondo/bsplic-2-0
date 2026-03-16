import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SocialPage from './SocialPage';

const rpcMock = vi.fn();
const fetchBetsByIdsMock = vi.fn();
const addItemsMock = vi.fn();
const setPreferredCouponTypeMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const navigateMock = vi.fn();

vi.mock('@/components/Navbar', () => ({
  Navbar: () => <div>Navbar</div>,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

vi.mock('@/features/home/api/bets', () => ({
  fetchBetsByIds: (...args: unknown[]) => fetchBetsByIdsMock(...args),
}));

vi.mock('@/contexts/CouponContext', () => ({
  useCoupon: () => ({
    addItems: addItemsMock,
    setPreferredCouponType: setPreferredCouponTypeMock,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

describe('SocialPage coupon copy', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    rpcMock.mockResolvedValue({
      data: [
        {
          id: 'coupon-1',
          user_id: 'user-2',
          username: 'Typster',
          total_odds: 2.1,
          stake: 10,
          payout: 0,
          status: 'pending',
          created_at: '2030-01-01T10:00:00.000Z',
          legs: [
            {
              id: 'leg-1',
              bet_id: 'bet-1',
              selected_option: 'Dom',
              odds_at_time: 2.0,
              result: 'pending',
              bet_title: 'Mecz dnia',
            },
          ],
        },
      ],
    });

    fetchBetsByIdsMock.mockResolvedValue([
      {
        id: 'bet-1',
        title: 'Mecz dnia',
        category_id: 'cat-1',
        bet_type: '12',
        options: [
          { name: 'Dom', odds: 2.2 },
          { name: 'Wyjazd', odds: 1.7 },
        ],
        ends_at: '2030-01-01T12:00:00.000Z',
        is_live: false,
        is_active: true,
        winning_option: null,
        bet_count: 0,
        created_at: '2030-01-01T09:00:00.000Z',
      },
    ]);
  });

  it('copies coupon and redirects user to home page', async () => {
    render(
      <MemoryRouter>
        <SocialPage />
      </MemoryRouter>
    );

    const copyButton = await screen.findByRole('button', { name: 'Skopiuj Kupon' });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(fetchBetsByIdsMock).toHaveBeenCalledWith(['bet-1']);
      expect(addItemsMock).toHaveBeenCalledTimes(1);
      expect(setPreferredCouponTypeMock).toHaveBeenCalledWith('single');
      expect(navigateMock).toHaveBeenCalledWith('/');
    });
  });

  it('sets preferred coupon type to ako for multi-leg copied coupon', async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          id: 'coupon-ako',
          user_id: 'user-3',
          username: 'Multi',
          total_odds: 4.2,
          stake: 20,
          payout: 0,
          status: 'pending',
          created_at: '2030-01-01T10:00:00.000Z',
          legs: [
            {
              id: 'leg-1',
              bet_id: 'bet-1',
              selected_option: 'Dom',
              odds_at_time: 2.0,
              result: 'pending',
              bet_title: 'Mecz 1',
            },
            {
              id: 'leg-2',
              bet_id: 'bet-2',
              selected_option: 'Gość',
              odds_at_time: 2.1,
              result: 'pending',
              bet_title: 'Mecz 2',
            },
          ],
        },
      ],
    });

    fetchBetsByIdsMock.mockResolvedValueOnce([
      {
        id: 'bet-1',
        title: 'Mecz 1',
        category_id: 'cat-1',
        bet_type: '12',
        options: [
          { name: 'Dom', odds: 2.2 },
          { name: 'Gość', odds: 1.7 },
        ],
        ends_at: '2030-01-01T12:00:00.000Z',
        is_live: false,
        is_active: true,
        winning_option: null,
        bet_count: 0,
        created_at: '2030-01-01T09:00:00.000Z',
      },
      {
        id: 'bet-2',
        title: 'Mecz 2',
        category_id: 'cat-2',
        bet_type: '12',
        options: [
          { name: 'Dom', odds: 1.8 },
          { name: 'Gość', odds: 2.3 },
        ],
        ends_at: '2030-01-01T13:00:00.000Z',
        is_live: false,
        is_active: true,
        winning_option: null,
        bet_count: 0,
        created_at: '2030-01-01T09:05:00.000Z',
      },
    ]);

    render(
      <MemoryRouter>
        <SocialPage />
      </MemoryRouter>
    );

    const copyButton = await screen.findByRole('button', { name: 'Skopiuj Kupon' });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(setPreferredCouponTypeMock).toHaveBeenCalledWith('ako');
    });
  });
});
