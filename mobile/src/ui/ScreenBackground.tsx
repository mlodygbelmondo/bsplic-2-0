import { useIsFocused } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useLiteMotion } from '@/lib/motion';
import { hsl, useTheme } from '@/theme';

const PARTICLES = [
  `radial-gradient(3px 3px at 40px 64px, ${hsl(46, 98, 62, 0.4)} 0%, transparent 70%)`,
  `radial-gradient(2px 2px at 184px 218px, ${hsl(46, 98, 64, 0.28)} 0%, transparent 70%)`,
  `radial-gradient(4px 4px at 322px 122px, ${hsl(46, 96, 58, 0.32)} 0%, transparent 72%)`,
  `radial-gradient(2px 2px at 458px 382px, ${hsl(46, 98, 64, 0.22)} 0%, transparent 70%)`,
  `radial-gradient(3px 3px at 94px 466px, ${hsl(46, 98, 60, 0.3)} 0%, transparent 70%)`,
  `radial-gradient(2px 2px at 252px 532px, ${hsl(46, 98, 66, 0.26)} 0%, transparent 70%)`,
  `radial-gradient(3px 3px at 540px 286px, ${hsl(46, 96, 60, 0.24)} 0%, transparent 70%)`,
].join(', ');

const DRIFT = `linear-gradient(100deg, transparent 6%, ${hsl(355, 85, 30, 0.12)} 28%, ${hsl(343, 65, 22, 0.1)} 50%, ${hsl(350, 90, 28, 0.08)} 72%, transparent 94%)`;

/**
 * Full-screen app background (web `.h-safe-screen.bg-background`): the
 * aurora gradient plus, in dark mode, a drifting band (32 s) and a slow
 * yellow particle field (80 s). Transform-only, stopped under lite motion
 * and while the screen is not focused (tabs stay mounted).
 */
export function ScreenBackground({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors, gradients, scheme } = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: colors.background }, style]}>
      {scheme === 'dark' ? (
        <>
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundImage: gradients.appAurora }]} />
          <AmbientLayers />
        </>
      ) : null}
      {children}
    </View>
  );
}

function AmbientLayers() {
  const lite = useLiteMotion();
  const focused = useIsFocused();
  const still = lite || !focused;
  const drift = useSharedValue(0);
  const rise = useSharedValue(0);

  useEffect(() => {
    if (still) {
      cancelAnimation(drift);
      cancelAnimation(rise);
      return;
    }
    drift.set(withRepeat(withTiming(1, { duration: 32000, easing: Easing.inOut(Easing.ease) }), -1, true));
    rise.set(withRepeat(withTiming(1, { duration: 80000, easing: Easing.linear }), -1, false));
    return () => {
      cancelAnimation(drift);
      cancelAnimation(rise);
    };
  }, [still, drift, rise]);

  const driftStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: `${-5 + 10 * drift.get()}%` }],
  }));
  const riseStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -600 * rise.get() }],
  }));

  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.drift, { backgroundImage: DRIFT }, driftStyle]} />
      <Animated.View
        pointerEvents="none"
        style={[styles.particles, { backgroundImage: PARTICLES, backgroundSize: '600px 600px', backgroundRepeat: 'repeat' }, riseStyle]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  drift: { position: 'absolute', top: '-10%', bottom: '-10%', left: '-35%', right: '-35%' },
  particles: { position: 'absolute', top: 0, left: 0, right: 0, bottom: -600 },
});
