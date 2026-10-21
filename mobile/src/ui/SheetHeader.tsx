import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme';
import { PressScale } from './PressScale';
import { Text } from './Text';

/** Title row for native form sheets, with the web dialog's close (X) button. */
export function SheetHeader({
  title,
  description,
  onClose = () => router.back(),
  right,
}: {
  title: string;
  description?: string;
  onClose?: () => void;
  right?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 }}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text size="lg" weight="700">
          {title}
        </Text>
        {description ? <Text color="mutedForeground">{description}</Text> : null}
      </View>
      {right}
      <PressScale accessibilityRole="button" accessibilityLabel="Zamknij" hitSlop={10} onPress={onClose} style={{ padding: 4, opacity: 0.7 }}>
        <X size={18} color={colors.foreground} />
      </PressScale>
    </View>
  );
}
