import { describe, expect, it } from 'vitest';

import {
  findAkoConflict,
  formatAkoConflictMessage,
  shouldBlockAkoCoupon,
  type AkoExclusion,
  type AkoSelection,
} from './akoExclusions';

const selections: AkoSelection[] = [
  { betId: 'bet-a', title: 'Team X wygra mapę 1' },
  { betId: 'bet-b', title: 'Team X wygra mecz' },
  { betId: 'bet-c', title: 'Team Y wygra mapę 2' },
];

describe('AKO exclusions', () => {
  it('returns null when no selected pair is blocked', () => {
    const exclusions: AkoExclusion[] = [
      { betIdA: 'bet-a', betIdB: 'bet-z', reason: null },
    ];

    expect(findAkoConflict(selections, exclusions)).toBeNull();
  });

  it('finds a blocked selected pair and keeps display titles', () => {
    const exclusions: AkoExclusion[] = [
      { betIdA: 'bet-a', betIdB: 'bet-b', reason: 'Ten sam mecz' },
    ];

    expect(findAkoConflict(selections, exclusions)).toEqual({
      betIdA: 'bet-a',
      betIdB: 'bet-b',
      titleA: 'Team X wygra mapę 1',
      titleB: 'Team X wygra mecz',
      reason: 'Ten sam mecz',
    });
  });

  it('treats exclusion pairs as unordered', () => {
    const exclusions: AkoExclusion[] = [
      { betIdA: 'bet-b', betIdB: 'bet-a', reason: null },
    ];

    expect(findAkoConflict(selections, exclusions)).toMatchObject({
      betIdA: 'bet-a',
      betIdB: 'bet-b',
    });
  });

  it('does not block single coupons', () => {
    const exclusions: AkoExclusion[] = [
      { betIdA: 'bet-a', betIdB: 'bet-b', reason: null },
    ];

    expect(shouldBlockAkoCoupon('single', selections, exclusions)).toBe(false);
    expect(shouldBlockAkoCoupon('ako', [selections[0]], exclusions)).toBe(
      false,
    );
  });

  it('formats a Polish warning with reason when available', () => {
    const conflict = {
      betIdA: 'bet-a',
      betIdB: 'bet-b',
      titleA: 'Team X wygra mapę 1',
      titleB: 'Team X wygra mecz',
      reason: 'Ten sam mecz',
    };

    expect(formatAkoConflictMessage(conflict)).toBe(
      'Tych zdarzeń nie można łączyć na AKO: Team X wygra mapę 1 + Team X wygra mecz. Powód: Ten sam mecz',
    );
  });
});
