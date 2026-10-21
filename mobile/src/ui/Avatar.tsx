import { Image } from 'expo-image';
import { useState } from 'react';
import { View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { createStyles } from '@/theme';
import { Text } from './Text';

interface AvatarProps {
  uri?: string | null;
  /** Used for the fallback initials and the accessibility label. */
  name: string;
  size?: number;
  /** Number of fallback initials (web uses 1 in most places, 2 in casino feeds). */
  initials?: 1 | 2;
  style?: StyleProp<ViewStyle>;
  fallbackStyle?: StyleProp<ViewStyle>;
  fallbackTextStyle?: StyleProp<TextStyle>;
  /** List rows pass the row id so recycled cells never flash the previous image. */
  recyclingKey?: string;
}

/** Port of the shadcn Avatar: image with an initials fallback when missing or broken. */
export function Avatar({
  uri,
  name,
  size = 32,
  initials = 1,
  style,
  fallbackStyle,
  fallbackTextStyle,
  recyclingKey,
}: AvatarProps) {
  const styles = useStyles();
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const showImage = Boolean(uri) && failedUri !== uri;
  const label = name.slice(0, initials).toUpperCase();

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Avatar ${name}`}
      style={[styles.root, { width: size, height: size, borderRadius: size / 2 }, style]}
    >
      {showImage ? (
        <Image
          source={{ uri: uri! }}
          style={styles.image}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={recyclingKey}
          transition={120}
          onError={() => setFailedUri(uri ?? null)}
        />
      ) : (
        <View style={[styles.fallback, fallbackStyle]}>
          <Text weight="700" style={[styles.fallbackText, { fontSize: Math.max(9, size * 0.4) }, fallbackTextStyle]}>
            {label}
          </Text>
        </View>
      )}
    </View>
  );
}

const useStyles = createStyles((p) => ({
  root: { overflow: 'hidden', backgroundColor: p.colors.muted },
  image: { width: '100%', height: '100%' },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.colors.muted },
  fallbackText: { color: p.colors.mutedForeground },
}));
