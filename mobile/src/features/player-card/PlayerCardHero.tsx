import { useIsFocused } from 'expo-router';
import { Share2 } from 'lucide-react-native';
import { Platform, Pressable, Share, StyleSheet, View } from 'react-native';
import Animated, { css } from 'react-native-reanimated';

import { useLiteMotion } from '@/lib/motion';
import { toast } from '@/lib/toast';
import { createStyles } from '@/theme';
import { Text } from '@/ui';
import type { PlayerCardDisplayModel } from './displayModel';

interface PlayerCardHeroProps {
  model: PlayerCardDisplayModel;
  profileName: string;
  profileUrl: string;
}

// Tailwind palette colors used by the card (theme independent, like the web).
const AMBER_50 = '#fffbeb';
const AMBER_100 = '#fef3c7';
const EMERALD_300 = '#6ee7b7';
const ROSE_200 = '#fecdd3';

/** `.player-card-hero` background from `src/index.css`. */
const HERO_BACKGROUND = [
  'radial-gradient(120% 140% at 0% 0%, rgba(251, 191, 36, 0.28) 0%, rgba(251, 191, 36, 0) 54%)',
  'radial-gradient(90% 120% at 100% 0%, rgba(239, 68, 68, 0.18) 0%, rgba(239, 68, 68, 0) 58%)',
  'linear-gradient(145deg, #18110c 0%, #130f0d 44%, #070707 100%)',
].join(', ');

/** `.player-card-hero::after` sheen. */
const SHEEN_BACKGROUND =
  'linear-gradient(110deg, rgba(255, 248, 220, 0) 37%, rgba(255, 248, 220, 0.2) 50%, rgba(255, 248, 220, 0) 63%)';

const OFF_LEFT = [{ translateX: '-145%' }, { skewX: '-14deg' }] as const;
const OFF_RIGHT = [{ translateX: '145%' }, { skewX: '-14deg' }] as const;

/** `@keyframes player-card-shimmer` (7.5 s, ease-in-out per segment, infinite). */
const SHIMMER = css.keyframes({
  '0%': { transform: [...OFF_LEFT], opacity: 0 },
  '72%': { transform: [...OFF_LEFT], opacity: 0 },
  '78%': { opacity: 1 },
  '90%': { transform: [...OFF_RIGHT], opacity: 1 },
  '100%': { transform: [...OFF_RIGHT], opacity: 0 },
});

function formatProfit(profit: number) {
  return `${profit >= 0 ? '+' : ''}${profit.toFixed(2)} zł`;
}

export function PlayerCardHero({ model, profileName, profileUrl }: PlayerCardHeroProps) {
  const styles = useStyles();
  const primaryMetrics = [
    {
      label: 'Zysk',
      value: formatProfit(model.profit),
      color: model.profit >= 0 ? EMERALD_300 : ROSE_200,
    },
    { label: 'Win rate', value: `${model.winRate.toFixed(1)}%`, color: '#ffffff' },
    { label: 'Seria', value: model.currentStreak.toString(), color: AMBER_100 },
  ];

  const handleShareProfile = async () => {
    const title = `Profil ${profileName}`;
    const message = `Sprawdź profil gracza ${profileName}`;
    try {
      // iOS shares the URL as its own item; Android only carries text.
      const result = await Share.share(
        Platform.OS === 'ios' ? { title, message, url: profileUrl } : { title, message: `${message} ${profileUrl}` },
        { subject: title, dialogTitle: title },
      );
      if (result.action === Share.dismissedAction) return;
      toast.success('Profil udostępniony');
    } catch {
      toast.error('Nie udało się udostępnić profilu');
    }
  };

  return (
    <View role="region" accessibilityLabel="Karta gracza" style={styles.card}>
      <Sheen />
      <View style={styles.content}>
        <View style={styles.headerColumn}>
          <View>
            <Text style={styles.eyebrow}>Karta gracza</Text>
            <Text accessibilityRole="header" style={styles.archetype}>
              {model.archetype.label}
            </Text>
          </View>
          <View style={styles.pillRow}>
            <View style={styles.pill}>
              <Text size="xs" weight="600" style={styles.pillText}>
                Sportsbook
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Udostępnij profil"
              hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
              onPress={() => void handleShareProfile()}
              style={({ pressed }) => [styles.pill, styles.shareButton, pressed && styles.pillPressed]}
            >
              <Share2 size={14} color={AMBER_50} strokeWidth={2} />
              <Text size="xs" weight="600" style={styles.pillText}>
                Udostępnij profil
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.metricsColumn}>
          {primaryMetrics.map((metric) => (
            <View key={metric.label} style={styles.primaryTile}>
              <Text style={styles.metricLabel}>{metric.label}</Text>
              <Text tabular style={[styles.primaryValue, { color: metric.color }]}>
                {metric.value}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.secondaryRow}>
          <View style={styles.secondaryTile}>
            <Text style={styles.metricLabel}>Kupony</Text>
            <Text size="lg" weight="700" tabular style={styles.secondaryValue}>
              {model.totalCoupons}
            </Text>
          </View>
          <View style={styles.secondaryTile}>
            <Text style={styles.metricLabel}>Wygrane</Text>
            <Text size="lg" weight="700" tabular style={styles.secondaryValue}>
              {model.wins}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/** Decorative sheen; stopped under reduced motion / Low Power Mode and paused off screen. */
function Sheen() {
  const lite = useLiteMotion();
  const focused = useIsFocused();
  if (lite) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        sheenStyles.sheen,
        {
          animationName: SHIMMER,
          animationDuration: '7500ms',
          animationTimingFunction: 'ease-in-out',
          animationIterationCount: 'infinite',
          animationPlayState: focused ? 'running' : 'paused',
        },
      ]}
    />
  );
}

const sheenStyles = StyleSheet.create({
  sheen: {
    position: 'absolute',
    top: '-28%',
    bottom: '-28%',
    left: 0,
    right: 0,
    backgroundImage: SHEEN_BACKGROUND,
    opacity: 0,
    transform: [...OFF_LEFT],
  },
});

const useStyles = createStyles(({ shadows }) => ({
  // section.player-card-hero.card-shadow.rounded-2xl.border.border-amber-200/20.p-4
  card: {
    overflow: 'hidden',
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(253, 230, 138, 0.2)',
    padding: 16,
    backgroundColor: '#130f0d',
    backgroundImage: HERO_BACKGROUND,
    boxShadow: shadows.card,
  },
  content: { gap: 16 },
  headerColumn: { gap: 12 },
  eyebrow: {
    fontSize: 11,
    lineHeight: 16.5,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 11 * 0.28,
    color: 'rgba(254, 243, 199, 0.7)',
  },
  archetype: {
    marginTop: 4,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
    color: '#ffffff',
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  pill: {
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(254, 243, 199, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  shareButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pillPressed: { backgroundColor: 'rgba(255, 255, 255, 0.15)' },
  pillText: { color: AMBER_50 },
  metricsColumn: { gap: 8 },
  primaryTile: {
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    padding: 12,
  },
  metricLabel: {
    fontSize: 11,
    lineHeight: 16.5,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 11 * 0.18,
    color: 'rgba(254, 243, 199, 0.65)',
  },
  primaryValue: {
    marginTop: 4,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  secondaryRow: { flexDirection: 'row', gap: 8 },
  secondaryTile: {
    flex: 1,
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 12,
  },
  secondaryValue: { marginTop: 4, color: '#ffffff' },
}));
