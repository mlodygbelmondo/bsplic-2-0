import { memo, useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type EntryExitAnimationFunction,
  type SharedValue,
} from 'react-native-reanimated';

import { createStyles } from '@/theme';
import { Text } from '@/ui';
import { BOARD_COLUMNS, BOARD_ROWS, SCATTER_SYMBOL, winningCells, type SlotFrame, type SlotGame } from './model';
import { SLOT_COLORS, SLOT_THEMES } from './slot-theme';
import { SlotSymbol } from './SlotSymbol';

const BOARD_BORDER = 1;
const BOARD_PADDING = 3;
const BOARD_GAP = 2;
const CELL_BORDER = 1;

/**
 * Web drop-in for every symbol of a new frame: from 25 px above and
 * transparent, 250 ms, columns staggered by 45 ms. Winning cells only fade
 * (their pulse owns the transform on the web).
 */
function dropIn(delay: number, translate: boolean): EntryExitAnimationFunction {
  return () => {
    'worklet';
    const timing = { duration: 250, easing: Easing.bezier(0.42, 0, 0.58, 1) };
    return {
      initialValues: { opacity: 0, transform: [{ translateY: translate ? -25 : 0 }] },
      animations: {
        opacity: withDelay(delay, withTiming(1, timing)),
        transform: [{ translateY: withDelay(delay, withTiming(0, timing)) }],
      },
    };
  };
}

/** `.slot-cell.is-winning` per game (Candy Cascade uses its pink fill). */
const WINNING_STYLES = Object.fromEntries(
  Object.entries(SLOT_THEMES).map(([game, theme]) => [
    game,
    { backgroundImage: theme.winningBackground, borderColor: theme.winningBorder, boxShadow: SLOT_COLORS.winningShadow },
  ]),
) as Record<SlotGame, ViewStyle>;

const DROP_IN = Array.from({ length: BOARD_COLUMNS }, (_, column) => dropIn(column * 45, true));
const FADE_IN = Array.from({ length: BOARD_COLUMNS }, (_, column) => dropIn(column * 45, false));

export interface SlotBoardProps {
  game: SlotGame;
  frame: SlotFrame;
  spinning: boolean;
  /** Changes for every shown frame; restarts the drop-in like the web's keyed cells. */
  step: number;
  width: number;
  height: number;
  /** Reduced motion: no drop-in (web `useReducedMotion`). */
  reducedMotion: boolean;
  /** Reduced motion or Low Power Mode: no spin blur loop and no win pulse. */
  liteMotion: boolean;
}

