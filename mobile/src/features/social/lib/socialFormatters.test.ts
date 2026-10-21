import { describe, expect, it } from 'vitest';

import { formatCommentCount, formatEventsCount, formatSocialTimeAgo } from './socialFormatters';

describe('Polish counts', () => {
  it('picks the comment form for 1, 2-4, 5+ and the teens', () => {
    expect(formatCommentCount(1)).toBe('komentarz');
    expect(formatCommentCount(3)).toBe('komentarze');
    expect(formatCommentCount(5)).toBe('komentarzy');
    expect(formatCommentCount(12)).toBe('komentarzy');
    expect(formatCommentCount(22)).toBe('komentarze');
    expect(formatCommentCount(0)).toBe('komentarzy');
  });

  it('prefixes the event count with the number', () => {
    expect(formatEventsCount(1)).toBe('1 zdarzenie');
    expect(formatEventsCount(4)).toBe('4 zdarzenia');
    expect(formatEventsCount(14)).toBe('14 zdarzeń');
  });
});

describe('formatSocialTimeAgo', () => {
  const now = new Date('2030-01-10T12:00:00.000Z').getTime();

  it('uses minutes, hours and days before a date', () => {
    expect(formatSocialTimeAgo('2030-01-10T11:59:30.000Z', now)).toBe('przed chwilą');
    expect(formatSocialTimeAgo('2030-01-10T11:15:00.000Z', now)).toBe('45 min temu');
    expect(formatSocialTimeAgo('2030-01-10T07:00:00.000Z', now)).toBe('5 godz. temu');
    expect(formatSocialTimeAgo('2030-01-07T12:00:00.000Z', now)).toBe('3 dn. temu');
  });

  it('falls back to a Polish date after a week', () => {
    expect(formatSocialTimeAgo('2030-01-01T12:00:00.000Z', now)).toBe('1.01.2030');
  });
});
