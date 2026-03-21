import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProfilePage from '@/pages/ProfilePage';

const rpcMock = vi.fn();
const fromMock = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'current-user-id',
    },
    refreshProfile: vi.fn(),
    profile: {
      id: 'current-user-id',
      username: 'CurrentUser',
      balance: 100,
      current_streak: 1,
      longest_streak: 2,
      created_at: '2026-01-01T00:00:00.000Z',
      avatar_url: null,
    },
  }),
}));

vi.mock('@/components/Navbar', () => ({
  Navbar: () => <div>Navbar</div>,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

describe('ProfilePage username route', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    fromMock.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            ilike: () => ({
              limit: () => ({
                maybeSingle: async () => ({
                  data: { id: 'user-123' },
                }),
              }),
            }),
          }),
        };
      }

      if (table === 'badges') {
        return {
          select: () => ({
            eq: async () => ({ data: [] }),
          }),
        };
      }

      return {
        select: () => ({
          order: async () => ({ data: [] }),
        }),
      };
    });

    rpcMock.mockImplementation((fn: string) => {
      if (fn === 'get_user_coupon_history') {
        return Promise.resolve({
          data: [
            {
              id: 'coupon-asset',
              total_odds: 1,
              stake: 100,
              stake_asset_id: 'asset-1',
              stake_asset_symbol: 'TSLA',
              stake_asset_type: 'stock',
              stake_asset_quantity: 2,
              stake_asset_unit_price_pln: 50,
              stake_asset_fx_rate_to_pln: 1,
              payout: 0,
              status: 'pending',
              created_at: '2026-01-01T00:00:00.000Z',
              legs: [
                {
                  id: 'leg-1',
                  bet_id: 'bet-1',
                  selected_option: '1',
                  odds_at_time: 2,
                  leg_stake: 100,
                  leg_payout: 0,
                  result: 'pending',
                  bet_title: 'Test bet',
                },
              ],
            },
          ],
        });
      }
      if (fn === 'get_public_profile') {
        return Promise.resolve({
          data: {
            id: 'user-123',
            username: 'tester',
            current_streak: 0,
            longest_streak: 0,
            created_at: '2026-01-01T00:00:00.000Z',
            total_bets: 0,
            won_bets: 0,
            lost_bets: 0,
            win_rate: 0,
            total_profit: 0,
          },
        });
      }
      if (fn === 'get_user_rankings') {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: null });
    });
  });

  it('resolves username in route and loads public profile by id', async () => {
    render(
      <MemoryRouter initialEntries={['/profile/tester']}>
        <Routes>
          <Route path="/profile/:userId" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith('get_public_profile', {
        p_user_id: 'user-123',
      });
    });

    expect(screen.getByText('tester')).toBeInTheDocument();
    expect(screen.getByText('2 TSLA')).toBeInTheDocument();
    expect(screen.getByText('(100.00 zł)')).toBeInTheDocument();
  });
});
