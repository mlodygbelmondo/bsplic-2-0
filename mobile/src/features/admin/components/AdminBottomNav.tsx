import {
  BadgePlus,
  Bot,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  MoreHorizontal,
  PlusCircle,
  Tag,
  Vote,
  type LucideIcon,
} from 'lucide-react-native';
import { memo } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptics } from '@/lib/haptics';
import { createStyles, useScheme } from '@/theme';
import { Glass, PressScale, Text } from '@/ui';
import { isMobileSlotActive, type AdminTabConfig } from '../admin-tabs';
import type { AdminTab } from '../constants';

export const ADMIN_TAB_ICONS: Record<AdminTab, LucideIcon> = {
  dashboard: LayoutDashboard,
  manage: ListChecks,
  create: PlusCircle,
  proposals: Lightbulb,
  categories: Tag,
  eniu: Bot,
  agent: Bot,
  bonuses: BadgePlus,
  'feature-polls': Vote,
  more: MoreHorizontal,
};

const BAR_HEIGHT = 72;
/** `pb-[calc(0.55rem+env(safe-area-inset-bottom))]`. */
const BAR_BOTTOM_GAP = 8.8;

/** Web `liquidGlassMobileNavStyles` for the default (non-casino) tone. */
const TONE = {
  light: {
    shell: 'rgba(255, 255, 255, 0.86)',
    border: 'rgba(255, 255, 255, 0.78)',
    shadow:
      '0px -12px 38px rgba(15, 23, 42, 0.16), 0px -4px 24px rgba(230, 0, 26, 0.08), inset 0px 1px 0px rgba(255, 255, 255, 0.95), 0px 0px 0px 1px rgba(230, 0, 26, 0.16)',
    activeText: '#c90018',
    activeBg: 'rgba(201, 0, 24, 0.1)',
    activeShadow:
      '0px 0px 0px 1px rgba(201, 0, 24, 0.12), 0px 4px 12px rgba(201, 0, 24, 0.1), inset 0px 1px 0px rgba(255, 255, 255, 0.92)',
    inactiveText: 'rgba(2, 6, 23, 0.82)',
  },
  dark: {
    shell: 'rgba(23, 8, 17, 0.88)',
    border: 'rgba(255, 255, 255, 0.12)',
    shadow:
      '0px -12px 42px rgba(80, 0, 28, 0.48), inset 0px 1px 0px rgba(255, 255, 255, 0.16), 0px 0px 0px 1px rgba(255, 51, 95, 0.12)',
    activeText: '#ffe14a',
    activeBg: 'rgba(255, 255, 255, 0.11)',
    activeShadow:
      '0px 0px 0px 1px rgba(255, 255, 255, 0.16), 0px 10px 24px rgba(255, 225, 74, 0.18), inset 0px 1px 0px rgba(255, 255, 255, 0.28)',
    inactiveText: 'rgba(255, 255, 255, 0.68)',
  },
} as const;

/** Total height the bar occupies, so `translate-y-full` moves it fully off screen. */
export function useAdminNavHeight() {
  const insets = useSafeAreaInsets();
  return BAR_HEIGHT + BAR_BOTTOM_GAP + insets.bottom;
}

/**
 * Web mobile admin bottom bar (`aria-label="Nawigacja admina"`): a floating
 * liquid-glass pill, hidden on deliberate downward scroll.
 */
export function AdminBottomNav({
  tabs,
  activeTab,
  hidden,
  onSelect,
}: {
  tabs: AdminTabConfig[];
  activeTab: AdminTab;
  hidden: SharedValue<number>;
  onSelect: (tab: AdminTab) => void;
}) {
  const styles = useStyles();
  const scheme = useScheme();
  const insets = useSafeAreaInsets();
  const navHeight = useAdminNavHeight();
  const tone = TONE[scheme];

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - hidden.get(),
    transform: [{ translateY: hidden.get() * navHeight }],
  }));

  return (
    <Animated.View
      accessibilityRole="tablist"
      accessibilityLabel="Nawigacja admina"
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: BAR_BOTTOM_GAP + insets.bottom }, animatedStyle]}
    >
      <View style={styles.shell}>
        <Glass style={styles.glass} tint={tone.shell} fallbackColor={tone.shell}>
          <View style={styles.row}>
            {tabs.map((tab) => (
              <NavSlot
                key={tab.key}
                tab={tab}
                active={isMobileSlotActive(tab.key, activeTab)}
                onSelect={onSelect}
              />
            ))}
          </View>
        </Glass>
      </View>
    </Animated.View>
  );
}

const NavSlot = memo(function NavSlot({
  tab,
  active,
  onSelect,
}: {
  tab: AdminTabConfig;
  active: boolean;
  onSelect: (tab: AdminTab) => void;
}) {
  const styles = useStyles();
  const tone = TONE[useScheme()];
  const Icon = ADMIN_TAB_ICONS[tab.key];
  const color = active ? tone.activeText : tone.inactiveText;

  return (
    <PressScale
      accessibilityRole="tab"
      accessibilityLabel={tab.label}
      accessibilityState={{ selected: active }}
      onPress={() => {
        haptics.selection();
        onSelect(tab.key);
      }}
      style={[styles.slot, active && { backgroundColor: tone.activeBg, boxShadow: tone.activeShadow }]}
    >
      <Icon size={20} color={color} strokeWidth={active ? 2.4 : 2} />
      <Text
        numberOfLines={1}
        weight={active ? '700' : '500'}
        style={[styles.label, { color }]}
      >
        {tab.shortLabel}
      </Text>
    </PressScale>
  );
});

const useStyles = createStyles(({ scheme }) => ({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  shell: {
    width: '100%',
    maxWidth: 430,
    height: BAR_HEIGHT,
    borderRadius: 28,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: TONE[scheme].border,
    boxShadow: TONE[scheme].shadow,
  },
  glass: { flex: 1, borderRadius: 27, borderCurve: 'continuous', overflow: 'hidden' },
  row: { height: BAR_HEIGHT - 2, flexDirection: 'row', padding: 6 },
  slot: {
    flex: 1,
    minWidth: 0,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 21.6,
    borderCurve: 'continuous',
    paddingHorizontal: 4,
  },
  label: { width: '100%', textAlign: 'center', fontSize: 12, lineHeight: 13.8, paddingBottom: 2 },
}));
