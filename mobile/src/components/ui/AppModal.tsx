import { Modal, Pressable, ScrollView, StyleSheet, View, type ModalProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/hooks/use-app-theme';

import { AppText } from './AppText';

export interface AppModalProps extends Omit<ModalProps, 'children'> {
  title: string;
  onClose(): void;
  children: React.ReactNode;
  presentation?: 'center' | 'sheet';
}

export function AppModal({
  title,
  onClose,
  children,
  presentation = 'sheet',
  ...props
}: AppModalProps) {
  const { tokens } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal animationType="fade" transparent statusBarTranslucent onRequestClose={onClose} {...props}>
      <View style={[styles.overlay, { backgroundColor: tokens.colors.overlay }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Zamknij"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.content,
            presentation === 'center' ? styles.center : styles.sheet,
            {
              backgroundColor: tokens.colors.popover,
              borderColor: tokens.colors.border,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <View style={styles.header}>
            <AppText variant="subtitle">{title}</AppText>
            <Pressable accessibilityRole="button" accessibilityLabel="Zamknij" hitSlop={12} onPress={onClose}>
              <AppText variant="title" tone="muted">×</AppText>
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  content: { borderWidth: StyleSheet.hairlineWidth, maxHeight: '90%' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  center: { alignSelf: 'center', width: '90%', maxWidth: 420, borderRadius: 20, marginBottom: '35%' },
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  body: { padding: 18, paddingTop: 4 },
});
