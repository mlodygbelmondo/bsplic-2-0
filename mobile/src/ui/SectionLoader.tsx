import { View } from 'react-native';

import { useBootHold } from '@/features/boot/boot-store';
import { BrandSpinner } from './BrandSpinner';
import { Text } from './Text';

/**
 * Web `SectionLoader`: centered brand spinner with a label. Holds the boot
 * splash while it is visible, so the first screen appears once with data.
 */
export function SectionLoader({ size = 'md', label = 'Ładowanie...' }: { size?: 'md' | 'sm'; label?: string }) {
  useBootHold();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={{ alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: size === 'sm' ? 28 : 56 }}
    >
      <BrandSpinner size={size} />
      <Text color="mutedForeground" weight="500" style={{ fontSize: 13 }}>
        {label}
      </Text>
    </View>
  );
}
