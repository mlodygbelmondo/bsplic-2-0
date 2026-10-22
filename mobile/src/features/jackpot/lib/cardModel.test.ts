import { describe, expect, it } from 'vitest';

import type { DailyJackpotSnapshot } from '../types';
import { getCountdownMs, getDailyJackpotCardModel, getPurchasedTicketLabel, isJackpotSnapshotCurrent } from './cardModel';

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

describe('daily jackpot card model', () => {
  it('lets a player buy the first ticket of a collecting pool', () => {
    const model = getDailyJackpotCardModel(snapshot, 150, false);

    expect(model.buttonLabel).toBe('Kup ticket');
    expect(model.canBuy).toBe(true);
    expect(model.actionEnabled).toBe(true);
    expect(model.actionIsDraw).toBe(false);
    expect(model.statusLabel).toBe('Zbieramy tickety');
    expect(model.currentUserTicketLabel).toBeNull();
  });

  it('allows buying a second ticket when the player has one ticket', () => {
    const model = getDailyJackpotCardModel(
      { ...snapshot, currentUserHasTicket: true, currentUserTicketCount: 1, currentUserTicketNumber: 12, currentUserTicketNumbers: [12] },
      150,
      false,
    );

    expect(model.buttonLabel).toBe('Kup drugi ticket');
    expect(model.currentUserTicketLabel).toBe('#12');
    expect(model.statusLabel).toBe('Jesteś w grze');
    expect(model.canBuy).toBe(true);
  });

  it('disables buying after two tickets', () => {
    const model = getDailyJackpotCardModel(
      { ...snapshot, currentUserHasTicket: true, currentUserTicketCount: 2, currentUserTicketNumber: 12, currentUserTicketNumbers: [12, 18] },
      150,
      false,
    );

    expect(model.buttonLabel).toBe('Limit ticketów wykorzystany');
    expect(model.legacyLimitLabel).toBe('Limit ticketów 2/2');
    expect(model.currentUserTicketLabel).toBe('#12 #18');
    expect(model.actionEnabled).toBe(false);
  });

  it('falls back to the single ticket number when the list is empty', () => {
    const model = getDailyJackpotCardModel(
      { ...snapshot, currentUserTicketCount: 1, currentUserTicketNumber: 7, currentUserTicketNumbers: [] },
      150,
      false,
    );

    expect(model.currentUserTicketLabel).toBe('#07');
  });

  it('blocks buying without enough balance and while a purchase runs', () => {
    expect(getDailyJackpotCardModel(snapshot, 99.99, false)).toMatchObject({
      buttonLabel: 'Brak środków na ticket',
      actionEnabled: false,
    });
    expect(getDailyJackpotCardModel(snapshot, 150, true)).toMatchObject({ canBuy: false, actionEnabled: false });
  });

  it('opens the draw for a participated finished round without spoiling the winner', () => {
    const model = getDailyJackpotCardModel(
      { ...snapshot, status: 'drawn', currentUserHasTicket: true, currentUserTicketCount: 1, winnerUsername: 'LuckyWinner', winningTicketNumber: 7 },
      150,
      false,
    );

    expect(model.statusLabel).toBe('Wynik gotowy do obejrzenia');
    expect(model.buttonLabel).toBe('Przejdź do losowania');
    expect(model.actionIsDraw).toBe(true);
    expect(JSON.stringify(model)).not.toMatch(/LuckyWinner|#07|Ticket #7/);
  });

  it('keeps finished public state spoiler-free for non participants', () => {
    const model = getDailyJackpotCardModel(
      { ...snapshot, status: 'drawn', winnerUsername: 'LuckyFox', winningTicketNumber: 7 },
      50,
      false,
    );

    expect(model.statusLabel).toBe('Losowanie zakończone');
    expect(model.buttonLabel).toBe('Obejrzyj losowanie');
    expect(JSON.stringify(model)).not.toMatch(/LuckyFox/);
  });

  it('opens the rollover settlement only for participants', () => {
    const rolledOver = { ...snapshot, status: 'rolled_over' as const };

    expect(
      getDailyJackpotCardModel({ ...rolledOver, currentUserHasTicket: true, currentUserTicketCount: 1 }, 150, false),
    ).toMatchObject({ statusLabel: 'Pula przechodzi dalej', buttonLabel: 'Zobacz rozliczenie', actionEnabled: true });
    expect(getDailyJackpotCardModel(rolledOver, 150, false)).toMatchObject({
      buttonLabel: 'Pula przechodzi dalej',
      actionEnabled: false,
    });
  });

  it('labels locked and cancelled pools', () => {
    expect(getDailyJackpotCardModel({ ...snapshot, status: 'locked' }, 150, false)).toMatchObject({
      statusLabel: 'Losowanie trwa',
      buttonLabel: 'Losowanie trwa',
      actionEnabled: false,
    });
    expect(getDailyJackpotCardModel({ ...snapshot, status: 'cancelled' }, 150, false)).toMatchObject({
      statusLabel: 'Pula anulowana',
      buttonLabel: 'Pula anulowana',
      actionEnabled: false,
    });
  });

  it('confirms the newly bought ticket number', () => {
    const before = { ...snapshot, currentUserTicketCount: 1, currentUserTicketNumber: 14, currentUserTicketNumbers: [14] };
    const after = { ...before, currentUserTicketCount: 2, currentUserTicketNumbers: [14, 22] };

    expect(getPurchasedTicketLabel(before, after)).toBe('#22');
    expect(getPurchasedTicketLabel(snapshot, { ...snapshot, currentUserTicketNumber: null })).toBeNull();
  });

  it('counts down from the server clock in whole elapsed seconds', () => {
    const receivedAt = 1_000_000;

    expect(getCountdownMs(snapshot, receivedAt, receivedAt)).toBe(8 * 3600_000);
    expect(getCountdownMs(snapshot, receivedAt, receivedAt + 61_900)).toBe(8 * 3600_000 - 61_000);
    expect(getCountdownMs({ ...snapshot, serverNow: 'not a date' }, receivedAt, receivedAt)).toBeNull();
  });
});

describe('isJackpotSnapshotCurrent', () => {
  // 2026-06-17 12:00 in Warsaw (UTC+2).
  const noon = Date.parse('2026-06-17T10:00:00.000Z');

  it("shows a cached snapshot of today's pool before its draw", () => {
    expect(isJackpotSnapshotCurrent(snapshot, noon)).toBe(true);
  });

  it('refuses a live pool whose draw time has passed', () => {
    expect(isJackpotSnapshotCurrent(snapshot, Date.parse('2026-06-17T18:00:01.000Z'))).toBe(false);
    expect(isJackpotSnapshotCurrent({ ...snapshot, status: 'drawn' }, Date.parse('2026-06-17T19:00:00.000Z'))).toBe(true);
  });

  it("refuses yesterday's pool after midnight in Warsaw", () => {
    // 00:30 on 18 June in Warsaw is still 17 June in UTC.
    expect(isJackpotSnapshotCurrent({ ...snapshot, status: 'drawn' }, Date.parse('2026-06-17T22:30:00.000Z'))).toBe(false);
  });
});
