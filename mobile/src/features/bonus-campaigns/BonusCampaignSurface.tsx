import { useSegments } from 'expo-router';
import { Gift, Sparkles, X } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { authActions, useAuthStore, useUserId } from '@/features/auth/auth-store';
import { useBootVisible } from '@/features/boot/boot-store';
import { DialogModal, PressScale, Text } from '@/ui';
import { featurePollQueries } from '@/features/feature-polls/feature-poll-api';
import { useFeaturePollOpen } from '@/features/feature-polls/feature-poll-store';
import { useQueryErrorToast } from '@/features/feature-polls/use-query-error-toast';
import { OFFLINE_WRITE_MESSAGE, useIsOffline } from '@/lib/connectivity';
import { getErrorMessage } from '@/lib/errors';
import { useModalRouteOpen } from '@/lib/focus';
import { haptics } from '@/lib/haptics';
import { queryClient } from '@/lib/query-client';
import { useReducedMotion } from '@/lib/motion';
import { toast } from '@/lib/toast';
import { createStyles, useTheme } from '@/theme';
import { bonusCampaignQueries, claimBonusCampaign } from './bonus-campaign-api';
import { setBonusCtaVisible } from './bonus-cta-store';
import { formatBonusAmount, pickFirstAvailableBonusCampaign } from './campaign-availability';
import { BonusConfetti } from './components/BonusConfetti';

/** Web `--mobile-floating-stack-offset` (4.75rem) while the bottom nav shows. */
const FLOATING_STACK_OFFSET = 76;

const CTA_ENTER = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 16 }, { scale: 0.95 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }], easing: Easing.out(Easing.cubic) },
}).duration(250);

const CTA_EXIT = new Keyframe({
  0: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
  100: { opacity: 0, transform: [{ translateY: 16 }, { scale: 0.95 }], easing: Easing.in(Easing.cubic) },
}).duration(200);

/** Web Sparkles: `rotate: [0, -6, 6, 0]`, scale 0.9 → 1, opacity 0 → 1, 0.7 s. */
const SPARKLES_ENTER = new Keyframe({
  0: { opacity: 0, transform: [{ rotate: '0deg' }, { scale: 0.9 }] },
  33: { transform: [{ rotate: '-6deg' }, { scale: 0.97 }] },
  66: { transform: [{ rotate: '6deg' }, { scale: 1 }] },
  100: { opacity: 1, transform: [{ rotate: '0deg' }, { scale: 1 }] },
}).duration(700);

/** Web amount: y 12 → 0, opacity 0 → 1, delay 0.15 s. */
const AMOUNT_ENTER = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 12 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }], easing: Easing.out(Easing.cubic) },
})
  .duration(400)
  .delay(150);

const HEADER_GRADIENT = 'linear-gradient(145deg, #d30019 0%, #f0001d 44%, #f43243 100%)';
const HEADER_SHEEN =
  'linear-gradient(115deg, rgba(255, 255, 255, 0) 8%, rgba(255, 255, 255, 0.18) 34%, rgba(255, 255, 255, 0.04) 48%, rgba(255, 255, 255, 0) 70%)';

/**
 * Bonus campaign dialog and floating `Odbierz bonus` button (web
 * `BonusCampaignSurface`). Mounted once in the root layout for signed-in users.
 */
