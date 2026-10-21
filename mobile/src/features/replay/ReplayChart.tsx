import { Canvas, DashPathEffect, LinearGradient, Line, Oval, Path, Rect, Skia, vec } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { useWindowDimensions, View, type AccessibilityActionEvent, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, useCompetingGestures, usePanGesture, useTapGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useDerivedValue, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { haptics } from '@/lib/haptics';
import { alpha, createStyles, useTheme } from '@/theme';
import { Text } from '@/ui';
import { formatReplayDate, formatReplayMoney, replayChart, STATUS_LABELS, type ReplayModel, type ReplayMoment } from './model';
import { replayTone } from './replay-colors';

/* The web draws into a 1000 × 320 SVG viewBox stretched to the card (`preserveAspectRatio="none"`). */
const VIEW_WIDTH = 1000;
const VIEW_HEIGHT = 320;
const THUMB = 14;
const SCRUBBER_HEIGHT = 44;

/**
 * Cumulative settled result in placement order with a scrubber. Selection is a
 * coupon ID, not an offset: a refresh can remove or settle coupons.
 */
export function ReplayChart({ model }: { model: ReplayModel }) {
  const styles = useStyles();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const found = model.timeline.findIndex((entry) => entry.coupon.id === selectedId);
  const selected = found >= 0 ? found : model.timeline.length - 1;
  const moment = model.timeline[selected];

  if (!moment) return <Text style={[styles.muted, styles.empty]}>Wykres pojawi się po rozliczeniu kuponów.</Text>;

  const select = (index: number) => setSelectedId(model.timeline[index]?.coupon.id ?? null);
  const date = formatReplayDate(moment.coupon.created_at);
  const cumulative = formatReplayMoney(moment.cumulativeCents, true);
  return (
    <View style={styles.root}>
      <ChartBody timeline={model.timeline} selected={selected} onSelect={select} valueText={`${date}, ${STATUS_LABELS[moment.coupon.status]}, bilans ${cumulative}`} />
      <View style={styles.readout}>
        <Text style={styles.muted}>{date} · {STATUS_LABELS[moment.coupon.status]}</Text>
        <Text weight="600" tabular>{cumulative}</Text>
      </View>
    </View>
  );
}

interface ChartBodyProps {
  timeline: ReplayMoment[];
  selected: number;
  onSelect: (index: number) => void;
  valueText: string;
}

function ChartBody({ timeline, selected, onSelect, valueText }: ChartBodyProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const [width, setWidth] = useState(0);
  // `.replay-chart svg { height: clamp(130px, 18vw, 190px) }`
  const height = Math.min(190, Math.max(130, screenWidth * 0.18));
  const count = timeline.length;
  const chart = replayChart(timeline.map((entry) => entry.cumulativeCents));
  const sx = width / VIEW_WIDTH;
  const sy = height / VIEW_HEIGHT;
  const xs = chart.points.map((point) => point.x * sx);
  const ys = chart.points.map((point) => point.y * sy);
  const zeroY = chart.zeroY * sy;

  const line = Skia.PathBuilder.Make();
  xs.forEach((x, index) => (index === 0 ? line.moveTo(x, ys[index]) : line.lineTo(x, ys[index])));
  const linePath = line.build();
  const fill = Skia.PathBuilder.Make();
  xs.forEach((x, index) => (index === 0 ? fill.moveTo(x, ys[index]) : fill.lineTo(x, ys[index])));
  fill.lineTo(976 * sx, zeroY).lineTo(24 * sx, zeroY).close();
  const fillPath = fill.build();
  const fillTop = Math.min(zeroY, ...ys);
  const fillBottom = Math.max(zeroY, ...ys);

  const index = useSharedValue(selected);
  useEffect(() => {
    index.set(selected);
  }, [index, selected]);

  const commit = (next: number) => {
    haptics.selection();
    onSelect(next);
  };
  const update = (next: number) => {
    'worklet';
    if (next === index.get()) return;
    index.set(next);
    scheduleOnRN(commit, next);
  };
  // Web mouse hover over the SVG: nearest coupon under the pointer.
  const fromChart = (x: number) => {
    'worklet';
    if (width <= 0) return index.get();
    const fraction = ((x / width) * VIEW_WIDTH - 24) / 952;
    return Math.max(0, Math.min(count - 1, Math.round(fraction * count) - 1));
  };
  // `<input type="range" min=0 max=count-1 step=1>`: the thumb centre spans the track minus its width.
  const fromTrack = (x: number) => {
    'worklet';
    if (count < 2 || width <= THUMB) return 0;
    return Math.max(0, Math.min(count - 1, Math.round(((x - THUMB / 2) / (width - THUMB)) * (count - 1))));
  };

  const chartPan = usePanGesture({
    activeOffsetX: [-8, 8],
    failOffsetY: [-12, 12],
    onActivate: (event) => {
      'worklet';
      update(fromChart(event.x));
    },
    onUpdate: (event) => {
      'worklet';
      update(fromChart(event.x));
    },
  });
  const chartTap = useTapGesture({
    onActivate: (event) => {
      'worklet';
      update(fromChart(event.x));
    },
  });
  const chartGesture = useCompetingGestures(chartPan, chartTap);

  const enabled = count >= 2;
  const trackPan = usePanGesture({
    enabled,
    activeOffsetX: [-4, 4],
    failOffsetY: [-12, 12],
    onActivate: (event) => {
      'worklet';
      update(fromTrack(event.x));
    },
    onUpdate: (event) => {
      'worklet';
      update(fromTrack(event.x));
    },
  });
  const trackTap = useTapGesture({
    enabled,
    onActivate: (event) => {
      'worklet';
      update(fromTrack(event.x));
    },
  });
  const trackGesture = useCompetingGestures(trackPan, trackTap);

  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    const step = event.nativeEvent.actionName === 'increment' ? 1 : event.nativeEvent.actionName === 'decrement' ? -1 : 0;
    const next = Math.max(0, Math.min(count - 1, selected + step));
    if (next !== selected) onSelect(next);
  };

  return (
    <>
      <GestureDetector gesture={chartGesture}>
        <View
          style={{ height }}
          onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
          accessible
          accessibilityRole="image"
          accessibilityLabel="Bilans kuponów w kolejności postawienia"
        >
          {width > 0 ? (
            <Canvas style={styles.fill}>
              <Path path={fillPath}>
                <LinearGradient start={vec(0, fillTop)} end={vec(0, fillBottom)} colors={[alpha(colors.primary, 0.14), alpha(colors.primary, 0)]} />
              </Path>
              <Line p1={vec(24 * sx, zeroY)} p2={vec(976 * sx, zeroY)} color={alpha(colors.mutedForeground, 0.45)} strokeWidth={1} style="stroke">
                <DashPathEffect intervals={[4, 5]} />
              </Line>
              <Path path={linePath} style="stroke" strokeWidth={2.5} strokeJoin="round" strokeCap="round" color={colors.primary} />
              <Marker index={index} xs={xs} ys={ys} sx={sx} sy={sy} cursorColor={alpha(colors.mutedForeground, 0.225)} dotColor={colors.primary} />
            </Canvas>
          ) : null}
        </View>
      </GestureDetector>
      <GestureDetector gesture={trackGesture}>
        <View
          style={styles.scrubber}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Wybierz kupon na wykresie"
          accessibilityValue={{ text: valueText }}
          accessibilityState={{ disabled: !enabled }}
          accessibilityActions={enabled ? [{ name: 'increment' }, { name: 'decrement' }] : undefined}
          onAccessibilityAction={onAccessibilityAction}
        >
          <View style={styles.track} />
          <Thumb index={index} count={count} width={width} />
        </View>
      </GestureDetector>
    </>
  );
}

