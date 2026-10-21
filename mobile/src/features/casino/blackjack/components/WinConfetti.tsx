import { Canvas, Picture, Skia, createPicture } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Easing, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

/**
 * Win burst (web `canvas-confetti`: 110 particles, spread 64°, origin y 0.62,
 * colors #22c55e / #fbbf24 / #ffffff). canvas-confetti's per-tick physics
 * (velocity decay 0.9, gravity 3 px/tick, wobble and tilt, 200 ticks at
 * 60 fps) is evaluated in closed form per frame on the UI thread.
 */

const PARTICLES = 110;
const SPREAD = (64 * Math.PI) / 180;
const START_VELOCITY = 45;
const DECAY = 0.9;
const GRAVITY = 3;
const TICKS = 200;
const DURATION_MS = (TICKS / 60) * 1000;
const COLORS = ['#22c55e', '#fbbf24', '#ffffff'];

interface Particle {
  angle: number;
  velocity: number;
  wobble: number;
  wobbleSpeed: number;
  tilt: number;
  jitter: number;
  color: number;
  circle: boolean;
}

function createParticles(): Particle[] {
  return Array.from({ length: PARTICLES }, (_, index) => ({
    angle: -Math.PI / 2 + (SPREAD / 2 - Math.random() * SPREAD),
    velocity: START_VELOCITY * 0.5 + Math.random() * START_VELOCITY,
    wobble: Math.random() * 10,
    wobbleSpeed: Math.min(0.11, Math.random() * 0.1 + 0.05),
    tilt: (Math.random() * 0.5 + 0.25) * Math.PI,
    jitter: Math.random() + 2,
    color: index % COLORS.length,
    circle: Math.random() < 0.5,
  }));
}

export function WinConfetti({ onDone }: { onDone: () => void }) {
  const [particles] = useState(createParticles);
  const tick = useSharedValue(0);
  const size = useSharedValue({ width: 0, height: 0 });

  useEffect(() => {
    tick.set(
      withTiming(TICKS, { duration: DURATION_MS, easing: Easing.linear }, (finished) => {
        if (finished) scheduleOnRN(onDone);
      }),
    );
  }, [tick, onDone]);

  const picture = useDerivedValue(() => {
    const t = tick.get();
    const { width, height } = size.get();
    const originX = width / 2;
    const originY = height * 0.62;
    const travel = (1 - Math.pow(DECAY, t)) / (1 - DECAY);
    const opacity = Math.max(0, 1 - t / TICKS);
    return createPicture((canvas) => {
      const paints = COLORS.map((color) => {
        const paint = Skia.Paint();
        paint.setAntiAlias(true);
        paint.setColor(Skia.Color(color));
        paint.setAlphaf(opacity);
        return paint;
      });
      for (const p of particles) {
        const x = originX + Math.cos(p.angle) * p.velocity * travel;
        const y = originY + Math.sin(p.angle) * p.velocity * travel + GRAVITY * t;
        const wobble = p.wobble + p.wobbleSpeed * t;
        const tilt = p.tilt + 0.1 * t;
        const wobbleX = x + 10 * Math.cos(wobble);
        const wobbleY = y + 10 * Math.sin(wobble);
        const x1 = x + p.jitter * Math.cos(tilt);
        const y1 = y + p.jitter * Math.sin(tilt);
        const x2 = wobbleX + p.jitter * Math.cos(tilt);
        const y2 = wobbleY + p.jitter * Math.sin(tilt);
        const paint = paints[p.color];
        if (p.circle) {
          const rx = Math.max(Math.abs(x2 - x1) * 0.6, 0.5);
          const ry = Math.max(Math.abs(y2 - y1) * 0.6, 0.5);
          canvas.save();
          canvas.translate(x, y);
          canvas.rotate((wobble * 18) % 360, 0, 0);
          canvas.drawOval(Skia.XYWHRect(-rx, -ry, rx * 2, ry * 2), paint);
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
    });
  });

  return (
    <Canvas pointerEvents="none" onSize={size} style={StyleSheet.absoluteFill}>
      <Picture picture={picture} />
    </Canvas>
  );
}
