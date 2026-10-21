/**
 * CSS keyframe math for the draw page (`@keyframes jackpot-winning-ticket-pop`).
 * Every function is a worklet so poses are computed on the UI thread.
 */

/** CSS `cubic-bezier()` easing (WebKit UnitBezier solver). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number, t: number): number {
  'worklet';
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (s: number) => ((ax * s + bx) * s + cx) * s;

  // Newton-Raphson, then bisection when the slope is too flat.
  let s = t;
  for (let i = 0; i < 8; i += 1) {
    const error = sampleX(s) - t;
    if (Math.abs(error) < 1e-6) return ((ay * s + by) * s + cy) * s;
    const slope = (3 * ax * s + 2 * bx) * s + cx;
    if (Math.abs(slope) < 1e-6) break;
    s -= error / slope;
  }
  let low = 0;
  let high = 1;
  s = t;
  while (low < high) {
    const x = sampleX(s);
    if (Math.abs(x - t) < 1e-6) break;
    if (t > x) low = s;
    else high = s;
    if (high - low < 1e-7) break;
    s = (low + high) / 2;
  }
  return ((ay * s + by) * s + cy) * s;
}

/** Interpolates keyframe `values` at `offsets`, easing every segment like CSS does. */
function keyframe(
  progress: number,
  offsets: readonly number[],
  values: readonly number[],
  ease: (t: number) => number,
): number {
  'worklet';
  if (progress <= offsets[0]) return values[0];
  for (let i = 1; i < offsets.length; i += 1) {
    if (progress === offsets[i]) return values[i];
    if (progress < offsets[i]) {
      const t = (progress - offsets[i - 1]) / (offsets[i] - offsets[i - 1]);
      return values[i - 1] + (values[i] - values[i - 1]) * ease(t);
    }
  }
  return values[values.length - 1];
}

const popEase = (t: number) => {
  'worklet';
  return cubicBezier(0.18, 0.85, 0.2, 1.18, t);
};

const POP_OFFSETS = [0, 0.58, 1];

export interface PopPose {
  opacity: number;
  translateY: number;
  scale: number;
  rotate: number;
  brightness: number;
}

/** Winning ticket entrance (700 ms) at `progress` 0–1. */
export function sampleWinningTicketPop(progress: number, remPx = 16): PopPose {
  'worklet';
  return {
    opacity: keyframe(progress, POP_OFFSETS, [0, 1, 1], popEase),
    translateY: keyframe(progress, POP_OFFSETS, [1.4 * remPx, -0.35 * remPx, 0], popEase),
    scale: keyframe(progress, POP_OFFSETS, [0.58, 1.08, 1], popEase),
    rotate: keyframe(progress, POP_OFFSETS, [-7, 2, 0], popEase),
    brightness: keyframe(progress, POP_OFFSETS, [1.18, 1.08, 1], popEase),
  };
}
