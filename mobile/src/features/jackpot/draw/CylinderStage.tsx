import { Canvas, Image as SkiaImage, Shadow, useImage } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { hsl } from '@/theme';
import { Text } from '@/ui';

import { JACKPOT_WINNING_TICKET_IMAGE } from '../assets';
import { CYLINDER_SPIN_MS, type ReplayPhase } from '../lib/drawModel';
import {
  DRUM_FACE_ANGLE,
  DRUM_WINNER_SWAP_ANGLE,
  getDrumAngle,
  getDrumFaceLabels,
  getDrumFaceMatrix,
  getDrumFrontScale,
  isDrumFaceFrontFacing,
} from '../lib/drum';
import { jackpotAudio } from '../lib/jackpotAudio';
import { fade, REM } from './tokens';
import { WinningTicket } from './WinningTicket';

const FILL = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } as const;
// Phone values (`max-width: 560px`).
const CYLINDER_HEIGHT = 17 * REM;
const FACE_HEIGHT = 4.25 * REM;
const RADIUS = 9.25 * REM;
const FACE_FONT_SIZE = 1.6 * REM;
const RENDER_SCALE = getDrumFrontScale(RADIUS);
const WINNING_TICKET_ASPECT = 1213 / 647;
// drop-shadow(0 0 1.6rem hsl(38 92% 50%)) on the landed winner face → σ 12.8.
const WINNER_GLOW_SIGMA = 0.8 * REM * RENDER_SCALE;
const WINNER_GLOW_PAD = Math.ceil(WINNER_GLOW_SIGMA * 3);
const RED = hsl(0, 84, 60);
const GRID_LINE = hsl(0, 72, 51, 0.35);
const GRID_RULE = hsl(0, 72, 51, 0.2);
const GRID_CLEAR = fade(0, 72, 51);
const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);
const EASE_IN_OUT = Easing.bezier(0.42, 0, 0.58, 1);
const EASE_OUT = Easing.bezier(0, 0, 0.58, 1);

/** Drum mode on the UI thread: at rest on face 0, spinning, or landed on the winner. */
const MODE_INTRO = 0;
const MODE_SPIN = 1;
const MODE_LANDED = 2;

interface CylinderStageProps {
  phase: ReplayPhase;
  ticketNumbers: number[];
  winningTicketNumber: number | null;
  winnerTicketLabel: string;
  /** Outer width of `.jackpot-cylinder`. */
  width: number;
  reducedMotion: boolean;
  /** Low Power Mode: no glow pulse. */
  lite: boolean;
}

/**
 * `JackpotCylinderStage`: a 12-face drum of real pool tickets that spins six
 * turns under a red laser and lands on the winner, then pops the winning
 * ticket out. The spin, face swap and landing run on the UI thread.
 */
export function CylinderStage({
  phase,
  ticketNumbers,
  winningTicketNumber,
  winnerTicketLabel,
  width,
  reducedMotion,
  lite,
}: CylinderStageProps) {
  const innerWidth = width - 2;
  const innerHeight = CYLINDER_HEIGHT - 2;
  const drumWidth = Math.min(16 * REM, innerWidth * 0.8);
  const drawing = phase === 'drawing';

  const mode = useSharedValue(phase === 'revealed' ? MODE_LANDED : MODE_INTRO);
  const spin = useSharedValue(0);
  const glow = useSharedValue(0.65);

  useEffect(() => {
    if (phase === 'intro') {
      cancelAnimation(spin);
      spin.set(0);
      mode.set(MODE_INTRO);
      return;
    }
    if (phase === 'revealed' || reducedMotion) {
      cancelAnimation(spin);
      mode.set(MODE_LANDED);
      return;
    }
    mode.set(MODE_SPIN);
    spin.set(0);
    spin.set(withTiming(1, { duration: CYLINDER_SPIN_MS, easing: Easing.linear }));
    jackpotAudio.playDrumSpin();
    return () => jackpotAudio.stopDrumSpin();
  }, [phase, reducedMotion, mode, spin]);

  useEffect(() => {
    if (drawing && !reducedMotion && !lite) {
      glow.set(0.75);
      glow.set(withRepeat(withTiming(1, { duration: 900, easing: EASE_IN_OUT }), -1, true));
      return () => cancelAnimation(glow);
    }
    glow.set(withTiming(drawing ? 1 : 0.65, { duration: 500, easing: EASE }));
    return undefined;
  }, [drawing, reducedMotion, lite, glow]);

  const angle = useDerivedValue(() => (mode.get() === MODE_SPIN ? getDrumAngle(spin.get()) : 0));
  const swapped = useDerivedValue(
    () => mode.get() === MODE_LANDED || (mode.get() === MODE_SPIN && angle.get() >= DRUM_WINNER_SWAP_ANGLE),
  );
  const landed = useDerivedValue(() => mode.get() === MODE_LANDED || (mode.get() === MODE_SPIN && spin.get() >= 1));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.get() }));

  const labelsBefore = getDrumFaceLabels(ticketNumbers, winningTicketNumber, false);
  const labelsAfter = getDrumFaceLabels(ticketNumbers, winningTicketNumber, true);

  return (
    <View style={styles.shadow}>
      <View style={styles.cylinder}>
        <Animated.View pointerEvents="none" style={[styles.glow, glowStyle]} />
        <View pointerEvents="none" style={[styles.grid, styles.ceiling]} />
        <View pointerEvents="none" style={[styles.grid, styles.floor]} />

        <View pointerEvents="none" style={styles.viewport}>
          {labelsBefore.map((label, index) => (
            <DrumFace
              // Faces are fixed slots on the drum.
              key={`face-${index}`}
              index={index}
              labelBefore={label}
              labelAfter={labelsAfter[index]}
              angle={angle}
              swapped={swapped}
              landed={landed}
              left={innerWidth / 2 - (drumWidth * RENDER_SCALE) / 2}
              top={innerHeight / 2 - (FACE_HEIGHT * RENDER_SCALE) / 2}
              width={drumWidth * RENDER_SCALE}
            />
          ))}
        </View>

        <View pointerEvents="none" style={[styles.fade, styles.fadeTop]} />
        <View pointerEvents="none" style={[styles.fade, styles.fadeBottom]} />
        <View pointerEvents="none" style={[styles.laser, { top: innerHeight / 2 - 1 }]}>
          <View style={styles.laserDiamond} />
          <View style={styles.laserDiamond} />
        </View>

        {phase === 'revealed' ? (
          <WinnerOverlay
            label={winnerTicketLabel}
            ticketWidth={Math.min(18.5 * REM, innerWidth * 0.94)}
            reducedMotion={reducedMotion}
          />
        ) : null}
      </View>
    </View>
  );
}

