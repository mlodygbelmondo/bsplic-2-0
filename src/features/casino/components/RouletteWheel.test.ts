import { describe, expect, it } from 'vitest';

import {
  computeRouletteBallRotation,
  computeRouletteBallSettledRotation,
  getRouletteBallPocketAngle,
  ROULETTE_WHEEL_NUMBERS,
} from '@/features/casino/lib/rouletteWheel';

const normalizeRotation = (rotation: number) => ((rotation % 360) + 360) % 360;

describe('computeRouletteBallRotation', () => {
  it('lands the static-wheel ball on the winning pocket after full spins', () => {
    const targetIndex = ROULETTE_WHEEL_NUMBERS.indexOf(13);
    const rotation = computeRouletteBallRotation(0, targetIndex);

    expect(rotation).toBeGreaterThan(360 * 3);
    expect(normalizeRotation(rotation)).toBeCloseTo(
      getRouletteBallPocketAngle(targetIndex),
      4,
    );
  });

  it('maps known PNG pocket centers clockwise from zero at the top', () => {
    expect(getRouletteBallPocketAngle(ROULETTE_WHEEL_NUMBERS.indexOf(0))).toBeCloseTo(0, 4);
    expect(getRouletteBallPocketAngle(ROULETTE_WHEEL_NUMBERS.indexOf(13))).toBeCloseTo(116.7568, 4);
    expect(getRouletteBallPocketAngle(ROULETTE_WHEEL_NUMBERS.indexOf(26))).toBeCloseTo(350.2703, 4);
  });

  it('settles forward to the target pocket without jumping backward', () => {
    const targetIndex = ROULETTE_WHEEL_NUMBERS.indexOf(13);
    const rotation = computeRouletteBallSettledRotation(1700, targetIndex);

    expect(rotation).toBeGreaterThanOrEqual(1700);
    expect(normalizeRotation(rotation)).toBeCloseTo(
      getRouletteBallPocketAngle(targetIndex),
      4,
    );
  });

  it('lands every roulette number on its exact PNG pocket angle', () => {
    ROULETTE_WHEEL_NUMBERS.forEach((number, targetIndex) => {
      const spinRotation = computeRouletteBallRotation(731.25, targetIndex);
      const settledRotation = computeRouletteBallSettledRotation(
        731.25,
        targetIndex,
      );

      expect(normalizeRotation(spinRotation), `spin ${number}`).toBeCloseTo(
        getRouletteBallPocketAngle(targetIndex),
        4,
      );
      expect(
        normalizeRotation(settledRotation),
        `settled ${number}`,
      ).toBeCloseTo(getRouletteBallPocketAngle(targetIndex), 4);
      expect(spinRotation, `spin progresses ${number}`).toBeGreaterThan(731.25);
      expect(settledRotation, `settled progresses ${number}`).toBeGreaterThanOrEqual(731.25);
    });
  });
});
