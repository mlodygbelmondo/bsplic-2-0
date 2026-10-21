import { Image } from 'expo-image';
import { memo } from 'react';
import { View } from 'react-native';

import { createStyles } from '@/theme';
import { SYMBOL_SHEETS } from './art';
import { symbolSprite, type SlotGame } from './model';

/**
 * One symbol cut from its 4 × 4 sprite sheet (web `SlotSymbol`: 400% sheet,
 * `clip-path: inset(1% 1% 10% 1%)` hides the neighbour's edge and label).
 * `round` is the hub's `.slot-lobby-symbol`: the whole cell in a circle, no
 * inset, decorative (no accessibility label).
 */
export const SlotSymbol = memo(function SlotSymbol({
  game,
  symbol,
  size,
  round = false,
}: {
  game: SlotGame;
  symbol: number;
  size: number;
  round?: boolean;
}) {
  const styles = useStyles();
  const sprite = symbolSprite(game, symbol);
  const inset = round ? 0 : size * 0.01;
  return (
    <View
      accessible={!round}
      accessibilityRole={round ? undefined : 'image'}
      accessibilityLabel={round ? undefined : sprite.name}
      style={{ width: size, height: size }}
    >
      <View
        style={[
          styles.clip,
          round
            ? { left: 0, top: 0, width: size, height: size, borderRadius: size / 2 }
            : { left: inset, top: inset, width: size * 0.98, height: size * 0.89 },
        ]}
      >
        <Image
          source={SYMBOL_SHEETS[sprite.sheet]}
          contentFit="fill"
          cachePolicy="memory"
          style={{
            position: 'absolute',
            width: size * 4,
            height: size * 4,
            left: -sprite.column * size - inset,
            top: -sprite.row * size - inset,
          }}
        />
        {round ? <View style={styles.lobbyGlow} /> : null}
      </View>
    </View>
  );
});

const useStyles = createStyles(() => ({
  clip: { position: 'absolute', overflow: 'hidden' },
  lobbyGlow: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.2), transparent 62%)',
  },
}));
