import { X } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { createStyles } from '@/theme';
import { Text } from '@/ui';
import { social } from '../components/socialColors';

/**
 * Web composer `SheetHeader` (`border-b px-4 pb-3 pt-4 text-center`, title
 * `text-base font-bold`) with the shadcn sheet close button at the top right.
 */
export function ComposerHeader({ title, onClose }: { title: string; onClose: () => void }) {
  const styles = useStyles();
  return (
    <View style={styles.header}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Zamknij"
        hitSlop={14}
        onPress={onClose}
        style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
      >
        <X size={16} color={social.foreground} />
      </Pressable>
    </View>
  );
}

const useStyles = createStyles(() => ({
  header: {
    borderBottomWidth: 1,
    borderBottomColor: social.border,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: { textAlign: 'center', fontSize: 16, lineHeight: 24, fontWeight: '700', color: social.foreground },
  // `absolute right-4 top-4 rounded-sm opacity-70`.
  close: { position: 'absolute', top: 16, right: 16, padding: 4, borderRadius: 2, opacity: 0.7 },
  closePressed: { opacity: 1 },
}));
