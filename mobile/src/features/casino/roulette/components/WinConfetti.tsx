import { Canvas, createPicture, Picture, Skia } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Easing, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { createStyles } from '@/theme';

import { confettiFrameAt, CONFETTI_TICK_MS, createConfettiParticles, ROULETTE_WIN_CONFETTI } from '../lib/confetti';
import { useRouletteSession } from '../state/sessionStore';

const TICKS = ROULETTE_WIN_CONFETTI.ticks;

/**
 * The win burst (web `confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } })`).
 * Each newly announced win remounts one burst; it draws with Skia on the UI
 * thread and unmounts when the last particle fades.
 */
export function WinConfetti() {
  const styles = useStyles();
  const burst = useRouletteSession((state) => state.winBurst);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [finishedBurst, setFinishedBurst] = useState(0);

  return (
    <View
      pointerEvents="none"
      style={styles.overlay}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setSize({ width, height });
      }}
    >
      {size && burst > finishedBurst ? (
        <ConfettiBurst key={burst} burst={burst} width={size.width} height={size.height} onDone={setFinishedBurst} />
      ) : null}
    </View>
  );
}

function ConfettiBurst({
  burst,
  width,
  height,
  onDone,
}: {
  burst: number;
  width: number;
  height: number;
  onDone: (burst: number) => void;
}) {
  const [particles] = useState(() => createConfettiParticles(ROULETTE_WIN_CONFETTI, width, height));
  const tick = useSharedValue(0);

  useEffect(() => {
    tick.set(
      withTiming(TICKS, { duration: TICKS * CONFETTI_TICK_MS, easing: Easing.linear }, (finished) => {
        'worklet';
        if (finished) scheduleOnRN(onDone, burst);
      }),
    );
  }, [tick, onDone, burst]);

  const picture = useDerivedValue(() =>
    createPicture((canvas) => {
      const t = tick.get();
      const alpha = 1 - t / TICKS;
      if (alpha <= 0) return;
      const paint = Skia.Paint();
      paint.setAntiAlias(true);
      for (const particle of particles) {
        // Drawn after the tick's update, with the opacity of the tick before it.
        const frame = confettiFrameAt(particle, t + 1);
        paint.setColor(Skia.Color(particle.color));
        paint.setAlphaf(alpha);
        if (particle.circle) {
          const rx = Math.abs(frame.wobbleX - frame.x) * 0.6;
          const ry = Math.abs(frame.wobbleY - frame.y) * 0.6;
          canvas.save();
          canvas.translate(frame.x, frame.y);
          canvas.rotate(18 * frame.wobble, 0, 0);
          canvas.drawOval({ x: -rx, y: -ry, width: rx * 2, height: ry * 2 }, paint);
          canvas.restore();
        } else {
          const x1 = frame.x + frame.random * frame.tiltCos;
          const y1 = frame.y + frame.random * frame.tiltSin;
          const x2 = frame.wobbleX + frame.random * frame.tiltCos;
          const y2 = frame.wobbleY + frame.random * frame.tiltSin;
          const path = Skia.PathBuilder.Make()
            .moveTo(frame.x, frame.y)
            .lineTo(frame.wobbleX, y1)
            .lineTo(x2, y2)
            .lineTo(x1, frame.wobbleY)
            .close()
            .build();
          canvas.drawPath(path, paint);
        }
      }
    }),
  );

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Picture picture={picture} />
    </Canvas>
  );
}

const useStyles = createStyles(() => ({
  overlay: { ...StyleSheet.absoluteFill, zIndex: 60 },
}));