function DrumFace({
  index,
  labelBefore,
  labelAfter,
  angle,
  swapped,
  landed,
  left,
  top,
  width,
}: {
  index: number;
  labelBefore: string;
  labelAfter: string;
  angle: SharedValue<number>;
  swapped: SharedValue<boolean>;
  landed: SharedValue<boolean>;
  left: number;
  top: number;
  width: number;
}) {
  const height = FACE_HEIGHT * RENDER_SCALE;
  const isWinnerFace = index === 0;
  const faceAngle = index * DRUM_FACE_ANGLE;
  const changes = labelBefore !== labelAfter;

  const faceStyle = useAnimatedStyle(() => {
    const current = angle.get() + faceAngle;
    const visible = isDrumFaceFrontFacing(current, RADIUS);
    const highlighted = isWinnerFace && landed.get();
    return {
      opacity: visible ? (highlighted ? 1 : 0.9) : 0,
      transform: [{ matrix: getDrumFaceMatrix(current, RADIUS, RENDER_SCALE) }],
    };
  });
  const beforeStyle = useAnimatedStyle(() => ({ opacity: swapped.get() ? 0 : 1 }));
  const afterStyle = useAnimatedStyle(() => ({ opacity: swapped.get() ? 1 : 0 }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: landed.get() ? 1 : 0 }));

  return (
    <Animated.View style={[styles.face, { left, top, width, height }, faceStyle]}>
      {isWinnerFace ? (
        <Animated.View style={[StyleSheet.absoluteFill, glowStyle]}>
          <WinnerFaceGlow width={width} height={height} />
        </Animated.View>
      ) : null}
      <Image source={JACKPOT_WINNING_TICKET_IMAGE} style={StyleSheet.absoluteFill} contentFit="contain" />
      {changes ? (
        <>
          <Animated.View style={[styles.faceLabel, beforeStyle]}>
            <FaceText label={labelBefore} />
          </Animated.View>
          <Animated.View style={[styles.faceLabel, afterStyle]}>
            <FaceText label={labelAfter} />
          </Animated.View>
        </>
      ) : (
        <View style={styles.faceLabel}>
          <FaceText label={labelBefore} />
        </View>
      )}
    </Animated.View>
  );
}

function FaceText({ label }: { label: string }) {
  return (
    <Text allowFontScaling={false} style={styles.faceText}>
      {label}
    </Text>
  );
}

