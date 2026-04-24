import { describe, expect, it } from 'vitest';

import {
  computeRouletteTargetRotation,
  getRouletteWheelSegmentAngle,
  ROULETTE_WHEEL_NUMBERS,
} from '@/features/casino/lib/rouletteWheel';

const normalizeRotation = (rotation: number) => ((rotation % 360) + 360) % 360;

describe('computeRouletteTargetRotation', () => {
  it('aligns the winning segment center with the top pointer', () => {
    const targetIndex = ROULETTE_WHEEL_NUMBERS.indexOf(11);
    const segmentAngle = getRouletteWheelSegmentAngle();
    const segmentCenter = targetIndex * segmentAngle + segmentAngle / 2;

    const rotation = computeRouletteTargetRotation(0, targetIndex);

    expect(normalizeRotation(segmentCenter + rotation)).toBeCloseTo(270, 4);
  });
});
