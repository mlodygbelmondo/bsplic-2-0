import { describe, expect, it } from 'vitest';

import { getBetStatus } from './status';

describe('getBetStatus', () => {
  it('shows a refund before any other winner state', () => {
    expect(getBetStatus({ winning_option: '__refund__', is_active: true })).toBe('refund');
    expect(getBetStatus({ winning_option: '["Lech","__refund__"]', is_active: false })).toBe('refund');
  });

  it('shows a forced loss for everyone', () => {
    expect(getBetStatus({ winning_option: '__all_lost__', is_active: false })).toBe('lost');
  });

  it('shows a resolved bet even when it is still flagged active', () => {
    expect(getBetStatus({ winning_option: 'Legia', is_active: true })).toBe('resolved');
  });

  it('falls back to active or closed without a winner', () => {
    expect(getBetStatus({ winning_option: null, is_active: true })).toBe('active');
    expect(getBetStatus({ winning_option: null, is_active: false })).toBe('closed');
  });
});
