import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { memo, useEffect } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '@/features/auth/auth-store';
import { blackjackSnapshotQuery } from '@/features/casino/blackjack/api/queries';
import { useHasBeenFocused } from '@/lib/focus';
import { queryClient } from '@/lib/query-client';
import { createStyles } from '@/theme';
import { PressScale, Text } from '@/ui';

import { rouletteLiveSnapshotQuery } from '../roulette/api/queries';
import { loadRouletteWheelImage } from '../roulette/components/wheelImage';
import { CasinoShell } from '../shared/CasinoShell';
import { casinoImages } from '../shared/casinoImages';
import { SERIF_FONT } from '../shared/casinoTheme';
import { SlotLobbySymbol } from './SlotLobbySymbol';
import { getSlotSymbolSize, getSlotSymbolSprite, SLOT_TILE_SYMBOLS, SLOT_TILES, type SlotGameId } from './slotTiles';

const SLOT_IMAGES: Record<SlotGameId, number> = {
  bandit: casinoImages.slotBandit,
  candy: casinoImages.slotCandy,
  ember: casinoImages.slotEmber,
  tide: casinoImages.slotTide,
};

const TABLE_GAMES = [
  { id: 'roulette', title: 'Ruletka', image: casinoImages.rouletteCover, href: '/casino/roulette' },
  { id: 'blackjack', title: 'Blackjack', image: casinoImages.blackjackCover, href: '/casino/blackjack' },
] as const;

/** Warms the game's first data while the finger is still down, so the screen opens filled in. */
function prefetchGame(id: 'roulette' | 'blackjack' | SlotGameId) {
  if (id === 'roulette') {
    void queryClient.prefetchQuery(rouletteLiveSnapshotQuery());
    void loadRouletteWheelImage();
    return;
  }
  if (id === 'blackjack') {
    const userId = useAuthStore.getState().user?.id;
    if (userId) void queryClient.prefetchQuery(blackjackSnapshotQuery(userId));
  }
}

function openGame(href: Href) {
  router.push(href);
}

/**
 * Casino hub, the "Gry" tab (web `CasinoHub`): "Wybierz grę" over the hub
 * artwork, four slot tiles, then Ruletka and Blackjack.
 */
export function CasinoHubScreen() {
  // NativeTabs mounts every tab at launch; draw the artwork on first visit.
  const visited = useHasBeenFocused();
  return <CasinoShell>{visited ? <HubContent /> : null}</CasinoShell>;
}

