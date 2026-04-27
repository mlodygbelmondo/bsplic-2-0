export const ROULETTE_WHEEL_NUMBERS = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
  24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

const SEGMENT_ANGLE = 360 / ROULETTE_WHEEL_NUMBERS.length;
const BALL_FULL_SPINS = 4;

const normalizeRotation = (rotation: number) =>
  ((rotation % 360) + 360) % 360;

export function getRouletteWheelSegmentAngle() {
  return SEGMENT_ANGLE;
}

export function getRouletteBallPocketAngle(targetIdx: number) {
  return targetIdx * SEGMENT_ANGLE;
}

export function computeRouletteBallRotation(
  fromRotation: number,
  targetIdx: number,
) {
  const currentBase = normalizeRotation(fromRotation);
  const targetBase = getRouletteBallPocketAngle(targetIdx);
  let delta = targetBase - currentBase;
  if (delta < 0) delta += 360;
  return fromRotation + delta + BALL_FULL_SPINS * 360;
}

export function computeRouletteBallSettledRotation(
  fromRotation: number,
  targetIdx: number,
) {
  const currentBase = normalizeRotation(fromRotation);
  const targetBase = getRouletteBallPocketAngle(targetIdx);
  let delta = targetBase - currentBase;
  if (delta < 0) delta += 360;
  return fromRotation + delta;
}
