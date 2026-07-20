import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type ViewProps } from 'react-native';

import { useAppTheme } from '@/hooks/use-app-theme';
import { AppText } from '@/components/ui/AppText';

import { useReducedMotion } from './use-reduced-motion';

export interface AppLoaderProps extends ViewProps {
  label?: string;
  size?: 'small' | 'large';
}

export function AppLoader({ label = 'Ładowanie', size = 'large', style, ...props }: AppLoaderProps) {
  const { tokens } = useAppTheme();
  const reducedMotion = useReducedMotion();
  const rotation = useRef(new Animated.Value(0)).current;
  const dimension = size === 'small' ? 28 : 44;

  useEffect(() => {
    if (reducedMotion) {
      rotation.stopAnimation();
      rotation.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [reducedMotion, rotation]);

  return (
    <View
      {...props}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={[styles.container, style]}
    >
      <Animated.View
        style={[
          styles.spinner,
          {
            width: dimension,
            height: dimension,
            borderRadius: dimension / 2,
            borderColor: `${tokens.colors.primary}28`,
            borderTopColor: tokens.colors.primary,
            borderRightColor: tokens.colors.selectedYellow,
            transform: [
              { rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
            ],
          },
        ]}
      />
      {label ? <AppText variant="caption" tone="muted">{label}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16 },
  spinner: { borderWidth: 4 },
});