/** The landed winner face's gold drop-shadow, following the ticket art's outline. */
function WinnerFaceGlow({ width, height }: { width: number; height: number }) {
  const art = useImage(JACKPOT_WINNING_TICKET_IMAGE);
  const artWidth = Math.min(width, height * WINNING_TICKET_ASPECT);
  const artHeight = artWidth / WINNING_TICKET_ASPECT;
  return (
    <Canvas
      style={{
        position: 'absolute',
        left: -WINNER_GLOW_PAD,
        top: -WINNER_GLOW_PAD,
        width: width + WINNER_GLOW_PAD * 2,
        height: height + WINNER_GLOW_PAD * 2,
      }}
    >
      <SkiaImage
        image={art}
        x={WINNER_GLOW_PAD + (width - artWidth) / 2}
        y={WINNER_GLOW_PAD + (height - artHeight) / 2}
        width={artWidth}
        height={artHeight}
        fit="contain"
      >
        <Shadow dx={0} dy={0} blur={WINNER_GLOW_SIGMA} color={hsl(38, 92, 50)} shadowOnly />
      </SkiaImage>
    </Canvas>
  );
}

/** `.jackpot-cylinder__winner`: dims the drum and pops the winning ticket out (240 ms fade). */
function WinnerOverlay({
  label,
  ticketWidth,
  reducedMotion,
}: {
  label: string;
  ticketWidth: number;
  reducedMotion: boolean;
}) {
  const opacity = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) return;
    opacity.set(withTiming(1, { duration: 240, easing: EASE_OUT }));
  }, [reducedMotion, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <Animated.View pointerEvents="none" style={[styles.winner, style]}>
      <WinningTicket label={label} width={ticketWidth} reducedMotion={reducedMotion} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    height: CYLINDER_HEIGHT,
    borderRadius: 0.85 * REM,
    boxShadow: `0px 25px 65px ${hsl(0, 0, 0, 0.9)}`,
  },
  cylinder: {
    flex: 1,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: hsl(38, 92, 50, 0.42),
    borderRadius: 0.85 * REM,
    backgroundColor: '#000',
  },
  glow: {
    ...FILL,
    backgroundImage: `radial-gradient(ellipse at center, ${hsl(0, 72, 51, 0.5)}, ${hsl(0, 74, 35, 0.25)} 50%, ${fade(0, 74, 35)} 70%)`,
  },
  grid: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1,
    backgroundSize: '26px 18px',
    backgroundRepeat: 'repeat',
  },
  ceiling: {
    top: 0,
    height: 7 * REM,
    backgroundImage: `linear-gradient(to bottom, ${GRID_LINE} 1px, ${GRID_CLEAR} 1px), linear-gradient(to right, ${GRID_RULE} 1px, ${GRID_CLEAR} 1px)`,
    transform: [{ perspective: 140 }, { rotateX: '-60deg' }],
  },
  floor: {
    bottom: 0,
    height: 8 * REM,
    backgroundImage: `linear-gradient(to top, ${GRID_LINE} 1px, ${GRID_CLEAR} 1px), linear-gradient(to right, ${GRID_RULE} 1px, ${GRID_CLEAR} 1px)`,
    transform: [{ perspective: 140 }, { rotateX: '60deg' }],
  },
  viewport: { ...FILL, zIndex: 2 },
  face: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backfaceVisibility: 'hidden',
  },
  faceLabel: { ...FILL, alignItems: 'center', justifyContent: 'center' },
  // ui-monospace is SF Mono on iOS, as in Safari.
  faceText: {
    fontFamily: 'ui-monospace',
    color: hsl(25, 52, 15),
    fontSize: FACE_FONT_SIZE * RENDER_SCALE,
    lineHeight: FACE_FONT_SIZE * RENDER_SCALE * 1.5,
    fontWeight: '900',
    letterSpacing: -0.02 * FACE_FONT_SIZE * RENDER_SCALE,
    textShadowColor: hsl(45, 100, 82, 0.58),
    textShadowOffset: { width: 0, height: RENDER_SCALE },
    textShadowRadius: 0,
  },
  fade: { position: 'absolute', left: 0, right: 0, zIndex: 3, height: 3.5 * REM },
  fadeTop: {
    top: 0,
    backgroundImage: `linear-gradient(to bottom, #000, ${hsl(0, 0, 0, 0.8)}, ${hsl(0, 0, 0, 0)})`,
  },
  fadeBottom: {
    bottom: 0,
    backgroundImage: `linear-gradient(to top, #000, ${hsl(0, 0, 0, 0.8)}, ${hsl(0, 0, 0, 0)})`,
  },
  laser: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 4,
    height: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: REM,
    backgroundColor: RED,
    boxShadow: `0px 0px 12px ${hsl(0, 84, 60, 0.9)}`,
  },
  laserDiamond: {
    width: 0.62 * REM,
    height: 0.62 * REM,
    backgroundColor: RED,
    boxShadow: `0px 0px 8px ${hsl(0, 84, 50)}`,
    transform: [{ rotate: '45deg' }],
  },
  winner: {
    ...FILL,
    zIndex: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: hsl(0, 0, 0, 0.55),
  },
});
