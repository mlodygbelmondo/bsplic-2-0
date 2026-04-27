import { describe, it, expect } from 'vitest';
import { calculateHandValue } from './useBlackjack';
import type { Card } from '@/features/casino/api/blackjack';

const c = (rank: Card['rank'], value: number): Card => ({
  suit: 'hearts',
  rank,
  value,
});

describe('calculateHandValue', () => {
  it('returns 0 for an empty hand', () => {
    expect(calculateHandValue([])).toBe(0);
  });

  it('sums numeric cards', () => {
    expect(calculateHandValue([c('2', 2), c('5', 5), c('9', 9)])).toBe(16);
  });

  it('treats face cards as 10', () => {
    expect(calculateHandValue([c('K', 10), c('Q', 10)])).toBe(20);
  });

  it('counts a single ace as 11 when safe', () => {
    expect(calculateHandValue([c('A', 11), c('9', 9)])).toBe(20);
  });

  it('downgrades an ace from 11 to 1 when total would bust', () => {
    expect(calculateHandValue([c('A', 11), c('9', 9), c('5', 5)])).toBe(15);
  });

  it('handles multiple aces, downgrading only as needed', () => {
    // A + A + 9 -> 11 + 1 + 9 = 21
    expect(calculateHandValue([c('A', 11), c('A', 11), c('9', 9)])).toBe(21);
  });

  it('downgrades aces only as far as needed to avoid bust', () => {
    // A + A + A + 8 -> 1 + 1 + 11 + 8 = 21 (only two aces need downgrading)
    expect(
      calculateHandValue([c('A', 11), c('A', 11), c('A', 11), c('8', 8)])
    ).toBe(21);
  });

  it('downgrades all aces when total still busts', () => {
    // A + A + A + 9 -> 1 + 1 + 1 + 9 = 12 (all aces forced to 1)
    expect(
      calculateHandValue([c('A', 11), c('A', 11), c('A', 11), c('9', 9)])
    ).toBe(12);
  });

  it('detects natural blackjack (A + 10-value) as 21', () => {
    expect(calculateHandValue([c('A', 11), c('K', 10)])).toBe(21);
  });

  it('returns a busted total when no aces can save the hand', () => {
    expect(calculateHandValue([c('K', 10), c('Q', 10), c('5', 5)])).toBe(25);
  });
});
