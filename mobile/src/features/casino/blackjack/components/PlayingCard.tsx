import { Image } from 'expo-image';
import { memo, useEffect } from 'react';
import { Text as RNText, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { createStyles, fonts } from '@/theme';
import type { Card } from '../api/blackjack';
import { BLACKJACK_CARD_REVERSE_IMAGE } from '../assets';
import { bj } from './tokens';

interface PlayingCardProps {
  card: Card;
  hidden?: boolean;
  dealTarget?: 'dealer' | 'player';
  index?: number;
  /** Short phones in a decision state: 64 x 88 instead of 80 x 112. */
  compact?: boolean;
  /** Overlap margin inside the hand row. */
  style?: StyleProp<ViewStyle>;
}

// U+FE0E keeps the suits as text glyphs (never emoji) so they take the suit color.
const SUIT_SYMBOLS: Record<Card['suit'], string> = {
  hearts: '♥︎',
  diamonds: '♦︎',
  clubs: '♣︎',
  spades: '♠︎',
};

const SUIT_LABELS: Record<Card['suit'], string> = {
  hearts: 'kier',
  diamonds: 'karo',
  clubs: 'trefl',
  spades: 'pik',
};

// framer-motion `easeOut` / `easeInOut`.
const DEAL_TIMING = { duration: 180, easing: Easing.bezier(0, 0, 0.58, 1) };
const FLIP_TIMING = { duration: 450, easing: Easing.bezier(0.42, 0, 0.58, 1) };

/**
 * A card that deals in from the shoe side (scale 0.82 → 1, fading in from an
 * offset) and flips around the Y axis when it is turned. Both motions run on
 * the UI thread; existing cards never replay the deal on re-render.
 */
export const PlayingCard = memo(function PlayingCard({
  card,
  hidden = false,
  dealTarget = 'player',
  index = 0,
  compact = false,
  style,
}: PlayingCardProps) {
  const styles = useStyles();
  const isDealerHiddenCard = hidden && dealTarget === 'dealer';
  const delay = isDealerHiddenCard ? 120 : Math.min(index * 25, 75);
  const offsetX = dealTarget === 'dealer' ? 28 : 34;
  const offsetY = dealTarget === 'dealer' ? 14 : -18;

  const dealt = useSharedValue(0);
  const rotation = useSharedValue(hidden ? 180 : 0);

  useEffect(() => {
    dealt.set(withDelay(delay, withTiming(1, DEAL_TIMING)));
  }, [dealt, delay]);

  useEffect(() => {
    rotation.set(withTiming(hidden ? 180 : 0, FLIP_TIMING));
  }, [rotation, hidden]);

  const dealStyle = useAnimatedStyle(() => {
    const progress = dealt.get();
    return {
      opacity: progress,
      transform: [
        { translateX: offsetX * (1 - progress) },
        { translateY: offsetY * (1 - progress) },
        { scale: 0.82 + 0.18 * progress },
      ],
    };
  });
  const faceStyle = useAnimatedStyle(() => {
    const deg = rotation.get();
    return { opacity: deg <= 90 ? 1 : 0, transform: [{ perspective: 600 }, { rotateY: `${deg}deg` }] };
  });
  const backStyle = useAnimatedStyle(() => {
    const deg = rotation.get();
    return { opacity: deg > 90 ? 1 : 0, transform: [{ perspective: 600 }, { rotateY: `${deg + 180}deg` }] };
  });

  const symbol = SUIT_SYMBOLS[card.suit];
  const color = card.suit === 'hearts' || card.suit === 'diamonds' ? styles.red : styles.dark;

  return (
    <Animated.View
      accessible
      accessibilityRole="image"
      accessibilityLabel={hidden ? 'Rewers karty' : `${card.rank} ${SUIT_LABELS[card.suit]}`}
      style={[styles.card, compact && styles.compact, style, { zIndex: hidden ? 0 : index + 1 }, dealStyle]}
    >
      <Animated.View style={[styles.side, styles.face, faceStyle]}>
        <View style={styles.corner}>
          <RNText allowFontScaling={false} style={[styles.rank, color]}>
            {card.rank}
          </RNText>
          <RNText allowFontScaling={false} style={[styles.suit, color]}>
            {symbol}
          </RNText>
        </View>
        <View pointerEvents="none" style={styles.center}>
          <RNText allowFontScaling={false} style={[styles.centerSuit, color]}>
            {symbol}
          </RNText>
        </View>
        <View style={[styles.corner, styles.cornerBottom]}>
          <RNText allowFontScaling={false} style={[styles.rank, color]}>
            {card.rank}
          </RNText>
          <RNText allowFontScaling={false} style={[styles.suit, color]}>
            {symbol}
          </RNText>
        </View>
      </Animated.View>
      <Animated.View style={[styles.side, styles.back, backStyle]}>
        <Image source={BLACKJACK_CARD_REVERSE_IMAGE} style={styles.backImage} contentFit="fill" />
      </Animated.View>
    </Animated.View>
  );
});

const CARD_SHADOW = '0px 6px 18px rgba(0, 0, 0, 0.45)';

const useStyles = createStyles(() => ({
  // `h-28 w-20`
  card: { width: 80, height: 112, flexShrink: 0 },
  // blackjack-mobile.css: 64 x 88 on short phones
  compact: { width: 64, height: 88 },
  side: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 12,
    borderCurve: 'continuous',
    backfaceVisibility: 'hidden',
    boxShadow: CARD_SHADOW,
  },
  // `rounded-xl border border-black/10 bg-gradient-to-br from-white via-white to-slate-200 p-2`
  face: {
    justifyContent: 'space-between',
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    backgroundColor: bj.white,
    backgroundImage: 'linear-gradient(to bottom right, #ffffff, #ffffff, #e2e8f0)',
  },
  back: {},
  backImage: { width: '100%', height: '100%', borderRadius: 12 },
  corner: { alignSelf: 'flex-start', alignItems: 'center' },
  cornerBottom: { alignSelf: 'flex-end', transform: [{ rotate: '180deg' }] },
  // `text-base font-bold leading-none`
  rank: { fontFamily: fonts.family, fontSize: 16, lineHeight: 16, fontWeight: '700' },
  // `text-sm leading-none`
  suit: { fontSize: 14, lineHeight: 16 },
  center: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.15,
  },
  // `text-5xl`
  centerSuit: { fontSize: 48, lineHeight: 52 },
  red: { color: bj.red500 },
  dark: { color: bj.zinc800 },
}));
