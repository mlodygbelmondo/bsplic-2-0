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

  it('explains badge requirements without hover and exposes unlocked status accessibly', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'badges') {
        return {
          select: () => ({
            eq: async () => ({
              data: [{
                user_id: 'current-user-id',
                badge_key: 'debiutant',
                unlocked_at: '2026-05-01T00:00:00.000Z',
              }],
            }),
          }),
        };
      }

      return {
        select: () => ({
          order: async () => ({ data: [] }),
        }),
      };
    });

    render(
      <MemoryRouter initialEntries={['/profile/current-user-id']}>
        <Routes>
          <Route path="/profile/:userId" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>,
    );

    const badgesSection = await screen.findByRole('region', { name: 'Odznaki' });
    const debutantBadge = within(badgesSection).getByRole('listitem', { name: /Debiutant/i });

    expect(within(debutantBadge).getByText('Pierwszy postawiony zakład')).toBeInTheDocument();
    expect(within(debutantBadge).getByText('Odblokowano: 01.05.2026')).toBeInTheDocument();
    expect(within(debutantBadge).getByRole('img', { name: 'Odznaka Debiutant' })).toHaveAttribute(
      'src',
      '/badges/debiutant.png',
    );

    const lockedBadge = within(badgesSection).getByRole('listitem', { name: /Trafiony zakład/i });
    expect(within(lockedBadge).getByText('Pierwszy wygrany zakład')).toBeInTheDocument();
    expect(within(lockedBadge).getByText('Nieodblokowana')).toBeInTheDocument();
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
    window.history.pushState({}, '', '/profile/tester?utm_source=test#secret-fragment');
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
        url: `${window.location.origin}/profile/tester`,
      }));
      expect(toastSuccessMock).toHaveBeenCalledWith('Profil udostępniony');
    });
  });

  it('copies the current profile URL when native browser sharing is unavailable', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    window.history.pushState({}, '', '/profile/tester?utm_source=test#secret-fragment');
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
      expect(writeTextMock).toHaveBeenCalledWith(`${window.location.origin}/profile/tester`);
      expect(toastSuccessMock).toHaveBeenCalledWith('Link do profilu skopiowany');
    });
  });

  it('does not show an error when the user closes the native share dialog', async () => {
    const shareMock = vi.fn().mockRejectedValue(new DOMException('Share cancelled', 'AbortError'));
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
      expect(shareMock).toHaveBeenCalledTimes(1);
    });
    expect(toastErrorMock).not.toHaveBeenCalled();
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

  it('loads sportsbook history in 30-item batches and can collapse back to the first 10 items', async () => {
    const couponHistory = Array.from({ length: 75 }, (_, index) => ({
      id: `coupon-${index + 1}`,
      status: 'won',
      stake: 10,
      payout: 20,
      total_odds: 2,
      legs: [{
        id: `leg-${index + 1}`,
        bet_title: `Zakład ${index + 1}`,
        selected_option: 'Opcja',
        odds_at_time: 2,
        result: 'won',
        leg_payout: 20,
      }],
    }));

    const casinoHistory = Array.from({ length: 41 }, (_, index) => ({
      id: `casino-${index + 1}`,
      game_type: 'Ruletka',
      bet_label: `Bet ${index + 1}`,
      stake: 20,
      payout: 40,
      status: 'won',
      round_label: `#${index + 1}`,
      created_at: '2026-01-02T00:00:00.000Z',
    }));

    rpcMock.mockImplementation((fn: string, args?: { p_limit?: number; p_offset?: number }) => {
      if (fn === 'get_user_coupon_history') {
        const offset = args?.p_offset ?? 0;
        const limit = args?.p_limit ?? couponHistory.length;
        return Promise.resolve({ data: couponHistory.slice(offset, offset + limit) });
      }
      if (fn === 'get_user_casino_history') {
        const offset = args?.p_offset ?? 0;
        const limit = args?.p_limit ?? casinoHistory.length;
        return Promise.resolve({ data: casinoHistory.slice(offset, offset + limit) });
      }
      if (fn === 'get_user_rankings') return Promise.resolve({ data: [] });
      return Promise.resolve({ data: null });
    });

    render(
      <MemoryRouter initialEntries={['/profile/current-user-id']}>
        <Routes>
          <Route path="/profile/:userId" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Zakład 1')).toBeInTheDocument();
    expect(screen.getByText('Zakład 10')).toBeInTheDocument();
    expect(screen.queryByText('Zakład 11')).not.toBeInTheDocument();
    expect(rpcMock).toHaveBeenCalledWith('get_user_coupon_history', {
      p_user_id: 'current-user-id',
      p_limit: 11,
      p_offset: 0,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Pokaż więcej' }));

    expect(await screen.findByText('Zakład 40')).toBeInTheDocument();
    expect(rpcMock).toHaveBeenCalledWith('get_user_coupon_history', {
      p_user_id: 'current-user-id',
      p_limit: 31,
      p_offset: 10,
    });
    expect(screen.getAllByRole('button', { name: 'Pokaż mniej' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Pokaż więcej' })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Pokaż więcej' }));
    expect(await screen.findByText('Zakład 70')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pokaż więcej' }));
    expect(await screen.findByText('Zakład 75')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pokaż więcej' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pokaż mniej' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pokaż mniej' }));

    await waitFor(() => {
      expect(screen.queryByText('Zakład 11')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Pokaż więcej' })).toBeInTheDocument();

    const sportsbookHistoryRequestCount = rpcMock.mock.calls.filter(([fn]) => fn === 'get_user_coupon_history').length;

    fireEvent.click(screen.getByRole('button', { name: 'Pokaż więcej' }));

    expect(await screen.findByText('Zakład 75')).toBeInTheDocument();
    expect(rpcMock.mock.calls.filter(([fn]) => fn === 'get_user_coupon_history')).toHaveLength(sportsbookHistoryRequestCount);
  });

  it('keeps casino history batching independent from sportsbook history', async () => {
    const casinoEntries = Array.from({ length: 41 }, (_, index) => ({
      id: `casino-${index + 1}`,
      game_type: 'Ruletka',
      bet_label: `Bet ${index + 1}`,
      stake: 20,
      payout: 40,
      status: 'won',
      round_label: `#${index + 1}`,
      created_at: '2026-01-02T00:00:00.000Z',
    }));

    rpcMock.mockImplementation((fn: string, args?: { p_limit?: number; p_offset?: number }) => {
      if (fn === 'get_user_coupon_history') return Promise.resolve({ data: [] });
      if (fn === 'get_user_casino_history') {
        const offset = args?.p_offset ?? 0;
        const limit = args?.p_limit ?? casinoEntries.length;
        return Promise.resolve({ data: casinoEntries.slice(offset, offset + limit) });
      }
      if (fn === 'get_user_rankings') return Promise.resolve({ data: [] });
      return Promise.resolve({ data: null });
    });

    render(
      <MemoryRouter initialEntries={['/profile/current-user-id']}>
        <Routes>
          <Route path="/profile/:userId" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Kasyno' }));

    expect(await screen.findByText('Bet 1')).toBeInTheDocument();
    expect(screen.queryByText('Bet 11')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pokaż więcej' }));

    expect(await screen.findByText('Bet 40')).toBeInTheDocument();
    expect(rpcMock).toHaveBeenCalledWith('get_user_casino_history', {
      p_user_id: 'current-user-id',
      p_limit: 31,
      p_offset: 10,
    });
    expect(screen.getByRole('button', { name: 'Pokaż mniej' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pokaż więcej' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pokaż mniej' }));
    expect(screen.queryByText('Bet 11')).not.toBeInTheDocument();

    const casinoHistoryRequestCount = rpcMock.mock.calls.filter(([fn]) => fn === 'get_user_casino_history').length;

    fireEvent.click(screen.getByRole('button', { name: 'Pokaż więcej' }));

    expect(await screen.findByText('Bet 40')).toBeInTheDocument();
    expect(rpcMock.mock.calls.filter(([fn]) => fn === 'get_user_casino_history')).toHaveLength(casinoHistoryRequestCount);
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

  it('shows explicit errors when the initial history requests fail', async () => {
    const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      rpcMock.mockImplementation((fn: string) => {
        if (fn === 'get_user_coupon_history') {
          return Promise.resolve({ data: null, error: new Error('coupon history failed') });
        }
        if (fn === 'get_user_casino_history') {
          return Promise.resolve({ data: null, error: new Error('casino history failed') });
        }
        if (fn === 'get_user_rankings') return Promise.resolve({ data: [] });
        return Promise.resolve({ data: null });
      });

      render(
        <MemoryRouter initialEntries={['/profile/current-user-id']}>
          <Routes>
            <Route path="/profile/:userId" element={<ProfilePage />} />
          </Routes>
        </MemoryRouter>,
      );

      expect(await screen.findByText('Nie udało się załadować historii zakładów')).toBeInTheDocument();
      expect(screen.queryByText('Brak zakładów')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Kasyno' }));

      expect(await screen.findByText('Nie udało się załadować historii kasyna')).toBeInTheDocument();
      expect(screen.queryByText('Brak betów z kasyna')).not.toBeInTheDocument();
    } finally {
      consoleErrorMock.mockRestore();
    }
  });
});
