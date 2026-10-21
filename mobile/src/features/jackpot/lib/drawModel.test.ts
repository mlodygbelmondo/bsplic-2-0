import { describe, expect, it } from 'vitest';

import type { DailyJackpotDraw } from '../types';
import {
  canClaimReward,
  canReuseRevealedDraw,
  getCurrentUserTicketLabels,
  getPoolTicketNumbers,
  getRewardStateLabel,
  getStartButtonLabel,
  getWinnerTicketLabel,
  hasVisibleWinnerDetails,
} from './drawModel';

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
    { userId: 'winner-1', username: 'LuckyWinner', avatarUrl: null, ticketNumbers: [4], ticketCount: 1 },
    { userId: 'user-2', username: 'Mati', avatarUrl: null, ticketNumbers: [3, 1], ticketCount: 2 },
    { userId: 'user-3', username: 'Ania', avatarUrl: null, ticketNumbers: [2], ticketCount: 1 },
  ],
  serverNow: '2026-06-17T18:04:00.000Z',
};

describe('jackpot draw model', () => {
  it('lists every pool ticket in ascending order', () => {
    expect(getPoolTicketNumbers(draw)).toEqual([1, 2, 3, 4]);
  });

  it('shows the current user ticket numbers sorted', () => {
    expect(getCurrentUserTicketLabels(draw, 'user-2')).toEqual(['#01', '#03']);
    expect(getCurrentUserTicketLabels(draw, 'stranger')).toEqual([]);
    expect(getCurrentUserTicketLabels(draw, null)).toEqual([]);
  });

  it('labels the winning ticket padded like the drum, with a fallback', () => {
    expect(getWinnerTicketLabel(4)).toBe('Ticket #04');
    expect(getWinnerTicketLabel(null)).toBe('Ticket zwycięzcy');
  });

  it('lets only the revealed winner claim a pending reward', () => {
    expect(canClaimReward(draw, 'revealed')).toBe(true);
    expect(canClaimReward(draw, 'intro')).toBe(false);
    expect(canClaimReward({ ...draw, currentUserIsWinner: false }, 'revealed')).toBe(false);
    expect(canClaimReward({ ...draw, rewardCreditStatus: 'claimed' }, 'revealed')).toBe(false);
  });

  it('labels the reward state', () => {
    expect(getRewardStateLabel({ ...draw, rewardCreditStatus: 'claimed' })).toBe('Nagroda odebrana');
    expect(getRewardStateLabel({ ...draw, rewardCreditStatus: 'auto_credited' })).toBe(
      'Nagroda została dodana automatycznie',
    );
    expect(getRewardStateLabel(draw)).toBeNull();
  });

  it('hides the pool reward state from players who did not win', () => {
    expect(
      getRewardStateLabel({ ...draw, currentUserIsWinner: false, rewardCreditStatus: 'claimed' }),
    ).toBeNull();
  });

  it('re-reveals a viewed draw whose winner fields are hidden', () => {
    const hiddenWinner = { ...draw, winnerUserId: null, winnerUsername: null, winningTicketNumber: null, resultViewedAt: '2026-06-17T18:05:00.000Z' };

    expect(hasVisibleWinnerDetails(hiddenWinner)).toBe(false);
    expect(canReuseRevealedDraw(hiddenWinner)).toBe(false);
    expect(getStartButtonLabel(hiddenWinner)).toBe('Obejrzyj losowanie');
    expect(canReuseRevealedDraw({ ...draw, resultViewedAt: '2026-06-17T18:05:00.000Z' })).toBe(true);
    expect(getStartButtonLabel(draw)).toBe('Rozpocznij losowanie');
  });
});