export function BonusCampaignSurface() {
  const userId = useUserId();
  const hasProfile = useAuthStore((s) => s.profile !== null);
  const bootVisible = useBootVisible();
  const pollOpen = useFeaturePollOpen();
  const offline = useIsOffline();
  const reducedMotion = useReducedMotion();
  const segments = useSegments();
  const modalRouteOpen = useModalRouteOpen();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();

  const query = useQuery({
    ...bonusCampaignQueries.available(userId ?? ''),
    enabled: userId !== null && hasProfile,
  });
  useQueryErrorToast(query.error, query.errorUpdatedAt, 'Nie udało się sprawdzić dostępnych bonusów');
  // Read the poll in this render too: the poll store updates one render late, and
  // presenting both native modals at once makes UIKit drop one of them. Polls are
  // not persisted, so until the poll check answers the bonus waits for it.
  const pollQuery = useQuery({ ...featurePollQueries.available(userId ?? ''), enabled: false });
  const pollPending = pollQuery.isPending || Boolean(pollQuery.data);
  const [claiming, setClaiming] = useState(false);
  const [dismissedModal, setDismissedModal] = useState(false);
  const [confettiRun, setConfettiRun] = useState(0);

  // Never trust campaigns restored from the persisted cache: one may already be claimed.
  const campaigns = query.isFetchedAfterMount && !query.isError ? (query.data ?? []) : [];
  const activeCampaign = pickFirstAvailableBonusCampaign(campaigns);
  const ready = Boolean(userId && hasProfile && activeCampaign);
  // Web: an available campaign opens the dialog unless it was dismissed this session.
  const modalOpen = ready && !dismissedModal;
  const ctaVisible = Boolean(ready && dismissedModal && !bootVisible);

  useEffect(() => {
    setBonusCtaVisible(ctaVisible);
    return () => setBonusCtaVisible(false);
  }, [ctaVisible]);

  const handleCloseModal = () => {
    setDismissedModal(true);
  };

  const queryKey = bonusCampaignQueries.available(userId ?? '').queryKey;

  const handleClaim = async () => {
    if (!activeCampaign || claiming) return;
    if (offline) {
      toast.error(OFFLINE_WRITE_MESSAGE);
      return;
    }

    setClaiming(true);
    try {
      const result = await claimBonusCampaign(activeCampaign.id);
      authActions.updateProfileBalance(Number(result.balance_after));
      await authActions.refreshProfile();
      queryClient.setQueryData(queryKey, (previous) =>
        previous?.filter((campaign) => campaign.id !== activeCampaign.id),
      );
      setDismissedModal(false);
      haptics.success();
      if (!reducedMotion) setConfettiRun((run) => run + 1);
      toast.success(
        `Odebrano ${formatBonusAmount(result.amount)}! Nowe saldo: ${formatBonusAmount(result.balance_after)}`,
      );
      void queryClient.invalidateQueries({ queryKey });
    } catch (error: unknown) {
      haptics.error();
      toast.error(getErrorMessage(error, 'Nie udało się odebrać bonusu'));
      await queryClient.invalidateQueries({ queryKey });
    } finally {
      setClaiming(false);
    }
  };

  const confetti = confettiRun > 0 ? <BonusConfetti key={confettiRun} onDone={() => setConfettiRun(0)} /> : null;

  if (!ready || !activeCampaign) return confetti;

  const inTabs = segments[0] === '(tabs)';
  const ctaBottom = 16 + (inTabs ? FLOATING_STACK_OFFSET : 0) + insets.bottom;
  const claimDisabled = claiming || query.isFetching || offline;

  return (
    <>
      {ctaVisible ? (
        <Animated.View
          entering={CTA_ENTER}
          exiting={CTA_EXIT}
          style={[styles.ctaWrap, { bottom: ctaBottom }]}
          pointerEvents="box-none"
        >
          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Odbierz bonus"
            onPress={() => {
              haptics.selection();
              setDismissedModal(false);
            }}
            style={styles.cta}
          >
            <Gift size={20} color={colors.primaryForeground} />
            <Text size="sm" weight="700" color="primaryForeground">
              Odbierz bonus
            </Text>
          </PressScale>
        </Animated.View>
      ) : null}

      <DialogModal
        visible={modalOpen && !bootVisible && !pollOpen && !pollPending && !modalRouteOpen}
        onRequestClose={() => {
          if (!claiming) handleCloseModal();
        }}
        onBackdropPress={() => {
          if (!claiming) handleCloseModal();
        }}
        maxWidth={448}
        accessibilityLabel={activeCampaign.title}
        cardStyle={styles.card}
      >
        <View style={styles.header}>
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.sheen]} />
          <View pointerEvents="none" style={styles.topLine} />
          <Animated.View entering={SPARKLES_ENTER} style={styles.iconCircle}>
            <View style={styles.iconInner} />
            <Sparkles size={28} color={colors.primaryForeground} />
          </Animated.View>
          <View style={styles.headerText}>
            <Text weight="900" align="center" accessibilityRole="header" style={styles.title}>
              {activeCampaign.title}
            </Text>
            <Text size="sm" weight="500" align="center" style={styles.description}>
              {activeCampaign.description}
            </Text>
          </View>
          <Animated.View entering={AMOUNT_ENTER}>
            <Text weight="900" align="center" tabular style={styles.amount}>
              {formatBonusAmount(activeCampaign.amount)}
            </Text>
          </Animated.View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Zamknij"
            hitSlop={12}
            disabled={claiming}
            onPress={handleCloseModal}
            style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
          >
            {({ pressed }) => <X size={16} color={pressed ? '#ffffff' : 'rgba(255, 255, 255, 0.8)'} />}
          </Pressable>
        </View>

        <View style={styles.actions}>
          {offline ? (
            <Text size="sm" color="mutedForeground" align="center">
              {OFFLINE_WRITE_MESSAGE}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: claimDisabled, busy: claiming }}
            disabled={claimDisabled}
            onPress={() => void handleClaim()}
            style={({ pressed }) => [styles.claim, pressed && styles.claimPressed, claimDisabled && styles.disabled]}
          >
            <Text size="base" weight="700" color="primaryForeground">
              {claiming ? 'Odbieranie...' : 'Odbierz bonus'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={claiming}
            onPress={handleCloseModal}
            style={({ pressed }) => [styles.later, pressed && styles.laterPressed, claiming && styles.disabled]}
          >
            <Text size="sm" weight="500" color="mutedForeground">
              Później
            </Text>
          </Pressable>
        </View>
      </DialogModal>

      {confetti}
    </>
  );
}