function HubContent() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  // Decode the wheel artwork while the player picks a game, so the table
  // never opens with an empty wheel.
  useEffect(() => {
    void loadRouletteWheelImage();
  }, []);
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + 20 }]}
    >
      <Image
        source={casinoImages.hubMobileBackground}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition="center"
        cachePolicy="memory"
        accessible={false}
      />
      <View pointerEvents="none" style={styles.pageOverlay} />
      <View style={styles.inner}>
        <View style={styles.heading}>
          <Text accessibilityRole="header" weight="900" style={styles.title}>
            Wybierz grę
          </Text>
        </View>

        <View style={styles.grid}>
          {SLOT_TILES.map((tile) => (
            <SlotTile key={tile.id} id={tile.id} title={tile.title} offset={tile.offset} />
          ))}
          {TABLE_GAMES.map((game) => (
            <TableGameTile key={game.id} id={game.id} title={game.title} image={game.image} href={game.href} />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const SlotTile = memo(function SlotTile({ id, title, offset }: { id: SlotGameId; title: string; offset: number }) {
  const styles = useStyles();
  const { width } = useWindowDimensions();

  return (
    <PressScale
      scaleTo={0.98}
      accessibilityRole="link"
      accessibilityLabel={`${title}, Zagraj`}
      onPressIn={() => prefetchGame(id)}
      onPress={() => openGame(`/casino/slots/${id}`)}
      style={[styles.tile, styles.slotTile]}
    >
      <Image
        source={SLOT_IMAGES[id]}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition={{ top: '30%', left: '50%' }}
        cachePolicy="memory"
        accessible={false}
      />
      <View pointerEvents="none" style={styles.slotShade} />
      <View pointerEvents="none" style={styles.symbolRow}>
        {SLOT_TILE_SYMBOLS.map((symbol, index) => (
          <SlotLobbySymbol
            key={symbol}
            sprite={getSlotSymbolSprite(offset, symbol)}
            size={getSlotSymbolSize(width, index === 1)}
            small={index !== 1}
          />
        ))}
      </View>
      <View pointerEvents="none" style={styles.slotGlow} />
      <TileCaption title={title} />
    </PressScale>
  );
});

const TableGameTile = memo(function TableGameTile({
  id,
  title,
  image,
  href,
}: {
  id: 'roulette' | 'blackjack';
  title: string;
  image: number;
  href: Href;
}) {
  const styles = useStyles();
  return (
    <PressScale
      scaleTo={0.98}
      accessibilityRole="link"
      accessibilityLabel={`${title}, Zagraj`}
      onPressIn={() => prefetchGame(id)}
      onPress={() => openGame(href)}
      style={[styles.tile, styles.tableTile]}
    >
      <Image
        source={image}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition={{ top: '35%', left: '50%' }}
        cachePolicy="memory"
        accessible={false}
      />
      <View pointerEvents="none" style={styles.tableShade} />
      <TileCaption title={title} />
    </PressScale>
  );
});

function TileCaption({ title }: { title: string }) {
  const styles = useStyles();
  return (
    <View style={styles.caption}>
      <Text weight="900" style={styles.tileTitle}>
        {title}
      </Text>
      <View style={styles.cta}>
        <Text size="xs" weight="700" style={styles.ctaText}>
          Zagraj →
        </Text>
      </View>
    </View>
  );
}

const useStyles = createStyles(() => ({
  // `p-4 pt-6 pb-[nav padding]`: the bottom padding adds the tab bar inset.
  page: { flexGrow: 1, overflow: 'hidden', paddingHorizontal: 16, paddingTop: 24 },
  pageOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundImage:
      'radial-gradient(circle at 50% 0%, rgba(251, 191, 36, 0.18), transparent 34%), linear-gradient(180deg, rgba(10, 5, 8, 0.54), rgba(5, 4, 7, 0.92) 58%, rgba(5, 4, 7, 0.98))',
  },
  inner: { gap: 32 },
  heading: { paddingTop: 16, alignItems: 'center' },
  // `text-4xl font-black uppercase tracking-wider text-white drop-shadow-lg`.
  title: {
    fontSize: 36,
    lineHeight: 40,
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 1.8,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 3,
  },
  grid: { gap: 20 },
  tile: {
    minHeight: 290,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(253, 230, 138, 0.3)',
    backgroundColor: '#000000',
    borderCurve: 'continuous',
  },
  slotTile: { borderRadius: 24 },
  tableTile: { borderRadius: 16 },
  slotShade: {
    ...StyleSheet.absoluteFill,
    backgroundImage: 'linear-gradient(to top, #000000, rgba(0, 0, 0, 0.1), transparent)',
  },
  tableShade: {
    ...StyleSheet.absoluteFill,
    backgroundImage: 'linear-gradient(to top, #000000, transparent, transparent)',
  },
  symbolRow: {
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
  slotGlow: {
    ...StyleSheet.absoluteFill,
    backgroundImage:
      'radial-gradient(circle at 50% 36%, rgba(255, 255, 255, 0.16), transparent 30%), linear-gradient(180deg, rgba(0, 0, 0, 0.02), rgba(0, 0, 0, 0.72) 78%, rgba(0, 0, 0, 0.92))',
  },
  caption: { alignSelf: 'flex-end', padding: 24 },
  // `mb-2 font-serif text-4xl font-black tracking-tight`.
  tileTitle: { fontFamily: SERIF_FONT, fontSize: 36, lineHeight: 40, letterSpacing: -0.9, color: '#ffffff', marginBottom: 8 },
  // `mt-4 inline-block rounded-full bg-white/15 px-4 py-2 text-xs font-bold`.
  cta: {
    marginTop: 16,
    alignSelf: 'flex-start',
    borderRadius: 9999,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  ctaText: { color: '#ffffff' },
}));
