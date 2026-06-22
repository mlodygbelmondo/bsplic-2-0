import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { DailyJackpotSnapshot } from '../types';

import { DailyJackpotCard } from './DailyJackpotCard';

const readJackpotCss = () =>
  readFileSync(
    join(process.cwd(), 'src/features/jackpot/styles/dailyJackpotCard.css'),
    'utf8',
  );

function getMediaCss(query: string) {
  const css = readJackpotCss();
  const mediaStart = css.indexOf(`@media ${query}`);
  const nextMediaStart = css.indexOf('@media ', mediaStart + 1);

  expect(mediaStart).toBeGreaterThanOrEqual(0);

  return css.slice(
    mediaStart,
    nextMediaStart === -1 ? undefined : nextMediaStart,
  );
}

const snapshot: DailyJackpotSnapshot = {
  poolId: 'pool-1',
  poolDate: '2026-06-17',
  status: 'collecting',
  prizeAmount: 125,
  ticketPrice: 100,
  maxTicketsPerPlayer: 2,
  minUniqueUsers: 3,
  participantCount: 2,
  ticketCount: 2,
  drawScheduledAt: '2026-06-17T18:00:00.000Z',
  currentUserHasTicket: false,
  currentUserTicketCount: 0,
  currentUserTicketNumber: null,
  currentUserTicketNumbers: [],
  winnerUserId: null,
  winnerUsername: null,
  winnerAvatarUrl: null,
  winningTicketNumber: null,
  maintenanceAutoCreditedCount: 0,
  serverNow: '2026-06-17T10:00:00.000Z',
};

