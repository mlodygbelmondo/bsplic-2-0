import { X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Modal, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIsOffline } from '@/lib/connectivity';
import { createStyles, useTheme } from '@/theme';
import { PressScale, Text } from '@/ui';
import { AdminOfflineNote } from './AdminChrome';

/**
 * The web admin `Dialog` as a native page sheet with a keyboard-aware body.
 * `locked` keeps it open (no swipe, no close button) while a request runs.
 */
export function AdminSheet({
  open,
  title,
  titleSize = 'lg',
  description,
  locked = false,
  onClose,
  onDismissed,
  children,
}: {
  open: boolean;
  title: string;
  titleSize?: 'lg' | 'base';
  description?: string;
  locked?: boolean;
  onClose: () => void;
  onDismissed?: () => void;
  children: ReactNode;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const offline = useIsOffline();

  return (
    <Modal
      visible={open}
      animationType="slide"
      presentationStyle="pageSheet"
      allowSwipeDismissal={!locked}
      onRequestClose={() => {
        if (!locked) onClose();
      }}
      onDismiss={onDismissed}
    >
      <View collapsable={false} style={styles.root}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text size={titleSize} weight="600" accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            {description ? <Text color="mutedForeground">{description}</Text> : null}
          </View>
          {locked ? null : (
            <PressScale
              accessibilityRole="button"
              accessibilityLabel="Zamknij"
              hitSlop={12}
              onPress={onClose}
              style={styles.close}
            >
              <X size={16} color={colors.foreground} />
            </PressScale>
          )}
        </View>
        <KeyboardAwareScrollView
          bottomOffset={16}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}
        >
          {offline ? <AdminOfflineNote /> : null}
          {children}
        </KeyboardAwareScrollView>
      </View>
    </Modal>
  );
}

const useStyles = createStyles(({ colors }) => ({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16 },
  headerText: { flex: 1, gap: 6 },
  title: { letterSpacing: -0.4 },
  close: { padding: 4, opacity: 0.7 },
  body: { paddingHorizontal: 16, gap: 16 },
}));
