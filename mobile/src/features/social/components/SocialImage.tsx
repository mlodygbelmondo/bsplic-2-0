import { Image, type ImageLoadEventData } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable } from 'react-native';

import { createStyles } from '@/theme';
import { social } from './socialColors';

/** Web `max-h-80`. */
const MAX_HEIGHT = 320;
/** Height guess before the first load (4:3), replaced by the real ratio. */
const DEFAULT_RATIO = 3 / 4;

interface ImageSize {
  width: number;
  height: number;
}

/** Natural sizes of loaded images, so recycled cells lay out at the right height at once. */
const sizeCache = new Map<string, ImageSize>();

/**
 * Inline post/comment image (web `<img class="rounded-lg border max-h-80
 * object-cover">`): natural size, at most the content width, cropped to 320 pt
 * high. Tapping opens the full-screen viewer.
 */
export function SocialImage({
  uri,
  alt,
  maxWidth,
  recyclingKey,
}: {
  uri: string;
  alt: string;
  maxWidth: number;
  recyclingKey?: string;
}) {
  const styles = useStyles();
  const [size, setSize] = useState<ImageSize | undefined>(() => sizeCache.get(uri));
  const width = size ? Math.min(maxWidth, size.width) : maxWidth;
  const height = Math.min(MAX_HEIGHT, size ? (width * size.height) / size.width : width * DEFAULT_RATIO);

  const handleLoad = (event: ImageLoadEventData) => {
    const next = { width: event.source.width, height: event.source.height };
    if (next.width <= 0 || next.height <= 0) return;
    sizeCache.set(uri, next);
    if (!size || size.width !== next.width || size.height !== next.height) setSize(next);
  };

  return (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityLabel={alt}
      accessibilityHint="Otwiera zdjęcie na pełnym ekranie"
      onPress={() => router.push({ pathname: '/sheets/image-viewer', params: { uri } })}
      style={styles.press}
    >
      <Image
        source={{ uri }}
        style={[styles.image, { width, height }]}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={recyclingKey}
        transition={120}
        onLoad={handleLoad}
      />
    </Pressable>
  );
}

const useStyles = createStyles(({ radius }) => ({
  press: { alignSelf: 'flex-start' },
  image: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: social.border,
    backgroundColor: social.muted,
  },
}));
