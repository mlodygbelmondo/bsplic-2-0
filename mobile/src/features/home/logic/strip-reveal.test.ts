import { describe, expect, it } from 'vitest';

import { getStripRevealOffset } from './strip-reveal';

// A 390 pt strip scrolled to 200 over 1000 pt of content: 200–590 is visible.
const STRIP = { offset: 200, viewportWidth: 390, contentWidth: 1000 };

describe('getStripRevealOffset', () => {
  it('leaves the strip alone when the item and its margins are already visible', () => {
    expect(getStripRevealOffset(STRIP, { x: 300, width: 56 })).toBeNull();
  });

  it('scrolls back so an item cut off on the left shows with 24 pt of room', () => {
    expect(getStripRevealOffset(STRIP, { x: 210, width: 56 })).toBe(186);
  });

  it('scrolls forward so an item cut off on the right shows with 24 pt of room', () => {
    // Item ends at 600; plus the margin it needs the viewport to end at 624.
    expect(getStripRevealOffset(STRIP, { x: 544, width: 56 })).toBe(234);
  });

  it('never scrolls before the start of the strip', () => {
    expect(getStripRevealOffset(STRIP, { x: 12, width: 56 })).toBe(0);
  });

  it('never scrolls past the end of the content', () => {
    expect(getStripRevealOffset(STRIP, { x: 932, width: 56 })).toBe(610);
  });
});
