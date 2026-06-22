import type { ComponentProps, ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CouponProvider } from '@/contexts/CouponContext';

import JackpotDevFlowPage from './JackpotDevFlowPage';

const drawingFlightMs = 3300;

vi.mock('@/components/Navbar', () => ({
  Navbar: () => <nav>BSPLIC 2.0</nav>,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'dev-user' },
    profile: {
      id: 'dev-user',
      username: 'codex_e2e',
      avatar_url: null,
      balance: 5000,
      current_streak: 0,
      longest_streak: 0,
      last_bet_date: null,
      last_topup_at: null,
      created_at: '2026-06-20T10:00:00.000Z',
    },
    refreshProfile: vi.fn(),
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: ComponentProps<'div'>) => (
      <div {...props}>{children}</div>
    ),
  },
}));

function renderDevFlow() {
  return render(
    <MemoryRouter initialEntries={['/dev/jackpot']}>
      <CouponProvider>
        <JackpotDevFlowPage />
      </CouponProvider>
    </MemoryRouter>,
  );
}

async function startAndFinishReplay() {
  fireEvent.click(
    screen.getByRole('button', { name: /Rozpocznij losowanie/i }),
  );
  await act(async () => {
    vi.advanceTimersByTime(drawingFlightMs);
  });
}

describe('JackpotDevFlowPage', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('lets a developer click through buying tickets, replaying the draw, and claiming the reward', async () => {
    renderDevFlow();

    expect(
      screen.getByRole('region', { name: 'Jackpot Dnia' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('2480,75 zł').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /^Kup ticket$/i }));
    expect(screen.getByText('#14')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Kup drugi ticket/i }));
    expect(screen.getByText('#14 #22')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Limit ticketów wykorzystany/i }),
    ).toBeDisabled();

    fireEvent.click(
      screen.getByRole('button', { name: /Symuluj godzinę 20:00/i }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: /Przejdź do losowania/i }),
    );

    expect(
      await screen.findByRole('button', { name: /Rozpocznij losowanie/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Twoje tickety')).toBeInTheDocument();
    expect(screen.getByText('#14 #22')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Pokaż wszystkich \(18\)/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /Losowanie puli/i }),
    ).not.toBeInTheDocument();

    vi.useFakeTimers();
    await startAndFinishReplay();

    vi.useRealTimers();
    expect(await screen.findByText(/Wygrywa codex_e2e/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Odbierz nagrodę/i }));

    await waitFor(() => {
      expect(screen.getByText('Nagroda odebrana')).toBeInTheDocument();
    });
  });

  it('shows a non-winner draw when the developer skips buying a ticket', async () => {
    renderDevFlow();

    fireEvent.click(
      screen.getByRole('button', { name: /Symuluj godzinę 20:00/i }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: /Obejrzyj losowanie/i }),
    );

    expect(
      await screen.findByRole('button', { name: /Rozpocznij losowanie/i }),
    ).toBeInTheDocument();

    vi.useFakeTimers();
    await startAndFinishReplay();

    vi.useRealTimers();
    expect(await screen.findByText(/Wygrywa Mati/i)).toBeInTheDocument();
    expect(screen.queryByText(/Wygrywa codex_e2e/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Odbierz nagrodę/i }),
    ).not.toBeInTheDocument();
  });

  it('expands and collapses the mocked draw roster in the dev flow', async () => {
    renderDevFlow();

    fireEvent.click(
      screen.getByRole('button', { name: /Symuluj godzinę 20:00/i }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: /Obejrzyj losowanie/i }),
    );

    expect(await screen.findByText('Gracz QA 10')).toBeInTheDocument();
    expect(screen.queryByText('Gracz QA 11')).not.toBeInTheDocument();

    const expandButton = screen.getByRole('button', {
      name: /Pokaż wszystkich \(18\)/i,
    });
    expect(expandButton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(expandButton);

    expect(screen.getByText('Gracz QA 11')).toBeInTheDocument();
    expect(screen.getByText('Gracz QA 18')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Pokaż mniej/i }),
    ).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(screen.getByRole('button', { name: /Pokaż mniej/i }));

    expect(screen.queryByText('Gracz QA 11')).not.toBeInTheDocument();
  });
});
