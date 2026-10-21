import { describe, expect, it } from 'vitest';

import { canClaimTopup, getPolishDateString } from './polish-day';

describe('getPolishDateString', () => {
  it('returns YYYY-MM-DD format', () => {
    const result = getPolishDateString(new Date('2026-03-16T12:00:00Z'));
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('handles midnight UTC which is 01:00 in CET (winter)', () => {
    // 2026-01-15T00:00:00Z → in Warsaw (CET, UTC+1) = 2026-01-15 01:00
    expect(getPolishDateString(new Date('2026-01-15T00:00:00Z'))).toBe('2026-01-15');
  });

  it('handles 23:30 UTC which is next day in CET (winter)', () => {
    // 2026-01-15T23:30:00Z → Warsaw CET = 2026-01-16 00:30
    expect(getPolishDateString(new Date('2026-01-15T23:30:00Z'))).toBe('2026-01-16');
  });

  it('handles summer time (CEST, UTC+2)', () => {
    // 2026-07-15T22:30:00Z → Warsaw CEST = 2026-07-16 00:30
    expect(getPolishDateString(new Date('2026-07-15T22:30:00Z'))).toBe('2026-07-16');
  });

  it('handles summer time before midnight Warsaw', () => {
    // 2026-07-15T21:30:00Z → Warsaw CEST = 2026-07-15 23:30
    expect(getPolishDateString(new Date('2026-07-15T21:30:00Z'))).toBe('2026-07-15');
  });

  it('zero-pads single-digit months and days', () => {
    expect(getPolishDateString(new Date('2026-02-03T12:00:00Z'))).toBe('2026-02-03');
  });
});

describe('canClaimTopup', () => {
  it('returns true when lastTopupAt is null', () => {
    expect(canClaimTopup(null)).toBe(true);
  });

  it('returns true when lastTopupAt is undefined', () => {
    expect(canClaimTopup(undefined)).toBe(true);
  });

  it('returns false when claimed on the same Polish day', () => {
    // Claimed at 10:00 Warsaw, checking at 14:00 Warsaw (same day)
    const lastTopup = '2026-03-16T09:00:00Z';
    const now = new Date('2026-03-16T13:00:00Z');
    expect(canClaimTopup(lastTopup, now)).toBe(false);
  });

  it('returns true when it is a new Polish day', () => {
    // Claimed at 23:00 Warsaw on Mar 15, checking at 00:30 Warsaw on Mar 16
    const lastTopup = '2026-03-15T22:00:00Z';
    const now = new Date('2026-03-15T23:30:00Z');
    expect(canClaimTopup(lastTopup, now)).toBe(true);
  });

  it('returns true for the reported bug scenario (00:56 Polish time)', () => {
    // Claimed at 01:30 Warsaw yesterday, tries at 00:56 Warsaw today
    const lastTopup = '2026-03-15T00:30:00Z';
    const now = new Date('2026-03-15T23:56:00Z');
    expect(canClaimTopup(lastTopup, now)).toBe(true);
  });

  it('returns false when less than a day has passed but same Polish day', () => {
    // Claimed at 00:05 Warsaw, checking at 23:55 Warsaw (same day)
    const lastTopup = '2026-03-15T23:05:00Z';
    const now = new Date('2026-03-16T22:55:00Z');
    expect(canClaimTopup(lastTopup, now)).toBe(false);
  });

  it('handles summer time transition day', () => {
    // CEST starts on 2026-03-29. Claimed 01:00 Warsaw on Mar 28 (CET),
    // checking at 01:30 Warsaw on Mar 29 (CEST).
    const lastTopup = '2026-03-28T00:00:00Z';
    const now = new Date('2026-03-28T23:30:00Z');
    expect(canClaimTopup(lastTopup, now)).toBe(true);
  });

  it('handles ISO string with timezone offset', () => {
    const lastTopup = '2026-03-16T10:00:00+01:00';
    const now = new Date('2026-03-16T13:00:00Z');
    expect(canClaimTopup(lastTopup, now)).toBe(false);
  });

  it('compares across month boundaries', () => {
    // Claimed on Jan 31 (Warsaw), checking on Feb 1 (Warsaw)
    const lastTopup = '2026-01-31T12:00:00Z';
    const now = new Date('2026-02-01T08:00:00Z');
    expect(canClaimTopup(lastTopup, now)).toBe(true);
  });
});
