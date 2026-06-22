import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Bet, Category } from '@/types/database';

import ManageBetsTab from './ManageBetsTab';
import { filterBets } from './manageBetsFilters';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  fetchBetAkoExclusions: vi.fn(),
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
  updateBetWithAkoExclusions: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mocks.from,
  },
}));

vi.mock('../api/akoExclusions', () => ({
  fetchBetAkoExclusions: mocks.fetchBetAkoExclusions,
  updateBetWithAkoExclusions: mocks.updateBetWithAkoExclusions,
}));

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: mocks.toast,
}));

interface Deferred<T> {
  promise: Promise<T>;
  reject: (reason?: unknown) => void;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

const categories: Category[] = [
  {
    id: 'category-1',
    name: 'Piłka',
    emoji: '⚽',
    color: '#22c55e',
    sort_order: 1,
    created_at: '2026-06-17T10:00:00.000Z',
  },
];

const bets: Bet[] = [
  {
    id: 'bet-1',
    title: 'Pierwszy zakład',
    category_id: 'category-1',
    bet_type: 'multi',
    options: [
      { name: 'Tak', odds: 2 },
      { name: 'Nie', odds: 2 },
    ],
    ends_at: '2026-06-20T10:00:00.000Z',
    is_live: false,
    is_bsplicboost: false,
    is_active: true,
    winning_option: null,
    bet_count: 0,
    created_at: '2026-06-17T10:00:00.000Z',
  },
  {
    id: 'bet-2',
    title: 'Drugi zakład',
    category_id: 'category-1',
    bet_type: 'multi',
    options: [
      { name: 'Over', odds: 1.8 },
      { name: 'Under', odds: 2.1 },
    ],
    ends_at: '2026-06-21T10:00:00.000Z',
    is_live: false,
    is_bsplicboost: false,
    is_active: true,
    winning_option: null,
    bet_count: 0,
    created_at: '2026-06-17T11:00:00.000Z',
  },
];

const baseBet: Bet = {
  id: 'filter-bet-1',
  title: 'Testowy zakład',
  category_id: null,
  bet_type: '12',
  options: [
    { name: '1', odds: 2 },
    { name: '2', odds: 2 },
  ],
  ends_at: '2026-04-13T12:00:00.000Z',
  is_live: false,
  is_bsplicboost: false,
  is_active: true,
  winning_option: null,
  bet_count: 0,
  created_at: '2026-04-13T10:00:00.000Z',
};

function setupSupabaseLists() {
  mocks.from.mockImplementation((table: string) => ({
    select: () => ({
      order: () =>
        Promise.resolve({
          data: table === 'bets' ? bets : categories,
          error: null,
        }),
    }),
  }));
}

describe('ManageBetsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSupabaseLists();
  });

  it('keeps the editor save action blocked until the current AKO exclusions request finishes', async () => {
    const firstExclusions = deferred<Awaited<ReturnType<typeof mocks.fetchBetAkoExclusions>>>();
    const secondExclusions = deferred<Awaited<ReturnType<typeof mocks.fetchBetAkoExclusions>>>();
    mocks.fetchBetAkoExclusions.mockImplementation((betId: string) => {
      if (betId === 'bet-1') return firstExclusions.promise;
      if (betId === 'bet-2') return secondExclusions.promise;
      return Promise.resolve([]);
    });

    render(<ManageBetsTab />);

    await screen.findAllByText('Pierwszy zakład');

    fireEvent.click(screen.getAllByRole('button', { name: 'Edytuj Pierwszy zakład' })[0]);
    await screen.findByText('Wczytywanie wykluczeń…');

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Edytuj zakład' })).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Edytuj Drugi zakład' })[0]);
    await waitFor(() =>
      expect(mocks.fetchBetAkoExclusions).toHaveBeenCalledWith('bet-2'),
    );

    await act(async () => {
      firstExclusions.resolve([
        {
          betId: 'other-bet',
          title: 'Stare wykluczenie',
          reason: null,
        },
      ]);
      await firstExclusions.promise;
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Zapisz zmiany' })).toBeDisabled();
    });

    await act(async () => {
      secondExclusions.resolve([]);
      await secondExclusions.promise;
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Zapisz zmiany' })).toBeEnabled();
    });
  });

  it('keeps the editor save action blocked when AKO exclusions fail to load', async () => {
    mocks.fetchBetAkoExclusions.mockRejectedValue(new Error('RPC timeout'));

    render(<ManageBetsTab />);

    await screen.findAllByText('Pierwszy zakład');

    fireEvent.click(screen.getAllByRole('button', { name: 'Edytuj Pierwszy zakład' })[0]);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Zapisz zmiany' })).toBeDisabled();
    });
    expect(
      await screen.findByText('Wykluczenia AKO nie wczytały się poprawnie. Zamknij edycję i spróbuj ponownie.'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Zapisz zmiany' }));

    expect(mocks.updateBetWithAkoExclusions).not.toHaveBeenCalled();
  });
});

describe('filterBets', () => {
  it('filters bets by search text, status and bet type together', () => {
    const filterableBets: Bet[] = [
      baseBet,
      {
        ...baseBet,
        id: 'filter-bet-2',
        title: 'Premier League zwycięzca',
        bet_type: 'single',
        is_active: false,
        winning_option: 'Arsenal',
      },
      {
        ...baseBet,
        id: 'filter-bet-3',
        title: 'Bundesliga remis',
        bet_type: '1x2',
        is_active: false,
        winning_option: '__refund__',
      },
    ];

    expect(
      filterBets({
        bets: filterableBets,
        search: 'league',
        status: 'resolved',
        betType: 'single',
      }).map((bet) => bet.id),
    ).toEqual(['filter-bet-2']);
  });

  it('returns only active bets for active status filter', () => {
    const filterableBets: Bet[] = [
      baseBet,
      {
        ...baseBet,
        id: 'filter-bet-2',
        is_active: false,
        winning_option: '1',
      },
    ];

    expect(
      filterBets({
        bets: filterableBets,
        search: '',
        status: 'active',
        betType: 'all',
      }).map((bet) => bet.id),
    ).toEqual(['filter-bet-1']);
  });
});
