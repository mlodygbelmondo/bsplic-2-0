import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RouletteGame } from './RouletteGame';

const useRouletteTableMock = vi.fn();
const useIsMobileMock = vi.fn(() => false);
const createCasinoShareMock = vi.fn();
const getStoredRouletteBetTypeMock = vi.fn();
const storeRouletteBetTypeMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('@/features/casino/hooks/useRouletteTable', () => ({
  useRouletteTable: (...args: unknown[]) => useRouletteTableMock(...args),
}));

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => useIsMobileMock(),
}));

vi.mock('@/features/social/api/social', () => ({
  createCasinoShare: (...args: unknown[]) => createCasinoShareMock(...args),
}));

vi.mock('@/features/casino/lib/preferences', () => ({
  getStoredRouletteBetType: () => getStoredRouletteBetTypeMock(),
  storeRouletteBetType: (...args: unknown[]) =>
    storeRouletteBetTypeMock(...args),
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

// Mock canvas-confetti to avoid errors in jsdom
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

describe('RouletteGame', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getStoredRouletteBetTypeMock.mockReturnValue(null);
    useIsMobileMock.mockReturnValue(false);
    createCasinoShareMock.mockResolvedValue('casino-share-1');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const baseTableMock = {
    userId: 'user-1',
    phase: 'waiting' as const,
    countdownLabel: '00:15',
    countdownMs: 15000,
    currentRound: {
      id: 'round-1',
      phase: 'waiting' as const,
      betting_closes_at: '2026-04-17T12:00:15.000Z',
      betting_opens_at: '2026-04-17T12:00:00.000Z',
      round_number: 123,
    },
    recentSpins: [],
    recentWins: [],
    activeBets: [],
    roundParticipants: [],
    latestSettledRound: null,
    isLoading: false,
    isPlacingBet: false,
    isRefreshing: false,
    tableMessage: null,
    placeBet: vi.fn(),
    refresh: vi.fn(),
  };

  it('shows validation error before placing a shared-table bet', async () => {
    useRouletteTableMock.mockReturnValue(baseTableMock);

    render(
      <RouletteGame
        userId="user-1"
        username="Tester"
        avatarUrl="https://cdn.example/tester.jpg"
        balance={100}
        refreshProfile={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Postaw' }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        'Wybierz poprawną wartość zakładu',
      );
    });
  });

  it('places a shared-table bet and shows accepted state', async () => {
    const placeBetMock = vi.fn().mockResolvedValue(undefined);

    useRouletteTableMock.mockReturnValue({
      ...baseTableMock,
      recentSpins: [
        {
          id: 'settled-1',
          round_number: 121,
          winning_number: 7,
          winning_color: 'red' as const,
          settled_at: '2026-04-17T11:59:40.000Z',
        },
      ],
      recentWins: [
        {
          id: 'win-1',
          round_id: 'round-previous',
          user_id: 'user-2',
          username: 'LuckyFox',
          avatar_url: null,
          bet_type: 'color' as const,
          bet_value: 'red',
          payout: 40,
          stake: 20,
          is_win: true,
          round_number: 121,
          created_at: '2026-04-17T11:59:40.000Z',
          settled_at: '2026-04-17T11:59:40.000Z',
        },
      ],
      activeBets: [
        {
          id: 'bet-1',
          round_id: 'round-1',
          bet_type: 'color' as const,
          bet_value: 'red',
          stake: 20,
          payout: 0,
          is_win: null,
          created_at: '2026-04-17T12:00:04.000Z',
        },
      ],
      latestSettledRound: {
        id: 'settled-1',
        round_number: 121,
        winning_number: 7,
        winning_color: 'red' as const,
        settled_at: '2026-04-17T11:59:40.000Z',
      },
      placeBet: placeBetMock,
    });

    render(
      <RouletteGame
        userId="user-1"
        username="Tester"
        avatarUrl="https://cdn.example/tester.jpg"
        balance={100}
        refreshProfile={vi.fn()}
      />,
    );

    // Select bet type
    fireEvent.click(screen.getByRole('button', { name: /Kolor x2/i }));
    // Select bet value
    fireEvent.click(await screen.findByRole('button', { name: 'Czerwone' }));
    // Set stake
    fireEvent.change(screen.getByRole('spinbutton'), {
      target: { value: '20' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Postaw' }));

    await waitFor(() => {
      expect(placeBetMock).toHaveBeenCalledWith({
        betType: 'color',
        betValue: 'red',
        stake: 20,
      });
    });

    expect(toastSuccessMock).toHaveBeenCalledWith(
      'Zakład przyjęty do wspólnej rundy!',
    );
    expect(screen.getAllByText(/121/).length).toBeGreaterThan(0);
    expect(screen.getByText('LuckyFox')).toBeInTheDocument();
  });

  it('lets the first player place a bet while the shared table is idle', async () => {
    const placeBetMock = vi.fn().mockResolvedValue(undefined);

    useRouletteTableMock.mockReturnValue({
      ...baseTableMock,
      currentRound: null,
      countdownLabel: '00:00',
      countdownMs: 0,
      placeBet: placeBetMock,
    });

    render(
      <RouletteGame
        userId="user-1"
        username="Tester"
        avatarUrl="https://cdn.example/tester.jpg"
        balance={100}
        refreshProfile={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Kolor x2/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Czerwone' }));
    fireEvent.change(screen.getByRole('spinbutton'), {
      target: { value: '20' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Postaw' }));

    await waitFor(() => {
      expect(placeBetMock).toHaveBeenCalledWith({
        betType: 'color',
        betValue: 'red',
        stake: 20,
      });
    });
  });

  it('lets the player choose a quick stake before placing a bet', () => {
    useRouletteTableMock.mockReturnValue(baseTableMock);

    render(
      <RouletteGame
        userId="user-1"
        username="Tester"
        avatarUrl="https://cdn.example/tester.jpg"
        balance={100}
        refreshProfile={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '50' }));

    expect(screen.getByRole('spinbutton')).toHaveValue(50);
  });

  it('lets the desktop stake bar be hidden and reopened', async () => {
    useRouletteTableMock.mockReturnValue(baseTableMock);

    render(
      <RouletteGame userId="user-1" balance={100} refreshProfile={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Schowaj stawkę' }));

    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Postaw' }),
      ).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^Pokaż stawkę/ }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Postaw' }),
      ).toBeInTheDocument();
    });
  });

  it('disables betting controls once the wheel is spinning', () => {
    useRouletteTableMock.mockReturnValue({
      ...baseTableMock,
      phase: 'spinning',
      countdownLabel: '00:05',
      countdownMs: 5000,
      currentRound: {
        id: 'round-2',
        phase: 'spinning' as const,
        round_number: 124,
        betting_closes_at: '2026-04-17T12:00:15.000Z',
        betting_opens_at: '2026-04-17T12:00:00.000Z',
        spin_started_at: '2026-04-17T12:00:15.000Z',
        winning_number: 13,
        winning_color: 'black' as const,
      },
    });

    render(
      <RouletteGame userId="user-1" balance={100} refreshProfile={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: 'Postaw' })).toBeDisabled();
  });

  it('does not render a separate lower status bar container', () => {
    useRouletteTableMock.mockReturnValue({
      ...baseTableMock,
      currentRound: {
        id: 'round-3',
        phase: 'waiting' as const,
        round_number: 125,
        betting_closes_at: '2026-04-17T12:00:15.000Z',
        betting_opens_at: '2026-04-17T12:00:00.000Z',
      },
    });

    render(
      <RouletteGame userId="user-1" balance={100} refreshProfile={vi.fn()} />,
    );

    expect(screen.queryByText('Do spinu')).not.toBeInTheDocument();
    expect(screen.queryByText('00:15')).not.toBeInTheDocument();
    expect(screen.queryByText('LIVE')).not.toBeInTheDocument();
    expect(screen.queryByText('Przyjmowanie zakładów')).not.toBeInTheDocument();
  });

  it('does not render a separate active bets container', () => {
    useRouletteTableMock.mockReturnValue({
      ...baseTableMock,
      phase: 'settled',
      currentRound: {
        ...baseTableMock.currentRound,
        phase: 'settled' as const,
      },
      activeBets: [
        {
          id: 'bet-win',
          round_id: 'round-1',
          bet_type: 'color' as const,
          bet_value: 'red',
          stake: 20,
          payout: 40,
          is_win: true,
          created_at: '2026-04-17T12:00:04.000Z',
        },
        {
          id: 'bet-loss',
          round_id: 'round-1',
          bet_type: 'straight' as const,
          bet_value: '7',
          stake: 10,
          payout: 0,
          is_win: false,
          created_at: '2026-04-17T12:00:04.000Z',
        },
      ],
    });

    render(
      <RouletteGame userId="user-1" balance={100} refreshProfile={vi.fn()} />,
    );

    expect(screen.queryByText('Twoje zakłady')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Brak aktywnych zakładów'),
    ).not.toBeInTheDocument();
  });

  it('keeps recent spins and round participants in the desktop left rail above recent wins', () => {
    useRouletteTableMock.mockReturnValue({
      ...baseTableMock,
      recentSpins: [
        {
          id: 'settled-1',
          table_key: 'main',
          round_number: 121,
          phase: 'settled' as const,
          betting_closes_at: '2026-04-17T12:00:15.000Z',
          betting_opens_at: '2026-04-17T12:00:00.000Z',
          spin_started_at: '2026-04-17T12:00:15.000Z',
          settled_at: '2026-04-17T12:00:20.000Z',
          winning_number: 7,
          winning_color: 'red' as const,
          created_at: '2026-04-17T12:00:00.000Z',
        },
      ],
      roundParticipants: [
        {
          user_id: 'user-1',
          username: 'Ty',
          avatar_url: null,
          total_stake: 35,
          bet_count: 2,
          bets: [],
        },
      ],
    });

    render(
      <RouletteGame userId="user-1" balance={100} refreshProfile={vi.fn()} />,
    );

    const leftRail = screen.getByTestId('roulette-left-rail');
    const leftRailText = leftRail.textContent ?? '';

    expect(leftRail).toHaveTextContent('Gracze w rundzie');
    expect(leftRail).toHaveTextContent('Ostatnie spiny');
    expect(leftRail).toHaveTextContent('Ostatnie wygrane');
    expect(leftRailText.indexOf('Gracze w rundzie')).toBeLessThan(
      leftRailText.indexOf('Ostatnie wygrane'),
    );
    expect(leftRailText.indexOf('Ostatnie spiny')).toBeLessThan(
      leftRailText.indexOf('Ostatnie wygrane'),
    );
  });

  it('uses the desktop width with left, center, and right table zones', () => {
    useRouletteTableMock.mockReturnValue(baseTableMock);

    render(
      <RouletteGame userId="user-1" balance={100} refreshProfile={vi.fn()} />,
    );

    expect(screen.getByTestId('roulette-table-layout')).toHaveClass(
      'xl:grid-cols-[360px_minmax(520px,1fr)_360px]',
    );
    expect(screen.getByTestId('roulette-left-rail')).toHaveTextContent(
      'Ostatnie wygrane',
    );
    expect(screen.getByTestId('roulette-center-stage')).toBeInTheDocument();
    expect(screen.getByTestId('roulette-right-rail')).toHaveTextContent(
      'Typ zakładu',
    );
  });

  it('defaults bet type to Numer on first load', () => {
    useRouletteTableMock.mockReturnValue(baseTableMock);

    render(
      <RouletteGame userId="user-1" balance={100} refreshProfile={vi.fn()} />,
    );

    expect(screen.getAllByRole('button', { name: /Numer/i })[0]).toHaveClass(
      'border-amber-500/50',
    );
    expect(screen.getByText('Wartość')).toBeInTheDocument();
  });

  it('restores last selected bet type from storage and persists changes', () => {
    getStoredRouletteBetTypeMock.mockReturnValue('color');
    useRouletteTableMock.mockReturnValue(baseTableMock);

    render(
      <RouletteGame userId="user-1" balance={100} refreshProfile={vi.fn()} />,
    );

    expect(screen.getAllByRole('button', { name: /Kolor/i })[0]).toHaveClass(
      'border-amber-500/50',
    );

    fireEvent.click(screen.getByRole('button', { name: /Parzystość/i }));

    expect(storeRouletteBetTypeMock).toHaveBeenCalledWith('parity');
  });

  it('puts bet type selection inside the mobile stake drawer', () => {
    useIsMobileMock.mockReturnValue(true);
    useRouletteTableMock.mockReturnValue(baseTableMock);

    render(
      <RouletteGame userId="user-1" balance={100} refreshProfile={vi.fn()} />,
    );

    expect(screen.queryByTestId('roulette-bet-panel')).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: /Otwórz kupon ruletki/i }),
    );

    const drawer = screen.getByTestId('mobile-stake-drawer');
    expect(drawer).toHaveTextContent('Typ zakładu');
    expect(drawer).toHaveTextContent('Wybierz stawkę');
    expect(drawer).toHaveClass(
      'max-h-[calc(var(--app-viewport-height,100svh)-4rem)]',
      'overflow-y-auto',
      'overscroll-contain',
    );
    expect(screen.getByTestId('roulette-bet-value-grid')).toHaveClass(
      'grid-cols-5',
      'sm:grid-cols-6',
    );
  });

  it('supports halving and doubling the stake from the floating bar', () => {
    useRouletteTableMock.mockReturnValue(baseTableMock);

    render(
      <RouletteGame userId="user-1" balance={100} refreshProfile={vi.fn()} />,
    );

    fireEvent.change(screen.getByRole('spinbutton'), {
      target: { value: '40' },
    });
    fireEvent.click(screen.getByRole('button', { name: '1/2' }));
    expect(screen.getByRole('spinbutton')).toHaveValue(20);

    fireEvent.click(screen.getByRole('button', { name: '2x' }));
    expect(screen.getByRole('spinbutton')).toHaveValue(40);
  });

  it('shows all players participating in the current round', () => {
    useRouletteTableMock.mockReturnValue({
      ...baseTableMock,
      roundParticipants: [
        {
          user_id: 'user-1',
          username: 'Ty',
          avatar_url: null,
          total_stake: 35,
          bet_count: 2,
          bets: [
            { bet_type: 'color' as const, bet_value: 'red', stake: 25 },
            { bet_type: 'straight' as const, bet_value: '7', stake: 10 },
          ],
        },
        {
          user_id: 'user-2',
          username: 'LuckyFox',
          avatar_url: null,
          total_stake: 20,
          bet_count: 1,
          bets: [{ bet_type: 'color' as const, bet_value: 'black', stake: 20 }],
        },
      ],
    });

    render(
      <RouletteGame userId="user-1" balance={100} refreshProfile={vi.fn()} />,
    );

    expect(screen.getByText('Gracze w rundzie')).toBeInTheDocument();
    expect(screen.getByText('LuckyFox')).toBeInTheDocument();
    expect(screen.getByText('35.00 zł')).toBeInTheDocument();
    expect(screen.getByText('2 zakłady')).toBeInTheDocument();
    expect(screen.getByText('Kolor: Czerwone')).toBeInTheDocument();
    expect(screen.getByText('Numer: 7')).toBeInTheDocument();
    expect(screen.getByText('Kolor: Czarne')).toBeInTheDocument();
  });

  it('does not show an old user win when entering the table later', () => {
    useRouletteTableMock.mockReturnValue({
      ...baseTableMock,
      phase: 'waiting',
      currentRound: {
        ...baseTableMock.currentRound,
        id: 'round-next',
        round_number: 124,
      },
      recentSpins: [
        {
          id: 'round-previous',
          table_key: 'main',
          round_number: 123,
          phase: 'settled' as const,
          betting_closes_at: '2026-04-17T12:00:15.000Z',
          betting_opens_at: '2026-04-17T12:00:00.000Z',
          spin_started_at: '2026-04-17T12:00:15.000Z',
          settled_at: '2026-04-17T12:00:20.000Z',
          winning_number: 7,
          winning_color: 'red' as const,
          created_at: '2026-04-17T12:00:00.000Z',
        },
      ],
      recentWins: [
        {
          id: 'win-user-1',
          round_id: 'round-previous',
          user_id: 'user-1',
          username: 'Ty',
          avatar_url: null,
          bet_type: 'color' as const,
          bet_value: 'red',
          payout: 40,
          stake: 20,
          is_win: true,
          round_number: 123,
          created_at: '2026-04-17T12:00:04.000Z',
          settled_at: '2026-04-17T12:00:20.000Z',
        },
      ],
      activeBets: [],
    });

    render(
      <RouletteGame userId="user-1" balance={100} refreshProfile={vi.fn()} />,
    );

    expect(screen.queryByText('Wygrałeś 40.00 zł!')).not.toBeInTheDocument();
    expect(toastSuccessMock).not.toHaveBeenCalledWith(
      'Trafiony spin: +40.00 zł',
    );
  });

  it('notifies about a freshly settled user win after the table has advanced to the next round', async () => {
    const placeBetMock = vi.fn().mockResolvedValue({
      id: 'accepted-bet',
      round_id: 'round-previous',
      user_id: 'user-1',
      bet_type: 'color' as const,
      bet_value: 'red',
      payout: 0,
      stake: 20,
      is_win: null,
      created_at: '2026-04-17T12:00:04.000Z',
      settled_at: null,
    });
    useRouletteTableMock.mockReturnValue({
      ...baseTableMock,
      currentRound: { ...baseTableMock.currentRound, id: 'round-previous' },
      recentWins: [],
      placeBet: placeBetMock,
    });

    const { rerender } = render(
      <RouletteGame userId="user-1" balance={100} refreshProfile={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Kolor x2/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Czerwone' }));
    fireEvent.change(screen.getByRole('spinbutton'), {
      target: { value: '20' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Postaw' }));

    await waitFor(() => {
      expect(placeBetMock).toHaveBeenCalled();
    });

    useRouletteTableMock.mockReturnValue({
      ...baseTableMock,
      phase: 'waiting',
      currentRound: {
        ...baseTableMock.currentRound,
        id: 'round-next',
        round_number: 124,
      },
      activeBets: [],
      recentSpins: [
        {
          id: 'round-previous',
          table_key: 'main',
          round_number: 123,
          phase: 'settled' as const,
          betting_closes_at: '2026-04-17T12:00:15.000Z',
          betting_opens_at: '2026-04-17T12:00:00.000Z',
          spin_started_at: '2026-04-17T12:00:15.000Z',
          settled_at: '2026-04-17T12:00:20.000Z',
          winning_number: 7,
          winning_color: 'red' as const,
          created_at: '2026-04-17T12:00:00.000Z',
        },
      ],
      recentWins: [
        {
          id: 'win-user-1',
          round_id: 'round-previous',
          user_id: 'user-1',
          username: 'Ty',
          avatar_url: null,
          bet_type: 'color' as const,
          bet_value: 'red',
          payout: 40,
          stake: 20,
          is_win: true,
          round_number: 123,
          created_at: '2026-04-17T12:00:04.000Z',
          settled_at: '2026-04-17T12:00:20.000Z',
        },
      ],
    });

    rerender(
      <RouletteGame userId="user-1" balance={100} refreshProfile={vi.fn()} />,
    );

    expect(screen.getByText('Wygrałeś 40.00 zł!')).toBeInTheDocument();
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith('Trafiony spin: +40.00 zł');
    });
  });

  it('shows a new win toast after dismissing the previous win toast', () => {
    useRouletteTableMock.mockReturnValue({
      ...baseTableMock,
      phase: 'settled',
      currentRound: {
        ...baseTableMock.currentRound,
        id: 'round-previous',
        phase: 'settled' as const,
        round_number: 123,
        winning_number: 7,
        winning_color: 'red' as const,
      },
      activeBets: [
        {
          id: 'win-user-1',
          round_id: 'round-previous',
          user_id: 'user-1',
          bet_type: 'color' as const,
          bet_value: 'red',
          payout: 40,
          stake: 20,
          is_win: true,
          created_at: '2026-04-17T12:00:04.000Z',
          settled_at: '2026-04-17T12:00:20.000Z',
        },
      ],
    });

    const { rerender } = render(
      <RouletteGame userId="user-1" balance={100} refreshProfile={vi.fn()} />,
    );

    expect(screen.getByText('Wygrałeś 40.00 zł!')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: /Zamknij powiadomienie o wygranej/i }),
    );
    expect(screen.queryByText('Wygrałeś 40.00 zł!')).not.toBeInTheDocument();

    useRouletteTableMock.mockReturnValue({
      ...baseTableMock,
      phase: 'settled',
      currentRound: {
        ...baseTableMock.currentRound,
        id: 'round-next-win',
        phase: 'settled' as const,
        round_number: 124,
        winning_number: 12,
        winning_color: 'red' as const,
      },
      activeBets: [
        {
          id: 'win-user-2',
          round_id: 'round-next-win',
          user_id: 'user-1',
          bet_type: 'color' as const,
          bet_value: 'red',
          payout: 60,
          stake: 30,
          is_win: true,
          created_at: '2026-04-17T12:01:04.000Z',
          settled_at: '2026-04-17T12:01:20.000Z',
        },
      ],
    });

    rerender(
      <RouletteGame userId="user-1" balance={100} refreshProfile={vi.fn()} />,
    );

    expect(screen.getByText('Wygrałeś 60.00 zł!')).toBeInTheDocument();
  });

  it('shares a freshly settled win with the settled spin result', async () => {
    useRouletteTableMock.mockReturnValue({
      ...baseTableMock,
      phase: 'settled',
      currentRound: {
        ...baseTableMock.currentRound,
        id: 'round-previous',
        phase: 'settled' as const,
        round_number: 123,
        winning_number: 7,
        winning_color: 'red' as const,
      },
      activeBets: [
        {
          id: 'win-user-1',
          round_id: 'round-previous',
          user_id: 'user-1',
          bet_type: 'color' as const,
          bet_value: 'red',
          payout: 40,
          stake: 20,
          is_win: true,
          created_at: '2026-04-17T12:00:04.000Z',
          settled_at: '2026-04-17T12:00:20.000Z',
        },
      ],
      recentSpins: [
        {
          id: 'round-previous',
          table_key: 'main',
          round_number: 123,
          phase: 'settled' as const,
          betting_closes_at: '2026-04-17T12:00:15.000Z',
          betting_opens_at: '2026-04-17T12:00:00.000Z',
          spin_started_at: '2026-04-17T12:00:15.000Z',
          settled_at: '2026-04-17T12:00:20.000Z',
          winning_number: 7,
          winning_color: 'red' as const,
          created_at: '2026-04-17T12:00:00.000Z',
        },
      ],
      recentWins: [],
    });

    render(
      <RouletteGame
        userId="user-1"
        username="Tester"
        avatarUrl="https://cdn.example/tester.jpg"
        balance={100}
        refreshProfile={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Udostępnij/i }));

    await waitFor(() => {
      expect(createCasinoShareMock).toHaveBeenCalledWith({
        userId: 'user-1',
        betId: 'win-user-1',
        content: expect.stringContaining('Numer 7'),
        betType: 'color',
        betValue: 'red',
        stake: 20,
        payout: 40,
        roundNumber: 123,
        winningNumber: 7,
        winningColor: 'red',
      });
    });
    expect(toastSuccessMock).toHaveBeenCalledWith(
      'Wygrana udostępniona na Socialu!',
    );
  });

  it('does not show the same logical win again after sharing it', async () => {
    const sharedWin = {
      id: 'win-user-1',
      round_id: 'round-previous',
      user_id: 'user-1',
      bet_type: 'color' as const,
      bet_value: 'red',
      payout: 40,
      stake: 20,
      is_win: true,
      created_at: '2026-04-17T12:00:04.000Z',
      settled_at: '2026-04-17T12:00:20.000Z',
    };

    useRouletteTableMock.mockReturnValue({
      ...baseTableMock,
      phase: 'settled',
      currentRound: {
        ...baseTableMock.currentRound,
        id: 'round-previous',
        phase: 'settled' as const,
        round_number: 123,
        winning_number: 7,
        winning_color: 'red' as const,
      },
      activeBets: [sharedWin],
      recentSpins: [
        {
          id: 'round-previous',
          table_key: 'main',
          round_number: 123,
          phase: 'settled' as const,
          betting_closes_at: '2026-04-17T12:00:15.000Z',
          betting_opens_at: '2026-04-17T12:00:00.000Z',
          spin_started_at: '2026-04-17T12:00:15.000Z',
          settled_at: '2026-04-17T12:00:20.000Z',
          winning_number: 7,
          winning_color: 'red' as const,
          created_at: '2026-04-17T12:00:00.000Z',
        },
      ],
    });

    const { rerender } = render(
      <RouletteGame userId="user-1" balance={100} refreshProfile={vi.fn()} />,
    );

    expect(screen.getByText('Wygrałeś 40.00 zł!')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Udostępnij/i }));

    await waitFor(() => {
      expect(createCasinoShareMock).toHaveBeenCalled();
    });
    expect(screen.queryByText('Wygrałeś 40.00 zł!')).not.toBeInTheDocument();

    useRouletteTableMock.mockReturnValue({
      ...baseTableMock,
      phase: 'settled',
      currentRound: {
        ...baseTableMock.currentRound,
        id: 'round-previous',
        phase: 'settled' as const,
        round_number: 123,
        winning_number: 7,
        winning_color: 'red' as const,
      },
      activeBets: [
        {
          ...sharedWin,
          id: 'win-user-1-from-refresh',
        },
      ],
    });

    rerender(
      <RouletteGame userId="user-1" balance={100} refreshProfile={vi.fn()} />,
    );

    expect(screen.queryByText('Wygrałeś 40.00 zł!')).not.toBeInTheDocument();
    expect(toastSuccessMock).toHaveBeenCalledTimes(2);
  });
});
