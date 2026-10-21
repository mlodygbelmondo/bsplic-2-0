import type { ReactNode } from 'react';
import { Modal, type StyleProp, type ViewStyle } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createStyles } from '@/theme';

/** shadcn `DialogContent` open animation: fade-in + zoom-in-95, 200 ms. */
const DIALOG_ENTER = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.95 }] },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: Easing.out(Easing.cubic) },
}).duration(200);

/**
 * Centered dialog in a native modal window, matching the web shadcn Dialog at
 * phone width: `bg-black/80` overlay, `w-[calc(100%-2rem)] rounded-lg border
 * bg-background shadow-lg` card. Used by the bonus and poll surfaces.
 */
export function DialogModal({
  visible,
  onRequestClose,
  maxWidth,
  cardStyle,
  accessibilityLabel,
  children,
}: {
  visible: boolean;
  /** Android back button / iOS accessibility escape. */
  onRequestClose: () => void;
  /** Web `max-w-[…]` of the dialog. */
  maxWidth: number;
  cardStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  children: ReactNode;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onRequestClose}
    >
      <KeyboardAvoidingView
        behavior="padding"
        style={[styles.overlay, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}
      >
        <Animated.View
          entering={DIALOG_ENTER}
          accessibilityViewIsModal
          accessibilityLabel={accessibilityLabel}
          style={[styles.card, { maxWidth }, cardStyle]}
        >
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = createStyles(({ colors, radius }) => ({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  card: {
    width: '100%',
    maxHeight: '100%',
    overflow: 'hidden',
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    boxShadow: '0px 25px 50px -12px rgba(0, 0, 0, 0.25)',
  },
}));
