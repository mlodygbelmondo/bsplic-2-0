import { Canvas, createPicture, Picture, Skia } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Easing, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { FullWindowOverlay } from 'react-native-screens';
import { scheduleOnRN } from 'react-native-worklets';

/**
 * Skia port of the web `fireBonusConfetti` (canvas-confetti, three bursts).
 * Uses canvas-confetti's defaults and physics: 200 ticks at 60 fps, velocity
 * decay 0.9 per tick, gravity 3 px per tick, wobbling squares and circles in
 * the default palette, fading out linearly.
 */

interface Burst {
  particleCount: number;
  spread: number;
  startVelocity?: number;
  origin: { x?: number; y?: number };
}

const BONUS_BURSTS: Burst[] = [
  { particleCount: 120, spread: 80, origin: { y: 0.55 } },
  { particleCount: 60, spread: 120, startVelocity: 35, origin: { x: 0.2, y: 0.6 } },
  { particleCount: 60, spread: 120, startVelocity: 35, origin: { x: 0.8, y: 0.6 } },
];

const COLORS = ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d', '#ff36ff'];
const TICKS = 200;
const DURATION_MS = (TICKS / 60) * 1000;
const DECAY = 0.9;
const GRAVITY_PER_TICK = 3;
const SIZE = 10;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  wobble: number;
  wobbleSpeed: number;
  tilt: number;
  color: string;
  circle: boolean;
}

function createParticles(width: number, height: number): Particle[] {
  const particles: Particle[] = [];
  for (const burst of BONUS_BURSTS) {
    const startVelocity = burst.startVelocity ?? 45;
    const originX = (burst.origin.x ?? 0.5) * width;
    const originY = (burst.origin.y ?? 0.5) * height;
    const spread = (burst.spread * Math.PI) / 180;
    for (let index = 0; index < burst.particleCount; index += 1) {
      const angle = -Math.PI / 2 + (0.5 * spread - Math.random() * spread);
      const velocity = startVelocity * 0.5 + Math.random() * startVelocity;
      particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        wobble: Math.random() * 10,
        wobbleSpeed: Math.min(0.11, Math.random() * 0.1 + 0.05),
        tilt: (Math.random() * (0.75 - 0.25) + 0.25) * Math.PI,
        color: COLORS[index % COLORS.length],
        circle: Math.random() < 0.5,
      });
    }
  }
  return particles;
}

function ConfettiCanvas({ onDone }: { onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const [particles] = useState(() => createParticles(width, height));
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(
      withTiming(1, { duration: DURATION_MS, easing: Easing.linear }, (finished) => {
        if (finished) scheduleOnRN(onDone);
      }),
    );
  }, [progress, onDone]);

  const picture = useDerivedValue(() =>
    createPicture((canvas) => {
      const tick = progress.get() * TICKS;
      // Sum of the decaying per-tick velocity: v * (1 - decay^n) / (1 - decay).
      const travel = (1 - Math.pow(DECAY, tick)) / (1 - DECAY);
      const paint = Skia.Paint();
      for (const particle of particles) {
        const x = particle.x + particle.vx * travel;
        const y = particle.y + particle.vy * travel + GRAVITY_PER_TICK * tick;
        const wobble = particle.wobble + particle.wobbleSpeed * tick;
        const tilt = particle.tilt + 0.1 * tick;
        paint.setColor(Skia.Color(particle.color));
        paint.setAlphaf(1 - progress.get());
        canvas.save();
        canvas.translate(x, y);
        canvas.rotate((tilt * 180) / Math.PI, 0, 0);
        canvas.scale(1, Math.max(0.15, Math.abs(Math.sin(wobble))));
        if (particle.circle) {
          canvas.drawCircle(0, 0, SIZE / 2, paint);
        } else {
          canvas.drawRect(Skia.XYWHRect(-SIZE / 2, -SIZE / 2, SIZE, SIZE), paint);
        }
        canvas.restore();
      }
    }),
  );

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Picture picture={picture} />
    </Canvas>
  );
}

/** Renders one confetti celebration above everything (incl. modals) and calls `onDone` when it settles. */
export function BonusConfetti({ onDone }: { onDone: () => void }) {
  const content = (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <ConfettiCanvas onDone={onDone} />
    </View>
  );
  return Platform.OS === 'ios' ? <FullWindowOverlay>{content}</FullWindowOverlay> : content;
}
