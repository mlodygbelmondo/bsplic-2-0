import { describe, expect, it } from "vitest";

import {
  computeRouletteBallRotation,
  computeRouletteBallSettledRotation,
  computeRouletteWheelRotation,
  getRouletteBallAngleOffset,
  getRouletteBallPocketAngle,
  getRouletteWheelTargetAngle,
  ROULETTE_BALL_DEFAULT_ANGLE_OFFSET_DEG,
  ROULETTE_BALL_NUMBER_ANGLE_OFFSETS_DEG,
  ROULETTE_WHEEL_NUMBERS,
} from "@/features/casino/lib/rouletteWheel";

const normalizeRotation = (rotation: number) => ((rotation % 360) + 360) % 360;

describe("computeRouletteBallRotation", () => {
  it("lands the static-wheel ball on the winning pocket after full spins", () => {
    const targetIndex = ROULETTE_WHEEL_NUMBERS.indexOf(13);
    const rotation = computeRouletteBallRotation(0, targetIndex);

    expect(rotation).toBeGreaterThan(360 * 3);
    expect(normalizeRotation(rotation)).toBeCloseTo(
      getRouletteBallPocketAngle(targetIndex),
      4,
    );
  });

  it("maps known PNG pocket centers clockwise from zero at the top", () => {
    expect(
      getRouletteBallPocketAngle(ROULETTE_WHEEL_NUMBERS.indexOf(0)),
    ).toBeCloseTo(0, 4);
    expect(
      getRouletteBallPocketAngle(ROULETTE_WHEEL_NUMBERS.indexOf(13)),
    ).toBeCloseTo(116.7568, 4);
    expect(
      getRouletteBallPocketAngle(ROULETTE_WHEEL_NUMBERS.indexOf(26)),
    ).toBeCloseTo(350.2703, 4);
  });

  it("settles forward to the target pocket without jumping backward", () => {
    const targetIndex = ROULETTE_WHEEL_NUMBERS.indexOf(13);
    const rotation = computeRouletteBallSettledRotation(1700, targetIndex);

    expect(rotation).toBeGreaterThanOrEqual(1700);
    expect(normalizeRotation(rotation)).toBeCloseTo(
      getRouletteBallPocketAngle(targetIndex),
      4,
    );
  });

  it("lands every roulette number on its exact PNG pocket angle", () => {
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
      expect(
        settledRotation,
        `settled progresses ${number}`,
      ).toBeGreaterThanOrEqual(731.25);
    });
  });

  it("keeps the ball aligned with every pocket of a rotated wheel", () => {
    const wheelRotation = computeRouletteWheelRotation(0, "round-abc");

    ROULETTE_WHEEL_NUMBERS.forEach((number, targetIndex) => {
      const spinRotation = computeRouletteBallRotation(
        731.25,
        targetIndex,
        wheelRotation,
      );
      const settledRotation = computeRouletteBallSettledRotation(
        731.25,
        targetIndex,
        wheelRotation,
      );
      const expected = normalizeRotation(
        getRouletteBallPocketAngle(targetIndex) + wheelRotation,
      );

      expect(normalizeRotation(spinRotation), `spin ${number}`).toBeCloseTo(
        expected,
        4,
      );
      expect(
        normalizeRotation(settledRotation),
        `settled ${number}`,
      ).toBeCloseTo(expected, 4);
      expect(spinRotation, `spin progresses ${number}`).toBeGreaterThan(731.25);
    });
  });

  it("uses a default ball angle offset when a number has no override", () => {
    expect(ROULETTE_BALL_DEFAULT_ANGLE_OFFSET_DEG).toBe(-1);
    expect(ROULETTE_BALL_NUMBER_ANGLE_OFFSETS_DEG[4]).toBeUndefined();
    expect(getRouletteBallAngleOffset(4)).toBe(-1);
  });

  it("uses per-number ball angle offsets as absolute final offsets", () => {
    expect(getRouletteBallAngleOffset(10, { 10: -2 })).toBe(-2);
    expect(getRouletteBallAngleOffset(13, { 10: -2 })).toBe(-1);
  });
});

describe("computeRouletteWheelRotation", () => {
  it("derives the same resting angle for the same round on every client", () => {
    expect(getRouletteWheelTargetAngle("round-1")).toBe(
      getRouletteWheelTargetAngle("round-1"),
    );
    expect(getRouletteWheelTargetAngle("round-1")).toBeGreaterThanOrEqual(0);
    expect(getRouletteWheelTargetAngle("round-1")).toBeLessThan(360);
  });

  it("spins counter-clockwise with at least two full revolutions", () => {
    const rotation = computeRouletteWheelRotation(0, "round-xyz");

    expect(rotation).toBeLessThanOrEqual(-360 * 2);
    expect(normalizeRotation(rotation)).toBeCloseTo(
      getRouletteWheelTargetAngle("round-xyz"),
      4,
    );
  });

  it("continues counter-clockwise from any previous resting angle", () => {
    const first = computeRouletteWheelRotation(0, "round-a");
    const second = computeRouletteWheelRotation(first, "round-b");

    expect(second).toBeLessThan(first);
    expect(normalizeRotation(second)).toBeCloseTo(
      getRouletteWheelTargetAngle("round-b"),
      4,
    );
  });
});
