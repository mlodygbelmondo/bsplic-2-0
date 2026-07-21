/* eslint-disable @typescript-eslint/no-require-imports -- Metro requires static bundled asset paths. */
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, useWindowDimensions, View } from 'react-native';

import type { RouletteRoundPhase } from '@/types/database';

export function RouletteWheel({ phase, winningNumber }: { phase: RouletteRoundPhase; winningNumber: number | null }) {
  const { width } = useWindowDimensions();
  const size = Math.min(width - 42, 344);
  const rotation = useRef(new Animated.Value(0)).current;
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    rotation.stopAnimation();
    if (phase !== 'spinning' || reducedMotion) return;
    rotation.setValue(0);
    Animated.timing(rotation, {
      toValue: 1,
      duration: 6000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    return () => rotation.stopAnimation();
  }, [phase, reducedMotion, rotation, winningNumber]);

  const rotate = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '1440deg'] });
  return (
    <View accessibilityLabel={winningNumber === null ? 'Koło ruletki' : `Koło ruletki, ostatni wynik ${winningNumber}`} style={{ width: size, height: size }}>
      <Animated.Image
        source={require('../../../../assets/images/casino/roulette-wheel-new-3.webp')}
        resizeMode="contain"
        style={{ width: size, height: size, transform: [{ rotate }] }}
      />
    </View>
  );
}
