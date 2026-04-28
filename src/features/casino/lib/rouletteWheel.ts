export const ROULETTE_WHEEL_NUMBERS = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24,
  16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

const SEGMENT_ANGLE = 360 / ROULETTE_WHEEL_NUMBERS.length;
const BALL_FULL_SPINS = 4;

export type RouletteBallAngleOffsets = Partial<Record<number, number>>;

export const ROULETTE_BALL_DEFAULT_ANGLE_OFFSET_DEG = -1;
export const ROULETTE_BALL_NUMBER_ANGLE_OFFSETS_DEG: RouletteBallAngleOffsets =
  {
    0: -0.5,
    1: 2,
    2: -2,
    3: 0,
    6: -3,
    7: 0,
    8: -2,
    9: 0,
    10: -2,
    11: -5,
    12: -0.5,
    13: -4,
    14: 1,
    16: 2,
    17: -2,
    18: 0,
    20: 1,
    22: 0,
    23: -4,
    24: 1,
    25: -2,
    27: -3.5,
    28: -0.5,
    29: 0,
    30: -5,
    31: 1,
    32: 0,
    33: 2,
    34: -2.3,
    35: -0.5,
    36: -4.5,
  };

const normalizeRotation = (rotation: number) => ((rotation % 360) + 360) % 360;

export function getRouletteWheelSegmentAngle() {
  return SEGMENT_ANGLE;
}

export function getRouletteBallPocketAngle(targetIdx: number) {
  return targetIdx * SEGMENT_ANGLE;
}

export function getRouletteBallAngleOffset(
  targetNumber: number,
  angleOffsetsDeg: RouletteBallAngleOffsets = ROULETTE_BALL_NUMBER_ANGLE_OFFSETS_DEG,
) {
  return (
    angleOffsetsDeg[targetNumber] ?? ROULETTE_BALL_DEFAULT_ANGLE_OFFSET_DEG
  );
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
