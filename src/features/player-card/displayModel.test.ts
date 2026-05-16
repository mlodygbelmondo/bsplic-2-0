import { describe, expect, it } from 'vitest';

import { derivePlayerCardDisplayModel } from './displayModel';

describe('derivePlayerCardDisplayModel', () => {
  it('returns display-ready metrics and a positive-result archetype', () => {
    const card = derivePlayerCardDisplayModel({
      totalBets: 12,
      wins: 7,
      winRate: 58.3,
      totalProfit: 146.5,
      currentStreak: 1,
    });

    expect(card).toEqual({
      profit: 146.5,
      winRate: 58.3,
      currentStreak: 1,
      totalCoupons: 12,
      wins: 7,
      archetype: {
        key: 'na-plusie',
        label: 'Na plusie',
      },
    });
  });

  it('chooses a streak archetype for players on a strong streak', () => {
    const card = derivePlayerCardDisplayModel({
      totalBets: 10,
      wins: 5,
      winRate: 50,
      totalProfit: 0,
      currentStreak: 3,
    });

    expect(card.archetype).toEqual({
      key: 'na-fali',
      label: 'Na fali',
    });
  });

  it('chooses an experience archetype for established players without stronger signals', () => {
    const card = derivePlayerCardDisplayModel({
      totalBets: 25,
      wins: 11,
      winRate: 44,
      totalProfit: -12,
      currentStreak: 1,
    });

    expect(card.archetype).toEqual({
      key: 'weteran-kuponow',
      label: 'Weteran kuponów',
    });
  });

  it('returns a deliberate low-data archetype for players with no history', () => {
    const card = derivePlayerCardDisplayModel({
      totalBets: 0,
      wins: 0,
      winRate: 0,
      totalProfit: 0,
      currentStreak: 0,
    });

    expect(card).toEqual({
      profit: 0,
      winRate: 0,
      currentStreak: 0,
      totalCoupons: 0,
      wins: 0,
      archetype: {
        key: 'nowy-gracz',
        label: 'Nowy gracz',
      },
    });
  });

  it('prioritizes result over streak and experience when multiple signals apply', () => {
    const card = derivePlayerCardDisplayModel({
      totalBets: 40,
      wins: 24,
      winRate: 60,
      totalProfit: 320,
      currentStreak: 5,
    });

    expect(card.archetype).toEqual({
      key: 'na-plusie',
      label: 'Na plusie',
    });
  });

  it('prioritizes streak over experience when both signals apply', () => {
    const card = derivePlayerCardDisplayModel({
      totalBets: 40,
      wins: 17,
      winRate: 42.5,
      totalProfit: -20,
      currentStreak: 4,
    });

    expect(card.archetype).toEqual({
      key: 'na-fali',
      label: 'Na fali',
    });
  });
});
