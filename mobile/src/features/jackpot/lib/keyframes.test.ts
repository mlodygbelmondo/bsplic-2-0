import { describe, expect, it } from 'vitest';

import { cubicBezier, sampleWinningTicketPop } from './keyframes';

describe('draw keyframes', () => {
  it('solves CSS cubic-bezier easings', () => {
    // Reference values of the CSS `ease` and `ease-in-out` curves.
    expect(cubicBezier(0.25, 0.1, 0.25, 1, 0.5)).toBeCloseTo(0.8024, 3);
    expect(cubicBezier(0.42, 0, 0.58, 1, 0.5)).toBeCloseTo(0.5, 5);
    expect(cubicBezier(0.42, 0, 0.58, 1, 0.25)).toBeCloseTo(0.1291, 3);
    expect(cubicBezier(0.18, 0.85, 0.2, 1.18, 0)).toBe(0);
    expect(cubicBezier(0.18, 0.85, 0.2, 1.18, 1)).toBe(1);
  });

  it('pops the winning ticket from small and tilted to rest', () => {
    expect(sampleWinningTicketPop(0)).toEqual({ opacity: 0, translateY: 22.4, scale: 0.58, rotate: -7, brightness: 1.18 });
    const peak = sampleWinningTicketPop(0.58);
    expect(peak.opacity).toBe(1);
    expect(peak.scale).toBeCloseTo(1.08);
    expect(peak.translateY).toBeCloseTo(-5.6);
    expect(sampleWinningTicketPop(1)).toEqual({ opacity: 1, translateY: 0, scale: 1, rotate: 0, brightness: 1 });
  });
});
