import { Canvas, Picture, Skia, createPicture } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { cancelAnimation, Easing, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { create } from 'zustand';

import { useReducedMotion } from '@/lib/motion';

/**
 * Port of `canvas-confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })`
 * with the library defaults (startVelocity 45, decay 0.9, gravity 1, 200
 * ticks, default colors, squares and circles), drawn by Skia on the UI thread.
 */
const PARTICLE_COUNT = 100;
const SPREAD_DEG = 70;
const ANGLE_DEG = 90;
const START_VELOCITY = 45;
const DECAY = 0.9;
const GRAVITY = 3;
const TOTAL_TICKS = 200;
const TICK_MS = 1000 / 60;
const COLORS = ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d', '#ff36ff'];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  wobble: number;
  wobbleSpeed: number;
  tilt: number;
  random: number;
  color: string;
  circle: boolean;
}

const useConfettiStore = create<{ burst: number }>(() => ({ burst: 0 }));

/** Fires one burst over the whole admin screen. */
export function fireConfetti() {
  useConfettiStore.setState((state) => ({ burst: state.burst + 1 }));
}

/** Full-screen, touch-transparent confetti layer; mount once, last in the tree. */
export function ConfettiOverlay() {
  const burst = useConfettiStore((state) => state.burst);
  const reduced = useReducedMotion();
  if (burst === 0 || reduced) return null;
  return <ConfettiBurst key={burst} />;
}

function createParticles(originX: number, originY: number): Particle[] {
  const angle = (ANGLE_DEG * Math.PI) / 180;
  const spread = (SPREAD_DEG * Math.PI) / 180;
  return Array.from({ length: PARTICLE_COUNT }, (_, index) => {
    const velocity = START_VELOCITY * 0.5 + Math.random() * START_VELOCITY;
    const angle2D = -angle + (0.5 * spread - Math.random() * spread);
    return {
      x: originX,
      y: originY,
      vx: Math.cos(angle2D) * velocity,
      vy: Math.sin(angle2D) * velocity,
      wobble: Math.random() * 10,
      wobbleSpeed: Math.min(0.11, Math.random() * 0.1 + 0.05),
      tilt: (Math.random() * 0.5 + 0.25) * Math.PI,
      random: Math.random() + 2,
      color: COLORS[index % COLORS.length],
      circle: index % 2 === 1,
    };
  });
}

function ConfettiBurst() {
  const { width, height } = useWindowDimensions();
  const [particles] = useState(() => createParticles(width * 0.5, height * 0.6));
  const [done, setDone] = useState(false);
  const tick = useSharedValue(0);

  useEffect(() => {
    tick.set(
      withTiming(TOTAL_TICKS, { duration: TOTAL_TICKS * TICK_MS, easing: Easing.linear }, (finished) => {
        if (finished) scheduleOnRN(setDone, true);
      }),
    );
    return () => cancelAnimation(tick);
  }, [tick]);

  const picture = useDerivedValue(() => {
    const n = tick.get();
    // Closed form of the per-tick update: velocity decays geometrically.
    const travelled = (1 - Math.pow(DECAY, n)) / (1 - DECAY);
    const opacity = Math.max(0, 1 - n / TOTAL_TICKS);
    return createPicture(
      (canvas) => {
        const paint = Skia.Paint();
        for (const particle of particles) {
          const x = particle.x + particle.vx * travelled;
          const y = particle.y + particle.vy * travelled + GRAVITY * n;
          const wobble = particle.wobble + particle.wobbleSpeed * n;
          const wobbleX = x + 10 * Math.cos(wobble);
          const wobbleY = y + 10 * Math.sin(wobble);
          const tilt = particle.tilt + 0.1 * n;
          const x1 = x + particle.random * Math.cos(tilt);
          const y1 = y + particle.random * Math.sin(tilt);
          const x2 = wobbleX + particle.random * Math.cos(tilt);
          const y2 = wobbleY + particle.random * Math.sin(tilt);
          paint.setColor(Skia.Color(particle.color));
          paint.setAlphaf(opacity);
          if (particle.circle) {
            const rx = Math.abs(x2 - x1) * 0.6;
            const ry = Math.abs(y2 - y1) * 0.6;
            canvas.save();
            canvas.rotate((18 * wobble) % 360, x, y);
            canvas.drawOval(Skia.XYWHRect(x - rx, y - ry, rx * 2, ry * 2), paint);
            canvas.restore();
          } else {
            const path = Skia.PathBuilder.Make()
              .moveTo(Math.floor(x), Math.floor(y))
              .lineTo(Math.floor(wobbleX), Math.floor(y1))
              .lineTo(Math.floor(x2), Math.floor(y2))
              .lineTo(Math.floor(x1), Math.floor(wobbleY))
              .close()
              .build();
            canvas.drawPath(path, paint);
          }
        }
      },
      { width, height },
    );
  });

  if (done) return null;
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Picture picture={picture} />
    </Canvas>
  );
}
