import { describe, expect, it } from 'vitest';

import { formatBadgeDate, formatJoinDate } from './format';

// Local-time instants so the expected day does not depend on the test machine's zone.
const JAN_5 = new Date(2026, 0, 5, 12).toISOString();
const MAY_1 = new Date(2026, 4, 1, 12).toISOString();

describe('profile dates', () => {
  it('formats the join date like pl-PL toLocaleDateString (unpadded day)', () => {
    expect(formatJoinDate(JAN_5)).toBe('5.01.2026');
  });

  it('formats badge unlock dates with a two-digit day and month', () => {
    expect(formatBadgeDate(MAY_1)).toBe('01.05.2026');
  });
});
