import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ComponentProps, ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DailyJackpotDraw } from '../types';

import JackpotDrawPage from './JackpotDrawPage';

const getDailyJackpotDrawMock = vi.fn();
const revealDailyJackpotDrawMock = vi.fn();
const claimDailyJackpotRewardMock = vi.fn();
const refreshProfileMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const readJackpotCss = () =>
  readFileSync(
    join(process.cwd(), 'src/features/jackpot/styles/jackpotDrawPage.css'),
    'utf8',
  );
const drawingFlightMs = 3300;

function getMobileJackpotDrawCss() {
  const css = readJackpotCss();
  const mobileStart = css.indexOf('@media (max-width: 560px)');
  const nextMediaStart = css.indexOf('@media (prefers-reduced-motion: reduce)', mobileStart);

  expect(mobileStart).toBeGreaterThanOrEqual(0);
  expect(nextMediaStart).toBeGreaterThan(mobileStart);

  return css.slice(mobileStart, nextMediaStart);
}

function getMobileFlightTravel(name: 'start' | 'end') {
  const mobileCss = getMobileJackpotDrawCss();
  const match = mobileCss.match(
    new RegExp(`--jackpot-ticket-flight-${name}:\\s*(-?\\d+(?:\\.\\d+)?)vw;`),
  );

  expect(match).not.toBeNull();

  return Number(match?.[1]);
}

