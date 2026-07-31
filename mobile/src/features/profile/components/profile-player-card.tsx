import { Share2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion } from '@/components/feedback/use-reduced-motion';
import { useAppTheme } from '@/hooks/use-app-theme';

interface ProfilePlayerCardProps {
  playerLevel: string;
  profit: number;
  winRate: number;
  currentStreak: number;
  totalBets: number;
  wins: number;
  onShare(): void;
}

function ProfileStat({
  label,
  value,
  color = '#FFFFFF',
  flex = false,
}: {
  label: string;
  value: string;
  color?: string;
  flex?: boolean;
}) {
  return (
    <View style={[styles.stat, flex && styles.flex]}>
      <Text allowFontScaling={false} style={styles.statLabel}>{label}</Text>
      <Text allowFontScaling={false} style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

export function ProfilePlayerCard({
  playerLevel,
  profit,
  winRate,
  currentStreak,
  totalBets,
  wins,
  onShare,
}: ProfilePlayerCardProps) {
  const { tokens } = useAppTheme();
  const reducedMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const shimmer = useSharedValue(-1);

  useEffect(() => {
    cancelAnimation(shimmer);
    if (reducedMotion || width === 0) {
      shimmer.value = -1;
      return;
    }

    shimmer.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1_100, easing: Easing.inOut(Easing.quad) }),
        withDelay(6_200, withTiming(-1, { duration: 0 })),
      ),
      -1,
    );
    return () => cancelAnimation(shimmer);
  }, [reducedMotion, shimmer, width]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(shimmer.value, [-1, 1], [-90, width + 60]) },
      { skewX: '-14deg' },
    ],
  }), [width]);

  return (
    <View
      accessibilityLabel="Karta gracza"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={styles.card}
    >
      {!reducedMotion ? (
        <Animated.View pointerEvents="none" style={[styles.shimmer, shimmerStyle]} />
      ) : null}
      <View style={styles.content}>
        <View style={styles.heading}>
          <Text allowFontScaling={false} style={styles.eyebrow}>Karta gracza</Text>
          <Text allowFontScaling={false} style={styles.title}>{playerLevel}</Text>
        </View>
        <View style={styles.actions}>
          <View style={styles.pill}>
            <Text allowFontScaling={false} style={styles.pillText}>Sportsbook</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={onShare} style={styles.pill}>
            <Share2 color="#FFFFFF" size={13} strokeWidth={2.3} />
            <Text allowFontScaling={false} style={styles.pillText}>Udostępnij profil</Text>
          </Pressable>
        </View>
        <ProfileStat
          label="Zysk"
          value={`${profit >= 0 ? '+' : ''}${profit.toFixed(2)} zł`}
          color={profit >= 0 ? tokens.colors.success : tokens.colors.destructive}
        />
        <ProfileStat label="Win rate" value={`${winRate.toFixed(1)}%`} />
        <ProfileStat label="Seria" value={String(currentStreak)} color="#FEF3C7" />
        <View style={styles.secondaryStats}>
          <ProfileStat label="Kupony" value={String(totalBets)} flex />
          <ProfileStat label="Wygrane" value={String(wins)} flex />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    overflow: 'hidden',
    gap: 12,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(254,243,199,0.20)',
    backgroundColor: '#18110C',
    padding: 16,
    boxShadow: '0 8px 18px rgba(0,0,0,0.22)',
  },
  shimmer: {
    position: 'absolute',
    top: -70,
    bottom: -70,
    width: 52,
    backgroundColor: 'rgba(255,248,220,0.16)',
  },
  content: { gap: 12 },
  heading: { gap: 4 },
  eyebrow: { color: '#D9C6A0', fontSize: 9, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  pill: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 12 },
  pillText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  stat: { minHeight: 74, justifyContent: 'center', gap: 7, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(0,0,0,0.28)', paddingHorizontal: 13 },
  statLabel: { color: '#BFAF9D', fontSize: 9, fontWeight: '700', letterSpacing: 1.7, textTransform: 'uppercase' },
  statValue: { fontSize: 20, fontWeight: '900' },
  flex: { flex: 1 },
  secondaryStats: { flexDirection: 'row', gap: 8 },
});
