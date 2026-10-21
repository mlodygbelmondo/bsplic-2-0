import { Image } from 'expo-image';
import { useState } from 'react';
import { View } from 'react-native';

import { createStyles } from '@/theme';
import { Text } from '@/ui';
import { social } from '../components/socialColors';

/** `bg-gradient-to-br from-primary via-red-700 to-neutral-950`. */
export function storyFallbackGradient(primary: string) {
  return `linear-gradient(135deg, ${primary} 0%, #b91c1c 50%, #0a0a0a 100%)`;
}

const SOCIAL_FALLBACK = storyFallbackGradient(social.primary);

/**
 * Web `StoryImage`: the avatar filling its box, or the initial on the red
 * gradient when missing or broken. Fills the parent (`h-full w-full`).
 */
export function StoryImage({
  username,
  avatarUrl,
  primary,
  recyclingKey,
}: {
  username: string;
  avatarUrl: string | null;
  /** `--primary` where the image sits (the story viewer uses the app theme, not the Social palette). */
  primary?: string;
  recyclingKey?: string;
}) {
  const styles = useStyles();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (avatarUrl && failedUrl !== avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={styles.fill}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={recyclingKey}
        onError={() => setFailedUrl(avatarUrl)}
      />
    );
  }

  return (
    <View style={[styles.fill, styles.fallback, { backgroundImage: primary ? storyFallbackGradient(primary) : SOCIAL_FALLBACK }]}>
      <Text maxFontSizeMultiplier={1} style={styles.fallbackText}>
        {username.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

const useStyles = createStyles(() => ({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  fallback: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  // `text-2xl font-black text-white`.
  fallbackText: { fontSize: 24, lineHeight: 32, fontWeight: '900', color: '#ffffff' },
}));
