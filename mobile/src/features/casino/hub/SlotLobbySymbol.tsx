import { Image } from 'expo-image';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { createStyles } from '@/theme';

import { casinoImages } from '../shared/casinoImages';
import type { SlotSymbolSprite } from './slotTiles';

const SHEETS = {
  symbols: casinoImages.slotSymbols,
  'forge-tide': casinoImages.slotSymbolsForgeTide,
} as const;

/**
 * `.slot-lobby-symbol`: one cell of a 4×4 symbol sheet clipped to a circle,
 * a soft white center glow, and two drop shadows (dark below, warm glow
 * around). Nested views apply the shadows in CSS filter order.
 */
export const SlotLobbySymbol = memo(function SlotLobbySymbol({
  sprite,
  size,
  small,
}: {
  sprite: SlotSymbolSprite;
  size: number;
  small: boolean;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.glow, small && styles.small]}>
      <View style={styles.shadow}>
        <View style={[styles.clip, { width: size, height: size, borderRadius: size / 2 }]}>
          <Image
            source={SHEETS[sprite.sheet]}
            style={{
              position: 'absolute',
              width: size * 4,
              height: size * 4,
              left: -sprite.column * size,
              top: -sprite.row * size,
            }}
            contentFit="fill"
            cachePolicy="memory"
          />
          <View style={styles.centerGlow} />
        </View>
      </View>
    </View>
  );
});

const useStyles = createStyles(() => ({
  glow: { filter: 'drop-shadow(0px 0px 18px rgba(255, 219, 132, 0.24))' },
  shadow: { filter: 'drop-shadow(0px 12px 16px rgba(0, 0, 0, 0.72))' },
  small: { opacity: 0.78 },
  clip: { overflow: 'hidden' },
  centerGlow: {
    ...StyleSheet.absoluteFill,
    backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.2), transparent 62%)',
  },
}));
