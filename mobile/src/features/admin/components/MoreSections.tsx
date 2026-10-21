import { View } from 'react-native';

import { alpha, createStyles, useTheme } from '@/theme';
import { PressScale, Text } from '@/ui';
import type { AdminTabConfig } from '../admin-tabs';
import type { AdminTab } from '../constants';
import { ADMIN_TAB_ICONS } from './AdminBottomNav';

/** Web "Więcej" tab body: `Pozostałe sekcje` cards for the lower-frequency tabs. */
export function MoreSections({
  tabs,
  onSelect,
}: {
  tabs: AdminTabConfig[];
  onSelect: (tab: AdminTab) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <View style={styles.root}>
      <Text size="base" weight="600" accessibilityRole="header">
        Pozostałe sekcje
      </Text>
      <View style={styles.grid}>
        {tabs.map(({ key, label }) => {
          const Icon = ADMIN_TAB_ICONS[key];
          return (
            <PressScale
              key={key}
              scaleTo={0.98}
              accessibilityRole="button"
              accessibilityLabel={label}
              onPress={() => onSelect(key)}
              style={styles.card}
            >
              <View style={styles.iconBox}>
                <Icon size={20} color={colors.primary} />
              </View>
              <Text size="base" weight="600" style={styles.label}>
                {label}
              </Text>
            </PressScale>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = createStyles(({ colors, gradients, shadows, scheme, radius }) => ({
  root: { gap: 12 },
  grid: { gap: 12 },
  // `rounded-xl bg-card p-4 card-shadow` (+ the `.card-shadow.bg-card` surface).
  card: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: scheme === 'dark' ? alpha(colors.border, 0.82) : colors.border,
    backgroundColor: colors.card,
    backgroundImage: gradients.bookmakerSurface,
    boxShadow: shadows.card,
    padding: 16,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha(colors.primary, 0.1),
  },
  label: { flex: 1 },
}));
