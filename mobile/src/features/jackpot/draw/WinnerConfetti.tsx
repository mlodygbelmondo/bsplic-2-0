import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import { useEffect, useRef } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Easing, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';

/**
 * The winner's confetti (web `celebrateJackpotReveal` → canvas-confetti):
 * a 120-piece burst from the middle, then two 80-piece side bursts 160 ms
 * later. Physics follow canvas-confetti (start velocity 45, decay 0.9,
 * gravity 3 px per 60 fps frame, 200 frames, squares and circles), solved in
 * closed form on the UI thread so every frame is exact at 60 or 120 Hz.
 */

const COLORS = ['#fbbf24', '#f59e0b', '#dc2626', '#ffffff'];
const FRAME_MS = 1000 / 60;
const TOTAL_TICKS = 200;
const START_VELOCITY = 45;
const DECAY = 0.9;
const GRAVITY = 3;
const SIDE_DELAY_MS = 160;
const DURATION_MS = SIDE_DELAY_MS + TOTAL_TICKS * FRAME_MS;
/** Floats per particle: x, y, angle, velocity, wobble, wobbleSpeed, tilt, color, circle, delayMs. */
const STRIDE = 10;

interface Burst {
  count: number;
  angle: number;
  spread: number;
  originX: number;
  originY: number;
  colors: string[];
  delayMs: number;
}

const BURSTS: Burst[] = [
  { count: 120, angle: 90, spread: 100, originX: 0.5, originY: 0.55, colors: COLORS, delayMs: 0 },
  { count: 80, angle: 60, spread: 75, originX: 0.08, originY: 0.65, colors: COLORS.slice(0, 3), delayMs: SIDE_DELAY_MS },
  { count: 80, angle: 120, spread: 75, originX: 0.92, originY: 0.65, colors: COLORS.slice(0, 3), delayMs: SIDE_DELAY_MS },
];

const COLOR_VALUES = COLORS.map((color) => Skia.Color(color));

function spawn(width: number, height: number): number[] {
  const data: number[] = [];
  for (const burst of BURSTS) {
    const angle = (burst.angle * Math.PI) / 180;
    const spread = (burst.spread * Math.PI) / 180;
    for (let left = burst.count - 1; left >= 0; left -= 1) {
      data.push(
        width * burst.originX,
        height * burst.originY,
        -angle + (0.5 * spread - Math.random() * spread),
        START_VELOCITY * 0.5 + Math.random() * START_VELOCITY,
        Math.random() * 10,
        Math.min(0.11, Math.random() * 0.1 + 0.05),
        (Math.random() * 0.5 + 0.25) * Math.PI,
        COLORS.indexOf(burst.colors[left % burst.colors.length]),
        Math.random() < 0.5 ? 1 : 0,
        burst.delayMs,
      );
    }
  }
  return data;
}

/** Deterministic stand-in for canvas-confetti's per-frame `Math.random() + 2`. */
function jitter(seed: number): number {
  'worklet';
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return 2 + (value - Math.floor(value));
}

export function WinnerConfetti({ fireKey }: { fireKey: number }) {
  const { width, height } = useWindowDimensions();
  const particles = useSharedValue<number[]>([]);
  const clock = useSharedValue(0);
  const firedKey = useRef(0);

  useEffect(() => {
    // Only a new fire restarts the bursts; a size change mid-flight keeps them.
    if (fireKey === 0 || firedKey.current === fireKey) return;
    firedKey.current = fireKey;
    particles.set(spawn(width, height));
    clock.set(0);
    clock.set(withTiming(DURATION_MS, { duration: DURATION_MS, easing: Easing.linear }));
  }, [fireKey, width, height, particles, clock]);

  const picture = useDerivedValue(() => {
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height));
    const data = particles.get();
    const elapsed = clock.get();
    const paint = Skia.Paint();
    for (let i = 0; i < data.length; i += STRIDE) {
      const ticks = (elapsed - data[i + 9]) / FRAME_MS;
      if (ticks < 1 || ticks > TOTAL_TICKS || elapsed >= DURATION_MS) continue;
      const travelled = (data[i + 3] * (1 - Math.pow(DECAY, ticks))) / (1 - DECAY);
      const x = data[i] + Math.cos(data[i + 2]) * travelled;
      const y = data[i + 1] + Math.sin(data[i + 2]) * travelled + GRAVITY * ticks;
      const wobble = data[i + 4] + data[i + 5] * ticks;
      const tilt = data[i + 6] + 0.1 * ticks;
      const random = jitter(i + Math.floor(ticks));
      const wobbleX = x + 10 * Math.cos(wobble);
      const wobbleY = y + 10 * Math.sin(wobble);
      const x1 = x + random * Math.cos(tilt);
      const y1 = y + random * Math.sin(tilt);
      const x2 = wobbleX + random * Math.cos(tilt);
      const y2 = wobbleY + random * Math.sin(tilt);
      paint.setColor(COLOR_VALUES[data[i + 7]]);
      paint.setAlphaf(1 - (ticks - 1) / TOTAL_TICKS);
      if (data[i + 8] === 1) {
        const rx = Math.abs(x2 - x1) * 0.6;
        const ry = Math.abs(y2 - y1) * 0.6;
        canvas.save();
        canvas.translate(x, y);
        canvas.rotate((wobble * 180) / 10, 0, 0);
        canvas.drawOval(Skia.XYWHRect(-rx, -ry, rx * 2, ry * 2), paint);
        canvas.restore();
      } else {
        const path = Skia.PathBuilder.Make()
          .moveTo(Math.floor(x), Math.floor(y))
          .lineTo(Math.floor(wobbleX), Math.floor(y1))
          .lineTo(Math.floor(x2), Math.floor(y2))
          .lineTo(Math.floor(x1), Math.floor(wobbleY))
          .close()
          .detach();
        canvas.drawPath(path, paint);
      }
    }
    return recorder.finishRecordingAsPicture();
  });

  return (
    <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Picture picture={picture} />
    </Canvas>
  );
}
