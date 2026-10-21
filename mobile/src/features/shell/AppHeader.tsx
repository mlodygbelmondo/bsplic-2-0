import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createStyles } from '@/theme';
import { Text } from '@/ui';

interface AppHeaderProps {
  /** Pushed screens (public profile, social item, replay, admin) show a back button. */
  back?: boolean;
}

/**
 * Mobile part of the web `Navbar`: gradient bar with the wordmark, balance
 * chip, notifications bell and menu button. Every signed-in screen renders it
 * at the top, outside its scroll view.
 *
 * SCAFFOLD — the shell worker owns this file and completes it.
 */
export function AppHeader(_props: AppHeaderProps) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        <Text size="base" weight="900" italic style={styles.wordmark}>
          BSPLIC 2.0
        </Text>
      </View>
    </View>
  );
}

const useStyles = createStyles((p) => ({
  bar: { backgroundImage: p.gradients.navbar, backgroundColor: p.colors.navbar },
  row: { height: 44, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  wordmark: { color: p.colors.navbarForeground, letterSpacing: -0.4 },
}));