/** 6 × 5 board (web `SlotBoard`). Motion runs on the UI thread. */
export function SlotBoard({ game, frame, spinning, step, width, height, reducedMotion, liteMotion }: SlotBoardProps) {
  const styles = useStyles();
  const winning = winningCells(frame);
  const showWinners = !spinning && winning.size > 0;
  const animateSpin = spinning && !liteMotion;
  const animatePulse = showWinners && !liteMotion;

  // `.is-spinning .slot-symbol-wrap`: translateY(-65%) → 65%, 240 ms linear, infinite.
  const spin = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(spin);
    spin.set(0);
    if (!animateSpin) return;
    spin.set(withRepeat(withTiming(1, { duration: 240, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(spin);
  }, [animateSpin, spin]);

  // `.is-winning .slot-symbol-wrap`: scale 1 → 1.07, 600 ms ease-in-out, alternate; restarts per frame.
  const pulse = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(pulse);
    pulse.set(0);
    if (!animatePulse) return;
    pulse.set(withRepeat(withTiming(1, { duration: 600, easing: Easing.bezier(0.42, 0, 0.58, 1) }), -1, true));
    return () => cancelAnimation(pulse);
  }, [animatePulse, step, pulse]);

  const innerWidth = width - 2 * (BOARD_BORDER + BOARD_PADDING);
  const innerHeight = height - 2 * (BOARD_BORDER + BOARD_PADDING);
  const cellWidth = (innerWidth - (BOARD_COLUMNS - 1) * BOARD_GAP) / BOARD_COLUMNS;
  const cellHeight = (innerHeight - (BOARD_ROWS - 1) * BOARD_GAP) / BOARD_ROWS;
  // Phone layout: the symbol is a square as tall as the cell, centered.
  const symbolSize = Math.max(0, cellHeight - 2 * CELL_BORDER);

  return (
    <View
      accessibilityLabel="Plansza gry, 6 kolumn i 5 rzędów"
      accessibilityState={{ busy: spinning }}
      style={[styles.board, { width, height }]}
    >
      {Array.from({ length: BOARD_ROWS }, (_, row) => (
        <View key={row} style={styles.row}>
          {Array.from({ length: BOARD_COLUMNS }, (_, column) => {
            const cell = row * BOARD_COLUMNS + column;
            return (
              <SlotCell
                key={cell}
                game={game}
                symbol={frame.board[cell]}
                gold={game === 'bandit' ? frame.gold[cell] : 0}
                winning={showWinners && winning.has(cell)}
                spinning={animateSpin}
                pulsing={animatePulse && winning.has(cell)}
                column={column}
                step={step}
                width={cellWidth}
                height={cellHeight}
                symbolSize={symbolSize}
                dropIn={!reducedMotion}
                spin={spin}
                pulse={pulse}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

interface SlotCellProps {
  game: SlotGame;
  symbol: number;
  gold: number;
  winning: boolean;
  spinning: boolean;
  pulsing: boolean;
  column: number;
  step: number;
  width: number;
  height: number;
  symbolSize: number;
  dropIn: boolean;
  spin: SharedValue<number>;
  pulse: SharedValue<number>;
}

const SlotCell = memo(function SlotCell({
  game,
  symbol,
  gold,
  winning,
  spinning,
  pulsing,
  column,
  step,
  width,
  height,
  symbolSize,
  dropIn,
  spin,
  pulse,
}: SlotCellProps) {
  const styles = useStyles();
  const theme = SLOT_THEMES[game];
  const golden = gold > 0;

  const motion = useAnimatedStyle(() => {
    if (spinning) return { transform: [{ translateY: (spin.get() * 1.3 - 0.65) * symbolSize }, { scale: 1 }] };
    if (pulsing) return { transform: [{ translateY: 0 }, { scale: 1 + 0.07 * pulse.get() }] };
    return { transform: [{ translateY: 0 }, { scale: 1 }] };
  });

  return (
    <View
      style={[
        styles.cell,
        { width, height },
        winning && WINNING_STYLES[game],
        golden && styles.golden,
      ]}
    >
      <Animated.View
        key={step}
        entering={dropIn ? (winning ? FADE_IN : DROP_IN)[column] : undefined}
        style={[{ width: symbolSize, height: symbolSize }, theme.screenBlend && styles.screenBlend]}
      >
        <Animated.View style={motion}>
          <SlotSymbol game={game} symbol={symbol} size={symbolSize} />
        </Animated.View>
      </Animated.View>
      {symbol === SCATTER_SYMBOL ? (
        <Text allowFontScaling={false} style={styles.scatter}>
          BONUS
        </Text>
      ) : null}
      {golden ? (
        <Text allowFontScaling={false} style={styles.goldMultiplier}>
          ×{gold + 1}
        </Text>
      ) : null}
    </View>
  );
});

const useStyles = createStyles(() => ({
  board: {
    gap: BOARD_GAP,
    padding: BOARD_PADDING,
    borderWidth: BOARD_BORDER,
    borderColor: SLOT_COLORS.boardBorder,
    borderRadius: 10,
    backgroundColor: SLOT_COLORS.boardBackground,
    boxShadow: SLOT_COLORS.boardShadow,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', gap: BOARD_GAP, flex: 1 },
  cell: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
    borderWidth: CELL_BORDER,
    borderColor: SLOT_COLORS.cellBorder,
    backgroundImage: SLOT_COLORS.cellBackground,
  },
  golden: {
    backgroundImage: SLOT_COLORS.goldenBackground,
    borderColor: SLOT_COLORS.goldenBorder,
  },
  screenBlend: { mixBlendMode: 'screen' },
  scatter: {
    position: 'absolute',
    bottom: 2,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 6,
    lineHeight: 8,
    fontWeight: '900',
    letterSpacing: 1,
    color: SLOT_COLORS.scatter,
    textShadowColor: '#000000',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  goldMultiplier: {
    position: 'absolute',
    right: 3,
    top: 2,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
    color: SLOT_COLORS.goldMultiplier,
    textShadowColor: '#000000',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
}));
