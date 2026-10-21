import { describe, expect, it } from 'vitest';

import {
  getInitialReactorsEmoji,
  getReactorsRouteParams,
  getSocialItemPath,
  parseReactorsRouteParams,
} from './routes';

describe('social routes', () => {
  it('encodes the item path like the web link', () => {
    expect(getSocialItemPath('coupon', 'a b/c')).toBe('/social/coupon/a%20b%2Fc');
  });

  it('opens the reactors sheet on the first reaction type in picker order, not the most used one', () => {
    expect(getInitialReactorsEmoji({ fire: 9, heart: 1 })).toBe('heart');
    expect(getInitialReactorsEmoji({ like: 0, sad: 2 })).toBe('sad');
    expect(getInitialReactorsEmoji({ like: 0 })).toBeNull();
    expect(getInitialReactorsEmoji(null)).toBeNull();
  });

  it('round-trips reactors params and leaves out absent ids', () => {
    const params = getReactorsRouteParams({ couponId: 'coupon-1' }, 'wow');
    expect(params).toEqual({ couponId: 'coupon-1', initial: 'wow' });
    expect(parseReactorsRouteParams(params)).toEqual({
      target: { postId: undefined, couponId: 'coupon-1', casinoShareId: undefined, commentId: undefined },
      initial: 'wow',
    });
  });

  it('rejects params without a target and ignores unknown emoji', () => {
    expect(parseReactorsRouteParams({ initial: 'like' })).toBeNull();
    expect(parseReactorsRouteParams({ commentId: ['comment-1', 'x'], initial: 'smile' })).toEqual({
      target: { postId: undefined, couponId: undefined, casinoShareId: undefined, commentId: 'comment-1' },
      initial: null,
    });
  });
});
