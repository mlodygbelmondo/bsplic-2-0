import { View } from 'react-native';

import { useBootHold } from '@/features/boot/boot-store';
import { useIsOffline } from '@/lib/connectivity';
import { BrandSpinner } from './BrandSpinner';
import { Text } from './Text';

/**
 * Web `SectionLoader`: centered brand spinner with a label. Holds the boot
 * splash while it is visible, so the first screen appears once with data.
 * Offline, queries pause until the connection returns: it says so instead of
 * spinning, and lets the splash go.
 */
export function SectionLoader({ size = 'md', label = 'Ładowanie...' }: { size?: 'md' | 'sm'; label?: string }) {
  const offline = useIsOffline();
  useBootHold(!offline);
  const text = offline ? 'Brak połączenia. Wczytamy dane, gdy wrócisz online.' : label;
  return (
    <View
      accessibilityRole={offline ? undefined : 'progressbar'}
      accessibilityLabel={text}
      style={{ alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: size === 'sm' ? 28 : 56 }}
    >
      {offline ? null : <BrandSpinner size={size} />}
      <Text color="mutedForeground" weight="500" align="center" style={{ fontSize: 13, paddingHorizontal: 24 }}>
        {text}
      </Text>
    </View>
  );
}
