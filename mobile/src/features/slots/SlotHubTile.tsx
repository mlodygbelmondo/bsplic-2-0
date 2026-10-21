import { Image } from 'expo-image';
import { router } from 'expo-router';
import { memo } from 'react';
import { Platform, Pressable, useWindowDimensions, View } from 'react-native';

import { createStyles } from '@/theme';
import { Text } from '@/ui';
import { SLOT_ART } from './art';
import { SLOT_GAMES, type SlotGame } from './model';
import { SlotSymbol } from './SlotSymbol';

/** Hub symbols per tile (web `CasinoHub`: sprite indices 1, 2, 6; the middle one large). */
const HUB_SYMBOLS = [1, 2, 6] as const;

/**
 * One slot tile of the casino hub (web `CasinoHub` slot cards). The hub
 * renders the four tiles in `SLOT_GAME_IDS` order before Ruletka and Blackjack.
 */
export const SlotHubTile = memo(function SlotHubTile({ game }: { game: SlotGame }) {
  const styles = useStyles();
  const { width } = useWindowDimensions();
  // `.slot-lobby-symbol` widths: clamp(4.5rem, 17vw, 8rem) and clamp(3.35rem, 12vw, 5.8rem).
  const large = Math.min(128, Math.max(72, width * 0.17));
  const small = Math.min(92.8, Math.max(53.6, width * 0.12));
  const title = SLOT_GAMES[game].title;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${title} Zagraj →`}
      onPress={() => router.push({ pathname: '/casino/slots/[game]', params: { game } })}
      style={styles.tile}
    >
      <Image source={SLOT_ART[game]} contentFit="cover" contentPosition={{ left: '50%', top: '30%' }} style={styles.fill} />
      <View style={[styles.fill, styles.bottomFade]} />
      <View pointerEvents="none" style={styles.symbols}>
        {HUB_SYMBOLS.map((symbol, index) => (
          <View key={symbol} style={index === 1 ? undefined : styles.smallSymbol}>
            <SlotSymbol game={game} symbol={symbol} size={index === 1 ? large : small} round />
          </View>
        ))}
      </View>
      <View style={[styles.fill, styles.glow]} />
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.cta}>
          <Text size="xs" weight="700" style={styles.ctaText}>
            Zagraj →
          </Text>
        </View>
      </View>
    </Pressable>
  );
});

const useStyles = createStyles(() => ({
  tile: {
    minHeight: 290,
    overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(253, 230, 138, 0.3)',
    backgroundColor: '#000000',
    justifyContent: 'flex-end',
  },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  bottomFade: { backgroundImage: 'linear-gradient(to top, #000000, rgba(0, 0, 0, 0.1), transparent)' },
  symbols: {
    position: 'absolute',
    left: '12%',
    right: '12%',
    top: '24%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    opacity: 0.9,
  },
  smallSymbol: { opacity: 0.78 },
  glow: {
    backgroundImage:
      'radial-gradient(circle at 50% 36%, rgba(255, 255, 255, 0.16), transparent 30%), linear-gradient(180deg, rgba(0, 0, 0, 0.02), rgba(0, 0, 0, 0.72) 78%, rgba(0, 0, 0, 0.92))',
  },
  text: { padding: 24 },
  title: {
    marginBottom: 8,
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '900',
    letterSpacing: -0.9,
    color: '#ffffff',
  },
  cta: {
    alignSelf: 'flex-start',
    marginTop: 16,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  ctaText: { color: '#ffffff' },
}));
