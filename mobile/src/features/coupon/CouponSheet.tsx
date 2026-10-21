import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, Pressable, View } from 'react-native';
import {
  KeyboardAvoidingView,
  KeyboardAwareScrollView,
  useReanimatedKeyboardAnimation,
} from 'react-native-keyboard-controller';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBalance } from '@/features/auth/auth-store';
import { useCategoryMap } from '@/features/home/api/categories';
import { useIsOffline } from '@/lib/connectivity';
import { haptics } from '@/lib/haptics';
import { toast } from '@/lib/toast';
import { alpha, createStyles, useTheme } from '@/theme';
import { Text } from '@/ui';

import { useAkoExclusions } from './api/ako-exclusions-query';
import { findAkoConflict, formatAkoConflictMessage, shouldBlockAkoCoupon } from './ako-exclusions';
import { getCouponCategoryEmoji } from './category-emoji';
import { CouponFooter } from './CouponFooter';
import { CouponItemCard } from './CouponItemCard';
import { couponActions, useCouponItems, useCouponStore, usePreferredCouponType } from './coupon-store';
import {
  couponSheetActions,
  useCouponActiveTab,
  useCouponSingleStakes,
  useCouponStake,
  writeLastStake,
} from './coupon-sheet-store';
import { eventsLabel, type CouponTab } from './placement';
import { useCouponPlacement } from './use-coupon-placement';

/** Space kept between a focused stake input and the footer above the keyboard. */
const FOCUSED_INPUT_GAP = 20;
const KEYBOARD_OPEN_BOTTOM_PADDING = 8;

function closeSheet() {
  if (router.canGoBack()) router.back();
}

/**
 * The phone coupon (web `CouponDrawer` below `lg`) as a native form sheet:
 * selections, single/AKO stakes, AKO exclusions, balance checks and placement.
 */
export function CouponSheet() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const items = useCouponItems();
  const categoryMap = useCategoryMap();
  const activeTab = useCouponActiveTab();
  const stake = useCouponStake();
  const singleStakes = useCouponSingleStakes();
  const preferredCouponType = usePreferredCouponType();
  const balance = Number(useBalance());
  const isOffline = useIsOffline();
  const [footerHeight, setFooterHeight] = useState(0);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Coupon copied from Social: open on the preset tab (web parity).
  useEffect(() => {
    if (!preferredCouponType) return;
    couponSheetActions.setActiveTab(preferredCouponType);
    couponActions.setPreferredCouponType(null);
  }, [preferredCouponType]);

  const { placing, placeBet, potentialWin, effectiveTotalOdds, totalStake } = useCouponPlacement(
    activeTab,
    stake,
    singleStakes,
    isOffline,
    () => {
      if (activeTab === 'ako') writeLastStake(stake);
      couponSheetActions.resetSingleStakes();
      if (mountedRef.current) closeSheet();
    },
  );

  const selections = items.map((item) => ({ betId: item.bet.id, title: item.bet.title }));
  const exclusions = useAkoExclusions(selections.map((selection) => selection.betId));
  const hasAkoConflict = shouldBlockAkoCoupon(activeTab, selections, exclusions);
  const akoConflict = hasAkoConflict ? findAkoConflict(selections, exclusions) : null;
  const conflictMessage = akoConflict ? formatAkoConflictMessage(akoConflict) : null;

  const hasItems = items.length > 0;
  const insufficientFunds = hasItems && totalStake > balance;
  const submitDisabled = placing || !hasItems || insufficientFunds || hasAkoConflict || isOffline;

  const submitFromKeyboard = () => {
    if (submitDisabled) return;
    Keyboard.dismiss();
    void placeBet();
  };

  const selectTab = (tab: CouponTab) => {
    if (tab === activeTab) return;
    haptics.selection();
    couponSheetActions.setActiveTab(tab);
  };

  const clearCoupon = () => {
    const clearedItems = useCouponStore.getState().items;
    couponActions.clearCoupon();
    toast('Kupon wyczyszczony', {
      action: { label: 'Cofnij', onClick: () => couponActions.addItems(clearedItems) },
    });
  };

  // The web pads the sheet with the home-indicator inset; above the keyboard
  // only the minimum 0.5rem remains.
  const restBottomPadding = Math.max(KEYBOARD_OPEN_BOTTOM_PADDING, insets.bottom);
  const { progress } = useReanimatedKeyboardAnimation();
  const bottomSpacerStyle = useAnimatedStyle(() => ({
    height: interpolate(progress.get(), [0, 1], [restBottomPadding, KEYBOARD_OPEN_BOTTOM_PADDING]),
  }));

  return (
    <KeyboardAvoidingView behavior="padding" automaticOffset style={styles.root}>
      {/* Web drag-handle row; iOS draws the native grabber inside it. */}
      <View style={styles.handleRow}>
        {Platform.OS === 'android' ? <View style={styles.handle} /> : null}
      </View>

      <View style={styles.header}>
        <Text accessibilityRole="header" tabular style={styles.headerTitle}>
          {items.length} {eventsLabel(items.length)}
        </Text>
        <View style={styles.headerActions}>
          {hasItems ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={{ top: 14, bottom: 14, left: 8, right: 4 }}
              onPress={clearCoupon}
            >
              {({ pressed }) => (
                <Text color={pressed ? 'foreground' : 'mutedForeground'} style={styles.clearText}>
                  Wyczyść
                </Text>
              )}
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Zamknij kupon"
            hitSlop={8}
            onPress={closeSheet}
            style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
          >
            {({ pressed }) => <X size={16} color={pressed ? colors.foreground : colors.mutedForeground} />}
          </Pressable>
        </View>
      </View>

      <View style={styles.tabsRow}>
        <View style={styles.tabs} accessibilityRole="tablist">
          <CouponTabButton label="Pojedyncze" active={activeTab === 'single'} onPress={() => selectTab('single')} />
          <CouponTabButton label="AKO" active={activeTab === 'ako'} onPress={() => selectTab('ako')} />
        </View>
      </View>

      <KeyboardAwareScrollView
        style={styles.list}
        contentContainerStyle={hasItems ? styles.listContent : styles.emptyContent}
        bottomOffset={footerHeight + FOCUSED_INPUT_GAP}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {hasItems ? (
          items.map((item) => (
            <CouponItemCard
              key={item.bet.id}
              item={item}
              emoji={getCouponCategoryEmoji(item.bet.category_id, categoryMap)}
              showStake={activeTab === 'single'}
              onSubmitStake={submitFromKeyboard}
            />
          ))
        ) : (
          <Text color="mutedForeground" align="center" style={styles.emptyText}>
            Dodaj zdarzenia do kuponu klikając na kursy.
          </Text>
        )}
      </KeyboardAwareScrollView>

      <CouponFooter
        activeTab={activeTab}
        potentialWin={potentialWin}
        effectiveTotalOdds={effectiveTotalOdds}
        totalStake={totalStake}
        balance={balance}
        insufficientFunds={insufficientFunds}
        isOffline={isOffline}
        conflictMessage={conflictMessage}
        submitDisabled={submitDisabled}
        placing={placing}
        onSubmit={() => {
          // Tapping the web button blurs the stake input and closes the keyboard.
          Keyboard.dismiss();
          void placeBet();
        }}
        onStakeSubmit={submitFromKeyboard}
        onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
      />
      <Animated.View style={bottomSpacerStyle} />
    </KeyboardAvoidingView>
  );
}

function CouponTabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      hitSlop={{ top: 6, bottom: 6 }}
      onPress={onPress}
      style={[styles.tab, active && styles.tabActive]}
    >
      <Text color={active ? 'foreground' : 'mutedForeground'} style={styles.tabText}>
        {label}
      </Text>
    </Pressable>
  );
}

const useStyles = createStyles(({ colors, gradients, radius }) => ({
  // `.card-shadow.bg-card` surface.
  root: {
    flex: 1,
    backgroundColor: colors.card,
    backgroundImage: gradients.bookmakerSurface,
  },
  // `flex justify-center py-2.5 border-b border-border/70`, bar `h-1 w-12 rounded-full bg-muted-foreground/30`.
  handleRow: {
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: alpha(colors.border, 0.7),
  },
  handle: { width: 48, height: 4, borderRadius: 2, backgroundColor: alpha(colors.mutedForeground, 0.3) },
  // `flex items-center justify-between px-4 py-3 border-b border-border`.
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 13, lineHeight: 19.5, fontWeight: '700' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  clearText: { fontSize: 11, lineHeight: 16.5, fontWeight: '600' },
  // `p-1.5 rounded-md`, hover `bg-muted`.
  closeButton: { padding: 6, borderRadius: radius.md, borderCurve: 'continuous' },
  closeButtonPressed: { backgroundColor: colors.muted },
  // `px-3 py-2 border-b border-border`, control `grid grid-cols-2 rounded-lg bg-muted p-0.5`.
  tabsRow: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabs: {
    flexDirection: 'row',
    padding: 2,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.muted,
  },
  // `py-1.5 text-[13px] font-semibold rounded-md`, active `bg-card shadow-sm`.
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: radius.md,
    borderCurve: 'continuous',
  },
  tabActive: { backgroundColor: colors.card, boxShadow: '0px 1px 2px 0px rgba(0, 0, 0, 0.05)' },
  tabText: { fontSize: 13, lineHeight: 19.5, fontWeight: '600' },
  // `flex-1 min-h-0 overflow-y-auto px-3 py-3`, items `space-y-2.5`.
  list: { flex: 1 },
  listContent: { padding: 12, gap: 10 },
  emptyContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 20 },
  emptyText: { maxWidth: 240, fontSize: 12, lineHeight: 18 },
}));
