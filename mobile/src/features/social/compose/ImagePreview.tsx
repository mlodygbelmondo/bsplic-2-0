import { Image } from 'expo-image';
import { ImagePlus, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { alpha, createStyles } from '@/theme';
import { Text } from '@/ui';
import { social } from '../components/socialColors';
import type { SocialImageAttachment } from '../images';

/** Web `max-h-44`. */
const MAX_PREVIEW_HEIGHT = 176;

/**
 * Web `SocialImagePreview`: compressed size, remove button and the image at
 * its natural ratio (at most 176 pt high and the box width).
 */
export function ImagePreview({ image, onRemove }: { image: SocialImageAttachment; onRemove: () => void }) {
  const styles = useStyles();
  const [boxWidth, setBoxWidth] = useState(0);
  const ratio = image.width / image.height;
  const width = Math.min(boxWidth, image.width, MAX_PREVIEW_HEIGHT * ratio);
  const height = width / ratio;

  return (
    <View style={styles.box}>
      <View style={styles.header}>
        <View style={styles.size}>
          <ImagePlus size={14} color={social.mutedForeground} />
          <Text style={styles.sizeText}>Zdjęcie po kompresji: {Math.round(image.sizeBytes / 1024)} KB</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Usuń zdjęcie"
          hitSlop={10}
          onPress={onRemove}
          style={({ pressed }) => [styles.remove, pressed && styles.removePressed]}
        >
          <X size={16} color={social.mutedForeground} />
        </Pressable>
      </View>
      <View onLayout={(event) => setBoxWidth(event.nativeEvent.layout.width)}>
        {boxWidth > 0 ? (
          <Image
            source={{ uri: image.uri }}
            accessibilityLabel="Podgląd wklejonego zdjęcia"
            contentFit="cover"
            style={[styles.image, { width, height }]}
          />
        ) : null}
      </View>
    </View>
  );
}

const useStyles = createStyles(() => ({
  // `rounded-lg border border-border bg-muted/30 p-2`; callers space it (`mt-2` / `space-y-*`).
  box: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: social.border,
    backgroundColor: alpha(social.muted, 0.3),
    padding: 8,
  },
  // `flex items-center justify-between mb-2`.
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  size: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  sizeText: { fontSize: 12, lineHeight: 16, color: social.mutedForeground },
  // `rounded-md p-1`.
  remove: { borderRadius: 6, padding: 4 },
  removePressed: { backgroundColor: social.muted },
  // `rounded-md object-cover border border-border`.
  image: { borderRadius: 6, borderWidth: 1, borderColor: social.border },
}));