interface MarkerProps {
  index: SharedValue<number>;
  xs: number[];
  ys: number[];
  sx: number;
  sy: number;
  cursorColor: string;
  dotColor: string;
}

/** Cursor line (viewBox y 20–300) and the r=6 dot, stretched like the web's SVG. */
function Marker({ index, xs, ys, sx, sy, cursorColor, dotColor }: MarkerProps) {
  const cursorX = useDerivedValue(() => xs[index.get() + 1] - 0.5);
  const dotX = useDerivedValue(() => xs[index.get() + 1] - 6 * sx);
  const dotY = useDerivedValue(() => ys[index.get() + 1] - 6 * sy);
  return (
    <>
      <Rect x={cursorX} y={20 * sy} width={1} height={280 * sy} color={cursorColor} />
      <Oval x={dotX} y={dotY} width={12 * sx} height={12 * sy} color={dotColor} />
    </>
  );
}

function Thumb({ index, count, width }: { index: SharedValue<number>; count: number; width: number }) {
  const styles = useStyles();
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: count < 2 ? 0 : (index.get() / (count - 1)) * Math.max(0, width - THUMB) }],
  }));
  return <Animated.View pointerEvents="none" style={[styles.thumb, animatedStyle]} />;
}

const useStyles = createStyles((palette) => {
  const { colors } = palette;
  return {
    root: { marginTop: 16 },
    muted: { color: replayTone(palette).muted },
    empty: { paddingVertical: 40 },
    fill: { flex: 1 },
    scrubber: { height: SCRUBBER_HEIGHT, justifyContent: 'center' },
    track: { height: 2, borderRadius: 1, backgroundColor: colors.border },
    thumb: {
      position: 'absolute',
      left: 0,
      top: (SCRUBBER_HEIGHT - THUMB) / 2,
      width: THUMB,
      height: THUMB,
      borderRadius: THUMB / 2,
      borderWidth: 2,
      borderColor: colors.card,
      backgroundColor: colors.primary,
      boxShadow: `0px 0px 0px 1px ${colors.primary}`,
    },
    readout: {
      minHeight: 32,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      columnGap: 16,
      rowGap: 4,
    },
  };
});
