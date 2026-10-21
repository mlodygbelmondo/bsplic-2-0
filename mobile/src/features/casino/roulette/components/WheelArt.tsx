import {
  BlurMask,
  Canvas,
  Circle,
  ColorMatrix,
  Group,
  Image,
  RadialGradient,
  Shadow,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import { memo } from 'react';
import { View } from 'react-native';

import { useRouletteWheelImage } from './wheelImage';

/** Room around the wheel for the blurred glows and shadows to fade out. */
export const WHEEL_ART_BLEED = 160;

type Matrix5 = number[][];

const multiply = (a: Matrix5, b: Matrix5): Matrix5 =>
  a.map((row) => b[0].map((_, column) => row.reduce((sum, value, k) => sum + value * b[k][column], 0)));

const affine = (rows: number[][]): Matrix5 => [...rows.map((row) => [...row]), [0, 0, 0, 0, 1]];

/**
 * `filter: brightness(0.87) contrast(1.11) saturate(0.94)` as one color
 * matrix (CSS filter-function definitions, applied in that order).
 */
function wheelColorMatrix(): number[] {
  const b = 0.87;
  const c = 1.11;
  const s = 0.94;
  const brightness = affine([
    [b, 0, 0, 0, 0],
    [0, b, 0, 0, 0],
    [0, 0, b, 0, 0],
    [0, 0, 0, 1, 0],
  ]);
  const intercept = 0.5 - 0.5 * c;
  const contrast = affine([
    [c, 0, 0, 0, intercept],
    [0, c, 0, 0, intercept],
    [0, 0, c, 0, intercept],
    [0, 0, 0, 1, 0],
  ]);
  const saturate = affine([
    [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s, 0, 0],
    [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s, 0, 0],
    [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s, 0, 0],
    [0, 0, 0, 1, 0],
  ]);
  return multiply(saturate, multiply(contrast, brightness)).slice(0, 4).flat();
}

const WHEEL_COLOR_MATRIX = wheelColorMatrix();

/**
 * Static wheel artwork drawn once with Skia (web `RouletteWheel` frame): the
 * dark halo (`inset-[7%] bg-black/70 blur-3xl`), the wheel image with its
 * color filter and two drop shadows, the multiply vignette and the inset rim
 * shadow. Only the ball moves; the artwork never re-renders during a spin.
 */
export const WheelArt = memo(function WheelArt({ size }: { size: number }) {
  const image = useRouletteWheelImage();
  if (size <= 0) return null;

  const bleed = WHEEL_ART_BLEED;
  const canvasSize = size + bleed * 2;
  const center = bleed + size / 2;
  const rimRadius = size * 0.42;
  const rimPath = Skia.PathBuilder.Make().addCircle(center, center, rimRadius).build();
  // `circle at 50% 48%`, farthest corner: sqrt(0.5² + 0.52²) of the frame.
  const vignetteRadius = size * Math.hypot(0.5, 0.52);

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: -bleed, top: -bleed, width: canvasSize, height: canvasSize }}
    >
      <Canvas style={{ width: canvasSize, height: canvasSize }}>
        <Circle cx={center} cy={center} r={size * 0.43} color="rgba(0, 0, 0, 0.7)">
          <BlurMask blur={64} style="normal" />
        </Circle>

        {image ? (
          <Group opacity={0.95}>
            <Image image={image} x={bleed} y={bleed} width={size} height={size} fit="contain">
              <ColorMatrix matrix={WHEEL_COLOR_MATRIX} />
              <Shadow dx={0} dy={34} blur={24} color="rgba(0, 0, 0, 0.88)" />
              <Shadow dx={0} dy={0} blur={15} color="rgba(127, 29, 29, 0.38)" />
            </Image>
          </Group>
        ) : null}

        <Circle cx={center} cy={center} r={size / 2} blendMode="multiply">
          <RadialGradient
            c={vec(center, bleed + size * 0.48)}
            r={vignetteRadius}
            colors={['rgba(0, 0, 0, 0)', 'rgba(8, 3, 3, 0.34)', 'rgba(0, 0, 0, 0.74)']}
            positions={[0.42, 0.68, 1]}
          />
        </Circle>

        {/* `inset-[8%]` rim: `0 0 68px rgba(127,29,29,0.28)` outside … */}
        <Group clip={rimPath} invertClip>
          <Circle cx={center} cy={center} r={rimRadius} color="rgba(127, 29, 29, 0.28)">
            <BlurMask blur={34} style="normal" />
          </Circle>
        </Group>
        {/* … and `inset 0 0 60px rgba(0,0,0,0.58)` inside. */}
        <Group clip={rimPath}>
          <Circle
            cx={center}
            cy={center}
            r={rimRadius + 50}
            style="stroke"
            strokeWidth={100}
            color="rgba(0, 0, 0, 0.58)"
          >
            <BlurMask blur={30} style="normal" />
          </Circle>
        </Group>
      </Canvas>
    </View>
  );
});

/** Standard normal CDF at the sample points used for the glow falloff. */
const GLOW_FALLOFF: readonly (readonly [number, number])[] = [
  [3, 0.9987],
  [2, 0.9772],
  [1.5, 0.9332],
  [1, 0.8413],
  [0.5, 0.6915],
  [0, 0.5],
  [-0.5, 0.3085],
  [-1, 0.1587],
  [-1.5, 0.0668],
  [-2, 0.0228],
  [-3, 0],
];

/**
 * Ambient glow behind the wheel (`absolute inset-0 scale-90 rounded-full
 * bg-red-950 blur-3xl`): a 64 px Gaussian blur of a disk at 90 % of the
 * wheel, drawn as a radial gradient on a plain view so its opacity can
 * animate without a second full-size canvas. Returns the view's half-size
 * (from the wheel center) and its gradient.
 */
export function wheelGlowGradient(size: number): { extent: number; backgroundImage: string } {
  const radius = size * 0.45;
  const sigma = 64;
  const extent = radius + 3 * sigma;
  const stops = GLOW_FALLOFF.filter(([x]) => radius - x * sigma >= 0).map(([x, alpha]) => {
    const percent = ((radius - x * sigma) / extent) * 100;
    return `rgba(69, 10, 10, ${alpha}) ${percent.toFixed(2)}%`;
  });
  const centerAlpha = GLOW_FALLOFF.find(([x]) => radius - x * sigma >= 0)?.[1] ?? 1;
  return {
    extent,
    backgroundImage: `radial-gradient(circle closest-side, rgba(69, 10, 10, ${centerAlpha}) 0%, ${stops.join(', ')})`,
  };
}
