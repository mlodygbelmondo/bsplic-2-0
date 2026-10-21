import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createStyles, hsl } from '@/theme';
import { Text } from '@/ui';

interface AuthShellProps {
  children: ReactNode;
  /** `auth` = `.auth-shell` with its decoration (login), `primary` = `.gradient-primary` (reset password). */
  background?: 'auth' | 'primary';
  /** The "BSPLIC 2.0" heading above the card (the invalid reset link state has none). */
  wordmark?: boolean;
}

/**
 * Full-screen auth layout: `h-safe-screen safe-pad-y px-4`, a scrollable
 * column that keeps the focused field above the keyboard.
 */
export function AuthShell({ children, background = 'auth', wordmark = true }: AuthShellProps) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, background === 'auth' ? styles.authBackground : styles.primaryBackground]}>
      {background === 'auth' ? (
        <View pointerEvents="none" style={styles.decoration}>
          <View style={styles.decorationBand} />
          <View style={styles.decorationGlow} />
        </View>
      ) : null}
      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: 16 + insets.top, paddingBottom: 16 + insets.bottom }]}
      >
        {wordmark ? (
          <Text weight="900" accessibilityRole="header" style={styles.wordmark}>
            BSPLIC 2.0
          </Text>
        ) : null}
        <View style={styles.column}>{children}</View>
      </KeyboardAwareScrollView>
    </View>
  );
}

/** Auth card: `bg-card rounded-2xl shadow-2xl p-6`. */
export function AuthCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return <View style={[styles.card, style]}>{children}</View>;
}

const useStyles = createStyles(({ colors, gradients, scheme }) => ({
  root: { flex: 1 },
  authBackground: { backgroundImage: gradients.authShell },
  primaryBackground: { backgroundImage: gradients.primary },
  decoration: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  // `.auth-background-decoration::before`: 34rem × 16rem band, rotated −8°.
  decorationBand: {
    position: 'absolute',
    width: 544,
    height: 256,
    top: -96,
    left: '50%',
    marginLeft: -272,
    borderRadius: 999,
    transform: [{ rotate: '-8deg' }],
    backgroundImage: `linear-gradient(100deg, transparent, ${
      scheme === 'dark' ? hsl(355, 90, 55, 0.11) : 'rgba(255, 255, 255, 0.08)'
    }, transparent)`,
  },
  // `.auth-background-decoration::after`: 22rem glow off the top-right corner.
  decorationGlow: {
    position: 'absolute',
    width: 352,
    height: 352,
    right: -128,
    top: -112,
    borderRadius: 999,
    backgroundImage: `radial-gradient(circle, ${
      scheme === 'dark' ? hsl(355, 95, 42, 0.16) : 'rgba(255, 255, 255, 0.08)'
    }, transparent 64%)`,
  },
  content: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 16 },
  // text-4xl font-black tracking-tight, mb-8
  wordmark: { fontSize: 36, lineHeight: 40, letterSpacing: -0.9, color: colors.primaryForeground, marginBottom: 32 },
  column: { width: '100%', maxWidth: 384 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: 24,
    // Tailwind `shadow-2xl`.
    boxShadow: '0px 25px 50px -12px rgba(0, 0, 0, 0.25)',
  },
}));
