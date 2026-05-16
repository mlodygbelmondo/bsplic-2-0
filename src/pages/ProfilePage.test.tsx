import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProfilePage from '@/pages/ProfilePage';

const rpcMock = vi.fn();
const fromMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

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
      current_streak: 4,
      longest_streak: 5,
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

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

describe('ProfilePage username route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, '', '/');
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });

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
        return Promise.resolve({ data: [] });
      }
      if (fn === 'get_user_casino_history') {
        return Promise.resolve({
          data: [
            {
              id: 'casino-1',
              game_type: 'Ruletka',
              bet_label: 'Kolor: czerwone',
              stake: 20,
              payout: 40,
              status: 'won',
              round_label: '#123',
              created_at: '2026-01-02T00:00:00.000Z',
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

    expect(await screen.findByText('tester')).toBeInTheDocument();
  });

  it('renders the player card hero on own profiles and removes legacy stat presentation', async () => {
    rpcMock.mockImplementation((fn: string) => {
      if (fn === 'get_user_coupon_history') return Promise.resolve({ data: [] });
      if (fn === 'get_user_casino_history') return Promise.resolve({ data: [] });
      if (fn === 'get_user_rankings') {
        return Promise.resolve({
          data: [{
            id: 'current-user-id',
            total_bets: 12,
            won_bets: 7,
            lost_bets: 5,
            win_rate: 58.3,
            total_profit: 146.5,
          }],
        });
      }
      return Promise.resolve({ data: null });
    });

    render(
      <MemoryRouter initialEntries={['/profile/current-user-id']}>
        <Routes>
          <Route path="/profile/:userId" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>,
    );

    const hero = await screen.findByRole('region', { name: 'Karta gracza' });

    expect(within(hero).getByText('Na plusie')).toBeInTheDocument();
    expect(within(hero).getByText('Zysk')).toBeInTheDocument();
    expect(within(hero).getByText('+146.50 zł')).toBeInTheDocument();
    expect(within(hero).getByText('Win rate')).toBeInTheDocument();
    expect(within(hero).getByText('58.3%')).toBeInTheDocument();
    expect(within(hero).getByText('Seria')).toBeInTheDocument();
    expect(within(hero).getByText('4')).toBeInTheDocument();
    expect(within(hero).getByText('Kupony')).toBeInTheDocument();
    expect(within(hero).getByText('12')).toBeInTheDocument();
    expect(within(hero).getByText('Wygrane')).toBeInTheDocument();
    expect(within(hero).getByText('7')).toBeInTheDocument();
    expect(screen.getAllByText('Przegrane')).toHaveLength(1);
    expect(screen.queryByText('Profit')).not.toBeInTheDocument();
    expect(screen.queryByText('Najdłuższa seria: 5 dni')).not.toBeInTheDocument();
  });

  it('renders the player card hero on public profiles from public sportsbook stats', async () => {
    rpcMock.mockImplementation((fn: string) => {
      if (fn === 'get_user_coupon_history') return Promise.resolve({ data: [] });
      if (fn === 'get_user_casino_history') return Promise.resolve({ data: [] });
      if (fn === 'get_public_profile') {
        return Promise.resolve({
          data: {
            id: 'user-123',
            username: 'tester',
            current_streak: 1,
            longest_streak: 3,
            created_at: '2026-01-01T00:00:00.000Z',
            total_bets: 25,
            won_bets: 11,
            lost_bets: 14,
            win_rate: 44,
            total_profit: -12,
          },
        });
      }
      return Promise.resolve({ data: null });
    });

    render(
      <MemoryRouter initialEntries={['/profile/tester']}>
        <Routes>
          <Route path="/profile/:userId" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>,
    );

    const hero = await screen.findByRole('region', { name: 'Karta gracza' });

    expect(within(hero).getByText('Weteran kuponów')).toBeInTheDocument();
    expect(within(hero).getByText('-12.00 zł')).toBeInTheDocument();
    expect(within(hero).getByText('44.0%')).toBeInTheDocument();
    expect(within(hero).getByText('1')).toBeInTheDocument();
    expect(within(hero).getByText('25')).toBeInTheDocument();
    expect(within(hero).getByText('11')).toBeInTheDocument();
    expect(screen.getAllByText('Przegrane')).toHaveLength(1);
    expect(screen.queryByText('Profit')).not.toBeInTheDocument();
    expect(screen.queryByText('Najdłuższa seria: 3 dni')).not.toBeInTheDocument();
  });

  it('shares the current profile URL with the native browser share flow when available', async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    window.history.pushState({}, '', '/profile/tester');
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: shareMock,
    });

    render(
      <MemoryRouter initialEntries={['/profile/tester']}>
        <Routes>
          <Route path="/profile/:userId" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>,
    );

    const hero = await screen.findByRole('region', { name: 'Karta gracza' });
    fireEvent.click(within(hero).getByRole('button', { name: 'Udostępnij profil' }));

    await waitFor(() => {
      expect(shareMock).toHaveBeenCalledWith(expect.objectContaining({
        url: window.location.href,
      }));
      expect(toastSuccessMock).toHaveBeenCalledWith('Profil udostępniony');
    });
  });

  it('copies the current profile URL when native browser sharing is unavailable', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    window.history.pushState({}, '', '/profile/tester');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: writeTextMock,
      },
    });

    render(
      <MemoryRouter initialEntries={['/profile/tester']}>
        <Routes>
          <Route path="/profile/:userId" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>,
    );

    const hero = await screen.findByRole('region', { name: 'Karta gracza' });
    fireEvent.click(within(hero).getByRole('button', { name: 'Udostępnij profil' }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(window.location.href);
      expect(toastSuccessMock).toHaveBeenCalledWith('Link do profilu skopiowany');
    });
  });

  it('shows an error when native browser sharing fails', async () => {
    const shareMock = vi.fn().mockRejectedValue(new Error('share failed'));
    window.history.pushState({}, '', '/profile/tester');
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: shareMock,
    });

    render(
      <MemoryRouter initialEntries={['/profile/tester']}>
        <Routes>
          <Route path="/profile/:userId" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>,
    );

    const hero = await screen.findByRole('region', { name: 'Karta gracza' });
    fireEvent.click(within(hero).getByRole('button', { name: 'Udostępnij profil' }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Nie udało się udostępnić profilu');
    });
  });

  it('shows an error when copying the profile URL fails', async () => {
    const writeTextMock = vi.fn().mockRejectedValue(new Error('copy failed'));
    window.history.pushState({}, '', '/profile/tester');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: writeTextMock,
      },
    });

    render(
      <MemoryRouter initialEntries={['/profile/tester']}>
        <Routes>
          <Route path="/profile/:userId" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>,
    );

    const hero = await screen.findByRole('region', { name: 'Karta gracza' });
    fireEvent.click(within(hero).getByRole('button', { name: 'Udostępnij profil' }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Nie udało się skopiować linku do profilu');
    });
  });

  it('switches profile history between sportsbook coupons and casino bets', async () => {
    render(
      <MemoryRouter initialEntries={['/profile/current-user-id']}>
        <Routes>
          <Route path="/profile/:userId" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Historia' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zakłady' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Kasyno' }));

    expect(await screen.findByText('Ruletka')).toBeInTheDocument();
    expect(screen.getByText('Kolor: czerwone')).toBeInTheDocument();
    expect(screen.getByText('+40.00 zł')).toBeInTheDocument();
  });
});