const useStyles = createStyles(({ colors, radius }) => ({
  ctaWrap: { position: 'absolute', right: 16, zIndex: 70 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 9999,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    boxShadow: '0px 10px 15px -3px rgba(0, 0, 0, 0.1), 0px 4px 6px -4px rgba(0, 0, 0, 0.1)',
  },
  card: {
    borderColor: 'rgba(255, 255, 255, 0.2)',
    boxShadow: '0px 25px 50px -12px rgba(69, 10, 10, 0.3)',
  },
  header: {
    overflow: 'hidden',
    backgroundImage: HEADER_GRADIENT,
    backgroundColor: '#f0001d',
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
  },
  sheen: { backgroundImage: HEADER_SHEEN },
  topLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  iconCircle: {
    alignSelf: 'center',
    marginBottom: 12,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    boxShadow: '0px 8px 22px rgba(94, 0, 16, 0.18), inset 0px 1px 0px rgba(255, 255, 255, 0.26)',
  },
  iconInner: {
    position: 'absolute',
    top: 7,
    left: 7,
    right: 7,
    bottom: 7,
    borderRadius: 9999,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
  headerText: { gap: 2 },
  title: {
    fontSize: 23.2,
    lineHeight: 29,
    letterSpacing: -0.58,
    color: colors.primaryForeground,
  },
  description: { color: 'rgba(255, 255, 255, 0.86)' },
  amount: {
    marginTop: 16,
    fontSize: 40.8,
    lineHeight: 44,
    letterSpacing: -1,
    color: colors.primaryForeground,
  },
  close: {
    position: 'absolute',
    right: 16,
    top: 16,
    borderRadius: 9999,
    padding: 6,
  },
  closePressed: { backgroundColor: 'rgba(255, 255, 255, 0.15)' },
  actions: { paddingHorizontal: 24, paddingVertical: 16, gap: 10 },
  claim: {
    height: 48,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e6001a',
  },
  claimPressed: { backgroundColor: '#c90018' },
  later: {
    height: 40,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  laterPressed: { backgroundColor: colors.muted },
  disabled: { opacity: 0.5 },
}));
