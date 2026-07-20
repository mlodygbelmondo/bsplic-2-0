import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Text, View } from 'react-native';

import { getRouletteColor } from '@/features/casino/lib/roulette';
import { computeRouletteBallRotation, ROULETTE_WHEEL_NUMBERS } from '@/features/casino/lib/rouletteWheel';
import type { RouletteRoundPhase } from '@/types/database';

const SIZE = 246;
const CENTER = SIZE / 2;
const POCKET_RADIUS = 99;

export function RouletteWheel({ phase, winningNumber }: { phase: RouletteRoundPhase; winningNumber: number | null }) {
  const rotation = useRef(new Animated.Value(0)).current;
  const rotationRef = useRef(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    rotation.stopAnimation((current) => {
      rotationRef.current = current;
      if (phase === 'spinning') {
        if (reducedMotion) return;
        const target = current + 1440;
        Animated.timing(rotation, { toValue: target, duration: 6000, easing: Easing.out(Easing.cubic), useNativeDriver: true })
          .start(({ finished }) => { if (finished) rotationRef.current = target; });
        return;
      }
      if (winningNumber === null) return;
      const index = ROULETTE_WHEEL_NUMBERS.indexOf(winningNumber);
      if (index < 0) return;
      const target = computeRouletteBallRotation(current, index);
      if (reducedMotion) {
        rotation.setValue(target);
        rotationRef.current = target;
        return;
      }
      Animated.timing(rotation, { toValue: target, duration: 1300, easing: Easing.out(Easing.exp), useNativeDriver: true })
        .start(({ finished }) => { if (finished) rotationRef.current = target; });
    });
    return () => rotation.stopAnimation();
  }, [phase, reducedMotion, rotation, winningNumber]);

  const rotate = rotation.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] });
  return <View accessibilityLabel={winningNumber === null ? 'Koło ruletki' : `Koło ruletki, wynik ${winningNumber}`} style={{ width: SIZE, height: SIZE, borderRadius: CENTER, borderWidth: 12, borderColor: '#a77719', backgroundColor: '#24150c', alignItems: 'center', justifyContent: 'center' }}>
    {ROULETTE_WHEEL_NUMBERS.map((number, index) => {
      const angle = (index / ROULETTE_WHEEL_NUMBERS.length) * Math.PI * 2 - Math.PI / 2;
      const color = getRouletteColor(number);
      return <View key={number} style={{ position: 'absolute', left: CENTER + Math.cos(angle) * POCKET_RADIUS - 9, top: CENTER + Math.sin(angle) * POCKET_RADIUS - 9, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: color === 'red' ? '#d71d3b' : color === 'green' ? '#168f52' : '#151318' }}><Text style={{ color: '#fff', fontSize: 7, fontWeight: '900' }}>{number}</Text></View>;
    })}
    <View style={{ width: 132, height: 132, borderRadius: 66, borderWidth: 4, borderColor: '#5f441a', backgroundColor: '#100b09', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: winningNumber === null ? '#b8adbe' : '#ffe14a', fontSize: 44, fontWeight: '900' }}>{phase === 'spinning' ? '…' : winningNumber ?? '?'}</Text>
      <Text style={{ color: '#b8adbe', fontSize: 9, fontWeight: '700' }}>{phase === 'spinning' ? 'LOSOWANIE' : 'OSTATNI WYNIK'}</Text>
    </View>
    <Animated.View style={{ position: 'absolute', width: SIZE - 18, height: SIZE - 18, alignItems: 'center', transform: [{ rotate }] }}>
      <View style={{ marginTop: 6, width: 13, height: 13, borderRadius: 7, backgroundColor: '#fff', borderWidth: 2, borderColor: '#d8d8d8', boxShadow: '0 2px 5px rgba(0,0,0,0.8)' }} />
    </Animated.View>
  </View>;
}
