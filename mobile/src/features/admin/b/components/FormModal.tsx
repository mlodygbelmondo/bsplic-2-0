import type { ReactNode } from 'react';
import { Modal, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createStyles } from '@/theme';
import { SheetHeader } from '@/ui';

/** Web admin `Dialog` as a native page sheet with the dialog title and close button. */
export function FormModal({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.root}>
        <SheetHeader title={title} onClose={onClose} />
        <KeyboardAwareScrollView
          keyboardShouldPersistTaps="handled"
          bottomOffset={24}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        >
          {children}
        </KeyboardAwareScrollView>
      </View>
    </Modal>
  );
}

const useStyles = createStyles(({ colors }) => ({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 4, gap: 16 },
}));
