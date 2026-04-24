export const ROULETTE_WHEEL_NUMBERS = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
  24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

const SEGMENT_ANGLE = 360 / ROULETTE_WHEEL_NUMBERS.length;
const FULL_SPINS = 5;
const POINTER_ANGLE = 270;

export function getRouletteWheelSegmentAngle() {
  return SEGMENT_ANGLE;
}

export function computeRouletteTargetRotation(
  fromRotation: number,
  targetIdx: number,
) {
  const currentBase = fromRotation % 360;
  const targetSegmentCenter = targetIdx * SEGMENT_ANGLE + SEGMENT_ANGLE / 2;
  const targetBase = POINTER_ANGLE - targetSegmentCenter;
  let delta = targetBase - currentBase;
  if (delta > 0) delta -= 360;
  return fromRotation + delta - FULL_SPINS * 360;
}