function getCssRule(selector: string) {
  const css = readJackpotCss();
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]+)\\}`));

  expect(match).not.toBeNull();

  return match?.[1] ?? '';
}

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'winner-1' },
    profile: { id: 'winner-1', username: 'LuckyWinner', balance: 500 },
    refreshProfile: refreshProfileMock,
  }),
}));

vi.mock('../api/jackpot', () => ({
  getDailyJackpotDraw: (...args: unknown[]) =>
    getDailyJackpotDrawMock(...args),
  revealDailyJackpotDraw: (...args: unknown[]) =>
    revealDailyJackpotDrawMock(...args),
  claimDailyJackpotReward: (...args: unknown[]) =>
    claimDailyJackpotRewardMock(...args),
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: ComponentProps<'div'>) => (
      <div {...props}>{children}</div>
    ),
    section: ({ children, ...props }: ComponentProps<'section'>) => (
      <section {...props}>{children}</section>
    ),
  },
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const draw: DailyJackpotDraw = {
  poolId: 'pool-1',
  poolDate: '2026-06-17',
  status: 'drawn',
  prizeAmount: 125,
  ticketPrice: 100,
  minUniqueUsers: 3,
  participantCount: 3,
  ticketCount: 4,
  drawScheduledAt: '2026-06-17T18:00:00.000Z',
  drawnAt: '2026-06-17T18:03:00.000Z',
  winnerUserId: 'winner-1',
  winnerUsername: 'LuckyWinner',
  winnerAvatarUrl: null,
  winningTicketNumber: 4,
  currentUserHasTicket: true,
  currentUserTicketCount: 1,
  currentUserIsWinner: true,
  resultViewedAt: null,
  rewardClaimedAt: null,
  rewardAutoCreditedAt: null,
  rewardCreditStatus: 'pending',
  rewardCreditEventId: null,
  participants: [
    {
      userId: 'winner-1',
      username: 'LuckyWinner',
      avatarUrl: null,
      ticketNumbers: [4],
      ticketCount: 1,
    },
    {
      userId: 'user-2',
      username: 'Mati',
      avatarUrl: null,
      ticketNumbers: [1, 3],
      ticketCount: 2,
    },
    {
      userId: 'user-3',
      username: 'Ania',
      avatarUrl: null,
      ticketNumbers: [2],
      ticketCount: 1,
    },
  ],
  serverNow: '2026-06-17T18:04:00.000Z',
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/jackpot/draw/pool-1']}>
      <Routes>
        <Route path="/jackpot/draw/:roundId" element={<JackpotDrawPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function advanceThroughReplay() {
  await act(async () => {
    vi.advanceTimersByTime(drawingFlightMs);
  });
}

describe('JackpotDrawPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    getDailyJackpotDrawMock.mockResolvedValue(draw);
    revealDailyJackpotDrawMock.mockResolvedValue(draw);
    claimDailyJackpotRewardMock.mockResolvedValue({
      poolId: 'pool-1',
      amount: 125,
      balanceAfter: 625,
      rewardCreditStatus: 'claimed',
      rewardClaimedAt: '2026-06-17T18:06:00.000Z',
      rewardAutoCreditedAt: null,
      alreadyCredited: false,
    });
    refreshProfileMock.mockResolvedValue(undefined);
  });

  it('does not reveal the winner before the replay starts', async () => {
    renderPage();

    expect(
      await screen.findByRole('button', {
        name: /Rozpocznij losowanie|Obejrzyj losowanie/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Rozpocznij losowanie|Obejrzyj losowanie/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Wygrywa LuckyWinner/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Odbierz nagrodę/i)).not.toBeInTheDocument();
  });

  it('uses compact icon navigation without jackpot or back text labels on the replay screen', async () => {
    renderPage();

    expect(
      await screen.findByRole('button', {
        name: /Wróć do poprzedniego widoku/i,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Jackpot dzienny/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Jackpot Dnia/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Powrót/i)).not.toBeInTheDocument();
  });

  it('keeps the replay intro visual-only without the old text hero copy', async () => {
    renderPage();

    await screen.findByRole('button', {
      name: /Rozpocznij losowanie|Obejrzyj losowanie/i,
    });

    expect(screen.queryByRole('heading', { name: /Losowanie puli/i })).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Zobacz jak wczorajszą pulę losowaliśmy/i),
    ).not.toBeInTheDocument();
  });

  it('uses generated PNG assets for the stage, flying tickets, and winning ticket reveal', async () => {
    const { container } = renderPage();

    await screen.findByRole('button', {
      name: /Rozpocznij losowanie|Obejrzyj losowanie/i,
    });

    expect(
      container.querySelector('img[src="/jackpot/jackpot-draw-stage.png"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('img[src="/jackpot/jackpot-ticket-stage.svg"]'),
    ).not.toBeInTheDocument();

    vi.useFakeTimers();
    fireEvent.click(
      screen.getByRole('button', {
        name: /Rozpocznij losowanie|Obejrzyj losowanie/i,
      }),
    );

    expect(
      container.querySelectorAll('img[src="/jackpot/jackpot-ticket.png"]').length,
    ).toBeGreaterThan(0);

    await advanceThroughReplay();

    expect(
      container.querySelector('img[src="/jackpot/jackpot-winning-ticket.png"]'),
    ).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('keeps mobile ticket flight traveling from off-screen left to off-screen right', () => {
    const viewportWidth = 390;
    const minTravelPixels = 210;

    expect((getMobileFlightTravel('start') / 100) * viewportWidth).toBeLessThanOrEqual(
      -minTravelPixels,
    );
    expect((getMobileFlightTravel('end') / 100) * viewportWidth).toBeGreaterThanOrEqual(
      minTravelPixels,
    );
  });

  it('uses Polish count labels in the draw summary and participant list', async () => {
    renderPage();

    expect(await screen.findByText('3 gracze')).toBeInTheDocument();
    expect(screen.getByText('4 losy')).toBeInTheDocument();
    expect(screen.getAllByText('1 ticket')).toHaveLength(2);
    expect(screen.getByText('2 tickety')).toBeInTheDocument();
    expect(screen.queryByText(/1 graczy|1 losy|1 ticketów/i)).not.toBeInTheDocument();
  });

  it('reveals the winner after the replay and lets the winner claim once', async () => {
    renderPage();

    const startButton = await screen.findByRole('button', {
      name: /Rozpocznij losowanie|Obejrzyj losowanie/i,
    });

    vi.useFakeTimers();
    fireEvent.click(
      startButton,
    );

    await advanceThroughReplay();

    expect(screen.getByText(/Wygrywa LuckyWinner/i)).toBeInTheDocument();
    expect(revealDailyJackpotDrawMock).toHaveBeenCalledWith('pool-1');

    vi.useRealTimers();
    fireEvent.click(screen.getByRole('button', { name: /Odbierz nagrodę/i }));

    await waitFor(() => {
      expect(claimDailyJackpotRewardMock).toHaveBeenCalledTimes(1);
      expect(claimDailyJackpotRewardMock).toHaveBeenCalledWith('pool-1');
      expect(refreshProfileMock).toHaveBeenCalled();
      expect(toastSuccessMock).toHaveBeenCalledWith('Odebrano 125,00 zł', {
        position: 'bottom-center',
      });
    });
  });

  it('re-reveals after reload when result was viewed but winner fields are hidden', async () => {
    const hiddenWinnerDraw = {
      ...draw,
      winnerUserId: null,
      winnerUsername: null,
      winningTicketNumber: null,
      currentUserIsWinner: false,
      resultViewedAt: '2026-06-17T18:05:00.000Z',
    };
    getDailyJackpotDrawMock.mockResolvedValue(hiddenWinnerDraw);
    revealDailyJackpotDrawMock.mockResolvedValue({
      ...draw,
      resultViewedAt: '2026-06-17T18:05:30.000Z',
    });

    renderPage();

    const startButton = await screen.findByRole('button', {
      name: /Obejrzyj losowanie/i,
    });

    vi.useFakeTimers();
    fireEvent.click(startButton);
    await advanceThroughReplay();

    expect(revealDailyJackpotDrawMock).toHaveBeenCalledWith('pool-1');
    expect(screen.getByText(/Wygrywa LuckyWinner/i)).toBeInTheDocument();
    expect(screen.getByText('Ticket #4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Odbierz nagrodę/i })).toBeInTheDocument();
    expect(screen.queryByText(/Wygrywa zwycięzca/i)).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it('keeps the winning ticket in the normal flight stream until the result reveal', async () => {
    const { container } = renderPage();

    const startButton = await screen.findByRole('button', {
      name: /Rozpocznij losowanie|Obejrzyj losowanie/i,
    });

    vi.useFakeTimers();
    fireEvent.click(startButton);

    expect(revealDailyJackpotDrawMock).toHaveBeenCalledWith('pool-1');
    expect(container.querySelector('.jackpot-final-ticket')).not.toBeInTheDocument();
    expect(container.querySelector('.jackpot-flight-ticket--settling')).not.toBeInTheDocument();
    expect(container.querySelector('.jackpot-ticket-flight--finalizing')).not.toBeInTheDocument();
    expect(container.querySelector('.jackpot-flight-ticket__badge')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Zwycięski ticket zatrzymany/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Twój/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Zatrzymujemy ticket/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Wygrywa LuckyWinner/i)).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(drawingFlightMs - 1);
    });

    expect(screen.queryByText(/Wygrywa LuckyWinner/i)).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(screen.getByText(/Wygrywa LuckyWinner/i)).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('keeps the reveal inside the replay stage instead of switching to a separate result view', async () => {
    renderPage();

    const startButton = await screen.findByRole('button', {
      name: /Rozpocznij losowanie|Obejrzyj losowanie/i,
    });

    vi.useFakeTimers();
    fireEvent.click(startButton);
    await advanceThroughReplay();

    expect(screen.getByText(/Wygrywa LuckyWinner/i)).toBeInTheDocument();
    expect(screen.getByText(/Zwycięski ticket/i)).toBeInTheDocument();
    expect(screen.getByText('Tickety w puli')).toBeInTheDocument();
    expect(screen.queryByText(/Szczegóły losowania/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Odbiór nagrody/i)).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it('shows ticket numbers flying during the drawing before reveal', async () => {
    revealDailyJackpotDrawMock.mockReturnValue(
      new Promise<DailyJackpotDraw>(() => undefined),
    );
    const { container } = renderPage();

    const startButton = await screen.findByRole('button', {
      name: /Rozpocznij losowanie|Obejrzyj losowanie/i,
    });

    vi.useFakeTimers();
    fireEvent.click(startButton);

    const ticketFlight = screen.getByRole('list', {
      name: /Animowane tickety w puli/i,
    });

    expect(ticketFlight).toBeInTheDocument();
    expect(screen.getByText('Losowanie ticketów')).toBeInTheDocument();
    expect(screen.getAllByText('#04')[0]).toBeInTheDocument();
    expect(screen.getAllByText('#01')[0]).toBeInTheDocument();
    expect(
      container.querySelector('.jackpot-flight-ticket__owner'),
    ).not.toBeInTheDocument();
    expect(ticketFlight).not.toHaveTextContent('LuckyWinner');
    expect(ticketFlight).not.toHaveTextContent('Mati');
    expect(ticketFlight).not.toHaveTextContent('Twój');
    expect(
      container.querySelector('.jackpot-flight-ticket__badge'),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector('.jackpot-flight-ticket--settling'),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector('.jackpot-ticket-flight__spotlight')?.textContent,
    ).toBeUndefined();
    expect(screen.queryByText(/Skanujemy pulę/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Wygrywa LuckyWinner/i)).not.toBeInTheDocument();
    expect(revealDailyJackpotDrawMock).toHaveBeenCalledWith('pool-1');

    vi.useRealTimers();
  });

  it('centers ticket numbers on the flying ticket artwork', () => {
    const numberRule = getCssRule('.jackpot-flight-ticket__number');

    expect(numberRule).toMatch(/position:\s*absolute;/);
    expect(numberRule).toMatch(/left:\s*50%;/);
    expect(numberRule).toMatch(/top:\s*50%;/);
    expect(numberRule).toMatch(/transform:\s*translate\(-50%,\s*-50%\);/);
    expect(numberRule).toMatch(/text-align:\s*center;/);
  });

  it('shows the current user ticket numbers on the draw page', async () => {
    renderPage();

    expect(await screen.findByText('Twoje tickety')).toBeInTheDocument();
    expect(screen.getByText('#04')).toBeInTheDocument();
  });

  it('balances the reveal spacing around the winning ticket', () => {
    const revealRule = getCssRule('.jackpot-stage-reveal');
    const ticketWrapRule = getCssRule('.jackpot-stage-reveal__ticket-wrap');
    const titleRule = getCssRule('.jackpot-stage-reveal h2');

    expect(revealRule).toMatch(/top:\s*50%;/);
    expect(revealRule).toMatch(/padding:\s*clamp\(0\.7rem,\s*1\.7vw,\s*1rem\)\s*0\s*clamp\(0\.7rem,\s*1\.7vw,\s*1rem\);/);
    expect(ticketWrapRule).toMatch(/width:\s*min\(25\.5rem,\s*90%\);/);
    expect(titleRule).toMatch(/margin-bottom:\s*0\.34rem;/);
  });

  it('keeps breathing room under the claimed reward state', () => {
    expect(readJackpotCss()).toMatch(
      /\.jackpot-draw-claimed\s*\{[^}]*margin-bottom:\s*clamp\(1rem,\s*2\.4vh,\s*1\.45rem\);/,
    );
  });

  it('expands and collapses the participant roster in place', async () => {
    const participants = Array.from({ length: 12 }, (_, index) => ({
      userId: `user-${index + 1}`,
      username: `Gracz ${index + 1}`,
      avatarUrl: null,
      ticketNumbers: [index + 1],
      ticketCount: 1,
    }));

    getDailyJackpotDrawMock.mockResolvedValue({
      ...draw,
      participantCount: participants.length,
      ticketCount: participants.length,
      participants,
    });

    renderPage();

    expect(await screen.findByText('Gracz 10')).toBeInTheDocument();
    expect(screen.queryByText('Gracz 11')).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /Pokaż wszystkich \(12\)/i }),
    );

    expect(screen.getByText('Gracz 11')).toBeInTheDocument();
    expect(screen.getByText('Gracz 12')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Pokaż mniej/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Pokaż mniej/i }));

    expect(screen.queryByText('Gracz 11')).not.toBeInTheDocument();
  });

  it('does not show a claim button to a non-winner after replay', async () => {
    const nonWinnerDraw = {
      ...draw,
      currentUserIsWinner: false,
      currentUserHasTicket: true,
      currentUserTicketCount: 1,
    };
    getDailyJackpotDrawMock.mockResolvedValue(nonWinnerDraw);
    revealDailyJackpotDrawMock.mockResolvedValue(nonWinnerDraw);

    renderPage();

    const startButton = await screen.findByRole('button', {
      name: /Rozpocznij losowanie|Obejrzyj losowanie/i,
    });

    vi.useFakeTimers();
    fireEvent.click(startButton);
    await advanceThroughReplay();

    expect(screen.getByText(/Wygrywa LuckyWinner/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Odbierz nagrodę/i })).not.toBeInTheDocument();
  });

  it('does not replay or reveal a rolled-over jackpot pool', async () => {
    getDailyJackpotDrawMock.mockResolvedValue({
      ...draw,
      status: 'rolled_over',
      winnerUserId: null,
      winnerUsername: null,
      winningTicketNumber: null,
      currentUserIsWinner: false,
      rewardCreditStatus: 'not_applicable',
    });

    renderPage();

    expect(await screen.findByText(/Pula przeszła na kolejny dzień/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Rozpocznij losowanie|Obejrzyj losowanie/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Wygrywa/i)).not.toBeInTheDocument();
    expect(revealDailyJackpotDrawMock).not.toHaveBeenCalled();
  });
});
