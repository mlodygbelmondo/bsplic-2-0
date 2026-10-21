import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, View, type StyleProp, type ViewStyle } from 'react-native';

import { useLiteMotion } from '@/lib/motion';
import { useScheme } from '@/theme';

const LIQUID_GLASS =
  Platform.OS === 'ios' && isLiquidGlassAvailable() && (isGlassEffectAPIAvailable?.() ?? true);

function useReduceTransparency() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceTransparencyEnabled().then(setReduce).catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

export interface GlassProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Tint applied to the glass (and used as the solid fallback color). */
  tint?: string;
  /** Solid color when glass/blur is unavailable or disabled. */
  fallbackColor: string;
  interactive?: boolean;
  /** Blur intensity for the expo-blur fallback (iOS < 26, Android). */
  blurIntensity?: number;
}

/**
 * Liquid Glass on iOS 26+, a blur on older systems, and a solid surface when
 * the user reduces transparency or the device is in Low Power Mode.
 */
export function Glass({ children, style, tint, fallbackColor, interactive, blurIntensity = 40 }: GlassProps) {
  const scheme = useScheme();
  const lite = useLiteMotion();
  const reduceTransparency = useReduceTransparency();

  if (lite || reduceTransparency) {
    return <View style={[{ backgroundColor: fallbackColor }, style]}>{children}</View>;
  }
  if (LIQUID_GLASS) {
    return (
      <GlassView style={style} glassEffectStyle="regular" tintColor={tint} isInteractive={interactive} colorScheme={scheme}>
        {children}
      </GlassView>
    );
  }
  return (
    <BlurView intensity={blurIntensity} tint={scheme === 'dark' ? 'dark' : 'light'} style={[{ overflow: 'hidden' }, style]}>
      <View style={{ backgroundColor: tint }}>{children}</View>
    </BlurView>
  );
}
