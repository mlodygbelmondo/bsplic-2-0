import { Share2, Trophy, X } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withSpring,
  withTiming,
  type EntryExitAnimationFunction,
} from 'react-native-reanimated';

import { OFFLINE_WRITE_MESSAGE, useIsOffline } from '@/lib/connectivity';
import { useReducedMotion } from '@/lib/motion';
import { toast } from '@/lib/toast';
import { createStyles, text } from '@/theme';
import { Text } from '@/ui';

import { rgba, tw } from '../../shared/casinoTheme';
import { shareRouletteWin } from '../state/actions';
import { rouletteSession, selectShowWinBanner, useRouletteSession } from '../state/sessionStore';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);
const COUNT_UP_DURATION_MS = 900;
const AUTO_DISMISS_MS = 6500;

const winText = (amount: number) => {
  'worklet';
  return `Wygrałeś ${amount.toFixed(2)} zł!`;
};

/** framer `initial={{ opacity: 0, y: -16, scale: 0.97 }}` with the default spring and opacity tween. */
const bannerEntering: EntryExitAnimationFunction = () => {
  'worklet';
  const spring = { stiffness: 500, damping: 25, mass: 1 };
  return {
    initialValues: { opacity: 0, transform: [{ translateY: -16 }, { scale: 0.97 }] },
    animations: {
      opacity: withTiming(1, { duration: 300, easing: Easing.bezier(0.25, 0.1, 0.35, 1) }),
      transform: [{ translateY: withSpring(0, spring) }, { scale: withSpring(1, spring) }],
    },
  };
};

/**
 * Web `WinBanner`: "Wygrałeś X zł!" counting up from zero, a share button and
 * a close button, dismissed automatically after 6.5 s. It floats over the top
 * of the table, under the app header.
 */
export function WinBanner() {
  const visible = useRouletteSession(selectShowWinBanner);
  const winKey = useRouletteSession((state) => state.latestWinKey);
  const amount = useRouletteSession((state) => state.latestWin?.payout ?? 0);
  if (!visible || !winKey) return null;
  return <WinBannerCard key={winKey} winKey={winKey} amount={amount} />;
}

function WinBannerCard({ winKey, amount }: { winKey: string; amount: number }) {
  const styles = useStyles();
  const offline = useIsOffline();
  const reducedMotion = useReducedMotion();
  const isSharing = useRouletteSession((state) => state.isSharingWin);
  const displayed = useSharedValue(reducedMotion ? amount : 0);

  // Web: `amount * (1 - (1 - progress)^3)` over 900 ms, from zero for each new win.
  useEffect(() => {
    displayed.set(
      reducedMotion ? amount : withTiming(amount, { duration: COUNT_UP_DURATION_MS, easing: Easing.out(Easing.cubic) }),
    );
  }, [amount, displayed, reducedMotion]);

  useEffect(() => {
    const timeout = setTimeout(() => rouletteSession.dismissWin(winKey), AUTO_DISMISS_MS);
    return () => clearTimeout(timeout);
  }, [winKey]);

  const animatedProps = useAnimatedProps(() => {
    const value = winText(displayed.get());
    return { text: value, defaultValue: value };
  });

  const onShare = () => {
    if (offline) {
      toast.error(OFFLINE_WRITE_MESSAGE);
      return;
    }
    void shareRouletteWin();
  };

  return (
    <View pointerEvents="box-none" style={styles.anchor}>
      <Animated.View
        entering={bannerEntering}
        accessibilityLiveRegion="polite"
        style={styles.card}
      >
        <View pointerEvents="none" style={styles.hairline} />
        <View style={styles.row}>
          <View style={styles.iconBox}>
            <Trophy size={20} color={tw.emerald300} />
          </View>
          <View style={styles.textBox} accessible accessibilityRole="text" accessibilityLabel={winText(amount)}>
            <AnimatedTextInput
              editable={false}
              pointerEvents="none"
              underlineColorAndroid="transparent"
              maxFontSizeMultiplier={1.35}
              defaultValue={winText(reducedMotion ? amount : 0)}
              animatedProps={animatedProps}
              importantForAccessibility="no"
              accessibilityElementsHidden
              style={styles.amount}
            />
          </View>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Udostępnij"
              accessibilityHint={offline ? OFFLINE_WRITE_MESSAGE : undefined}
              accessibilityState={{ disabled: offline || isSharing, busy: isSharing }}
              disabled={isSharing}
              onPress={onShare}
              hitSlop={{ top: 4, bottom: 4 }}
              style={[styles.share, (offline || isSharing) && styles.disabled]}
            >
              <Share2 size={14} color={tw.black} />
              <Text size="xs" weight="700" style={styles.shareText}>
                Udostępnij
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Zamknij powiadomienie o wygranej"
              onPress={() => rouletteSession.dismissWin(winKey)}
              hitSlop={4}
              style={styles.close}
            >
              <X size={16} color={rgba(tw.white, 0.55)} />
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const useStyles = createStyles(() => ({
  // `fixed left-3 right-3 top-[header + 0.5rem] z-50`, here relative to the area under the header.
  anchor: { position: 'absolute', left: 12, right: 12, top: 8, zIndex: 50, alignItems: 'center' },
  // `rounded-2xl border border-emerald-400/30 bg-emerald-950/90 p-3.5 shadow-2xl shadow-emerald-950/40`
  card: {
    width: '100%',
    maxWidth: 440,
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: rgba(tw.emerald400, 0.3),
    backgroundColor: rgba(tw.emerald950, 0.9),
    padding: 14,
    boxShadow: '0px 25px 50px -12px rgba(2, 44, 34, 0.4)',
  },
  hairline: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 1,
    backgroundImage: 'linear-gradient(to right, transparent, rgba(110, 231, 183, 0.7), transparent)',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  // `h-10 w-10 rounded-xl bg-emerald-400/20 ring-1 ring-emerald-300/20`
  iconBox: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: rgba(tw.emerald300, 0.2),
    backgroundColor: rgba(tw.emerald400, 0.2),
  },
  textBox: { flex: 1, minWidth: 0 },
  // `text-sm font-bold tabular-nums text-emerald-100`
  amount: {
    ...text.sm,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: tw.emerald100,
    padding: 0,
    margin: 0,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // `h-9 rounded-lg bg-emerald-400 px-3 text-xs font-bold text-black`
  share: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 8,
    backgroundColor: tw.emerald400,
    paddingHorizontal: 12,
  },
  shareText: { color: tw.black },
  disabled: { opacity: 0.5 },
  close: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
}));
