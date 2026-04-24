import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RouletteGame } from './RouletteGame';

const useRouletteTableMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('@/features/casino/hooks/useRouletteTable', () => ({
  useRouletteTable: (...args: unknown[]) => useRouletteTableMock(...args),
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
        balance={100}
        refreshProfile={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Postaw' }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Wybierz typ zakładu');
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
        balance={100}
        refreshProfile={vi.fn()}
      />,
    );

    // Select bet type
    fireEvent.click(screen.getByRole('button', { name: /Kolor x2/i }));
    // Select bet value
    fireEvent.click(screen.getByRole('button', { name: 'Czerwone' }));
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
    expect(screen.getByText('Twoje zakłady')).toBeInTheDocument();
    expect(screen.getAllByText(/121/).length).toBeGreaterThan(0);
    expect(screen.getByText('LuckyFox')).toBeInTheDocument();
  });

  it('lets the player choose a quick stake before placing a bet', () => {
    useRouletteTableMock.mockReturnValue(baseTableMock);

    render(
      <RouletteGame
        userId="user-1"
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
      <RouletteGame
        userId="user-1"
        balance={100}
        refreshProfile={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Schowaj stawkę' }));

    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Postaw' }),
      ).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^Pokaż stawkę/ }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Postaw' })).toBeInTheDocument();
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
      <RouletteGame
        userId="user-1"
        balance={100}
        refreshProfile={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Postaw' }),
    ).toBeDisabled();
    expect(screen.getByText('Koło się kręci')).toBeInTheDocument();
  });

  it('renders the status bar with round info', () => {
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
      <RouletteGame
        userId="user-1"
        balance={100}
        refreshProfile={vi.fn()}
      />,
    );

    expect(screen.getByText('Przyjmowanie zakładów')).toBeInTheDocument();
    expect(screen.getByText('#125')).toBeInTheDocument();
    expect(screen.getByText('LIVE')).toBeInTheDocument();
  });

  it('shows active bets with win/loss states', () => {
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
      <RouletteGame
        userId="user-1"
        balance={100}
        refreshProfile={vi.fn()}
      />,
    );

    expect(screen.getByText('Czerwone')).toBeInTheDocument();
    // Number 7 also appears on the wheel SVG, so use a paragraph selector
    expect(screen.getByText('7', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('Runda rozliczona')).toBeInTheDocument();
  });
});