describe('DailyJackpotCard', () => {
  it('does not render when there is no funded jackpot', () => {
    const { container } = render(
      <DailyJackpotCard
        snapshot={{
          ...snapshot,
          poolId: null,
          prizeAmount: 0,
          ticketCount: 0,
          participantCount: 0,
        }}
        loading={false}
        buying={false}
        balance={50}
        onBuy={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders collecting state and buys a ticket', () => {
    const onBuy = vi.fn();

    const { container } = render(
      <DailyJackpotCard
        snapshot={snapshot}
        loading={false}
        buying={false}
        balance={150}
        onBuy={onBuy}
      />,
    );

    expect(
      screen.getByRole('region', { name: 'Jackpot Dnia' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /daily jackpot/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('PULA')).not.toBeInTheDocument();
    expect(screen.getByText('Pula')).toBeInTheDocument();
    expect(screen.getByText('125 zł')).toBeInTheDocument();
    expect(screen.getByText('Losowanie dziś o 20:00')).toBeInTheDocument();
    expect(screen.getByText('Minimum 3 graczy')).toBeInTheDocument();
    expect(screen.queryByText(/ticketów w puli/i)).not.toBeInTheDocument();
    expect(screen.getByText('Twoje tickety')).toBeInTheDocument();
    expect(screen.queryByText('Twój stan')).not.toBeInTheDocument();
    expect(screen.getByText('Maks. 2')).toBeInTheDocument();
    expect(screen.queryByText('Maks 2')).not.toBeInTheDocument();
    expect(screen.queryByText('Maks. 2 tickety')).not.toBeInTheDocument();
    expect(
      container.querySelector('.daily-jackpot-card__state-label')?.textContent,
    ).toBe('Losowanie dziś o 20:00');
    expect(
      container.querySelector('.daily-jackpot-card__state-dot')?.textContent,
    ).toBe('•');
    expect(
      container.querySelector('.daily-jackpot-card__price-label-desktop')?.textContent,
    ).toBe('Cena ticketu');
    expect(
      container.querySelector('.daily-jackpot-card__price-label-mobile')?.textContent,
    ).toBe('Cena');

    fireEvent.click(screen.getByRole('button', { name: /Kup ticket/i }));

    expect(onBuy).toHaveBeenCalledTimes(1);
  });

  it('keeps the mobile jackpot card compact with horizontal stat tiles', () => {
    const mobileCss = getMediaCss('(max-width: 820px)');
    const smallMobileCss = getMediaCss('(max-width: 560px)');
    const css = readJackpotCss();

    expect(mobileCss).toMatch(/\.daily-jackpot-card\s*\{[^}]*min-height:\s*12\.1rem;/);
    expect(mobileCss).toMatch(/\.daily-jackpot-card\s*\{[^}]*max-height:\s*12\.1rem;/);
    expect(css).toMatch(
      /\.daily-jackpot-card__state\s*\{[^}]*align-items:\s*center;/,
    );
    expect(css).toMatch(
      /\.daily-jackpot-card__state strong\s*\{[^}]*font-weight:\s*inherit;/,
    );
    expect(css).toMatch(
      /\.daily-jackpot-card__state svg,\s*\.daily-jackpot-card__state-label,\s*\.daily-jackpot-card__state-dot,\s*\.daily-jackpot-card__state strong\s*\{[^}]*line-height:\s*1;/,
    );
    expect(mobileCss).toMatch(
      /\.daily-jackpot-card__state\s*\{[^}]*top:\s*0\.92rem;[^}]*right:\s*0\.82rem;/,
    );
    expect(mobileCss).toMatch(
      /\.daily-jackpot-card__state\s*\{[^}]*display:\s*inline-grid;[^}]*grid-auto-flow:\s*column;[^}]*place-items:\s*center;[^}]*height:\s*1\.56rem;/,
    );
    expect(mobileCss).toMatch(
      /\.daily-jackpot-card__state--countdown\s+\.daily-jackpot-card__state-label\s*\{[^}]*display:\s*none;/,
    );
    expect(mobileCss).toMatch(
      /\.daily-jackpot-card__state--countdown\s+\.daily-jackpot-card__state-dot\s*\{[^}]*display:\s*none;/,
    );
    expect(mobileCss).toMatch(
      /\.daily-jackpot-card__stats\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/,
    );
    expect(mobileCss).toMatch(
      /\.daily-jackpot-card__stats\s*\{[^}]*bottom:\s*3\.28rem;/,
    );
    expect(mobileCss).toMatch(
      /\.daily-jackpot-card__stat\s*\{[^}]*border-right:\s*1px solid/,
    );
    expect(smallMobileCss).toMatch(/\.daily-jackpot-card\s*\{[^}]*min-height:\s*12\.1rem;/);
    expect(smallMobileCss).toMatch(
      /\.daily-jackpot-card__art\s*\{[^}]*top:\s*3\.15rem;[^}]*max-height:\s*5\.8rem;/,
    );
    expect(smallMobileCss).toMatch(
      /\.daily-jackpot-card__price-label-desktop\s*\{[^}]*display:\s*none;/,
    );
    expect(smallMobileCss).toMatch(
      /\.daily-jackpot-card__price-label-mobile\s*\{[^}]*display:\s*inline;/,
    );
  });

  it('shows a draw CTA for a participated finished round without spoiling the winner', () => {
    const onOpenDraw = vi.fn();

    render(
      <DailyJackpotCard
        snapshot={{
          ...snapshot,
          status: 'drawn',
          currentUserHasTicket: true,
          currentUserTicketCount: 1,
          winnerUsername: 'LuckyWinner',
          winningTicketNumber: 7,
        }}
        loading={false}
        buying={false}
        balance={150}
        onBuy={vi.fn()}
        onOpenDraw={onOpenDraw}
      />,
    );

    expect(screen.getByText('Wynik gotowy do obejrzenia')).toBeInTheDocument();
    expect(screen.queryByText(/LuckyWinner/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ticket #7/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Przejdź do losowania/i }));

    expect(onOpenDraw).toHaveBeenCalledWith('pool-1');
  });

  it('allows buying a second ticket when the player has one ticket', () => {
    const onBuy = vi.fn();

    render(
      <DailyJackpotCard
        snapshot={{
          ...snapshot,
          currentUserHasTicket: true,
          currentUserTicketCount: 1,
          currentUserTicketNumber: 12,
          currentUserTicketNumbers: [12],
        }}
        loading={false}
        buying={false}
        balance={150}
        onBuy={onBuy}
      />,
    );

    expect(screen.getByText('Masz 1/2 ticketów')).toBeInTheDocument();
    expect(screen.getByText('#12')).toBeInTheDocument();
    expect(screen.queryByText('1 / 2')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Kup drugi ticket/i }));

    expect(onBuy).toHaveBeenCalledTimes(1);
  });

  it('disables buying after two tickets', () => {
    render(
      <DailyJackpotCard
        snapshot={{
          ...snapshot,
          currentUserHasTicket: true,
          currentUserTicketCount: 2,
          currentUserTicketNumber: 12,
          currentUserTicketNumbers: [12, 18],
        }}
        loading={false}
        buying={false}
        balance={150}
        onBuy={vi.fn()}
      />,
    );

    expect(screen.getByText('Limit ticketów 2/2')).toBeInTheDocument();
    expect(screen.getByText('#12 #18')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Limit ticketów/i })).toBeDisabled();
  });

  it('keeps finished public state spoiler-free for non participants', () => {
    render(
      <DailyJackpotCard
        snapshot={{
          ...snapshot,
          status: 'drawn',
          currentUserHasTicket: false,
          currentUserTicketCount: 0,
          winnerUsername: 'LuckyFox',
          winningTicketNumber: 7,
        }}
        loading={false}
        buying={false}
        balance={50}
        onBuy={vi.fn()}
      />,
    );

    expect(screen.getByText('Losowanie zakończone')).toBeInTheDocument();
    expect(screen.queryByText('Wygrał LuckyFox')).not.toBeInTheDocument();
    expect(screen.queryByText('Ticket #7')).not.toBeInTheDocument();
  });
});
