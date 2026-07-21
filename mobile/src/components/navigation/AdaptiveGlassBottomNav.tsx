import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { CircleDot, Club, House, MessageCircle, Trophy, type LucideIcon } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MOBILE_NAV_ITEMS, type MobileNavIconName, type MobileNavItem, type MobileNavKey } from '@/constants/mobile-navigation';
import { useReducedMotion } from '@/components/feedback/use-reduced-motion';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/hooks/use-app-theme';

export interface AdaptiveGlassBottomNavProps {
  activeKey: MobileNavKey | null;
  onSelect(item: MobileNavItem): void;
  hidden?: boolean;
  scrollHidden?: boolean;
  tone?: 'default' | 'casino';
  testID?: string;
}

const ICONS: Record<MobileNavIconName, LucideIcon> = {
  house: House,
  'message-circle': MessageCircle,
  'circle-dot': CircleDot,
  club: Club,
  trophy: Trophy,
};

export function AdaptiveGlassBottomNav({
  activeKey,
  onSelect,
  hidden = false,
  scrollHidden = false,
  tone = 'default',
  testID,
}: AdaptiveGlassBottomNavProps) {
  const { theme, tokens } = useAppTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const translateY = useRef(new Animated.Value(hidden || scrollHidden ? 110 : 0)).current;
  const isCasino = tone === 'casino';
  const usesDarkTone = theme === 'dark' || isCasino;
  const nativeGlassAvailable =
    Platform.OS === 'ios' && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  const surfaceColor = isCasino ? 'rgba(9, 9, 11, 0.86)' : tokens.colors.glass;

  useEffect(() => {
    const target = hidden || scrollHidden ? 110 : 0;
    if (reducedMotion) {
      translateY.setValue(target);
      return;
    }
    Animated.timing(translateY, {
      toValue: target,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [hidden, reducedMotion, scrollHidden, translateY]);

  const content = (
    <View style={styles.items}>
      {MOBILE_NAV_ITEMS.map((item) => {
        const active = item.key === activeKey;
        const Icon = ICONS[item.icon];
        const activeColor = usesDarkTone ? '#FFE14A' : '#C90018';
        const inactiveColor = usesDarkTone ? 'rgba(255,255,255,0.68)' : 'rgba(15,23,42,0.82)';

        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: active, disabled: hidden || scrollHidden }}
            disabled={hidden || scrollHidden}
            onPress={() => onSelect(item)}
            style={[
              styles.item,
              active && {
                backgroundColor: usesDarkTone ? 'rgba(255,255,255,0.11)' : 'rgba(201,0,24,0.10)',
                borderColor: usesDarkTone ? 'rgba(255,255,255,0.16)' : 'rgba(201,0,24,0.12)',
              },
            ]}
          >
            <Icon color={active ? activeColor : inactiveColor} size={18} strokeWidth={active ? 2.4 : 2} />
            <AppText
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.label, { color: active ? activeColor : inactiveColor }, active && styles.activeLabel]}
            >
              {item.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <Animated.View
      testID={testID}
      pointerEvents={hidden || scrollHidden ? 'none' : 'box-none'}
      style={[
        styles.positioner,
        { bottom: Math.max(insets.bottom, 8), transform: [{ translateY }] },
      ]}
    >
      <View
        accessibilityRole="tablist"
        accessibilityLabel="Nawigacja aplikacji"
        style={[
          styles.shadow,
          {
            shadowColor: usesDarkTone ? '#50001C' : '#0F172A',
            borderColor: isCasino ? 'rgba(255,255,255,0.12)' : tokens.colors.glassBorder,
          },
        ]}
      >
        {nativeGlassAvailable ? (
          <GlassView
            glassEffectStyle="regular"
            colorScheme={usesDarkTone ? 'dark' : 'light'}
            tintColor={surfaceColor}
            style={styles.glass}
          />
        ) : (
          <BlurView
            tint={usesDarkTone ? 'systemMaterialDark' : 'systemMaterialLight'}
            intensity={Platform.OS === 'android' ? 44 : 74}
            blurMethod="dimezisBlurViewSdk31Plus"
            style={[styles.glass, { backgroundColor: surfaceColor }]}
          />
        )}
        {content}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  positioner: { position: 'absolute', left: 10, right: 10, zIndex: 50, alignItems: 'center' },
  shadow: {
    width: '100%',
    maxWidth: 430,
    height: 64,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 16,
  },
  glass: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 24, overflow: 'hidden' },
  items: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 5, paddingVertical: 5 },
  item: {
    flex: 1,
    minWidth: 0,
    height: 52,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 2,
  },
  label: { width: '100%', textAlign: 'center', fontSize: 8, lineHeight: 10, fontWeight: '600', letterSpacing: -0.35 },
  activeLabel: { fontWeight: '800' },
});
