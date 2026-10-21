import { AlertTriangle } from 'lucide-react-native';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import Animated from 'react-native-reanimated';

import { OFFLINE_WRITE_MESSAGE } from '@/lib/connectivity';
import { haptics } from '@/lib/haptics';
import { alpha, createStyles, hsl, useTheme } from '@/theme';
import { PressScale, Text } from '@/ui';

import { couponSheetActions, useCouponStake } from './coupon-sheet-store';
import { doubleStake, maxStakeFor, STAKE_PRESETS, type CouponTab } from './placement';
import { StakeInput } from './StakeInput';

interface CouponFooterProps {
  activeTab: CouponTab;
  potentialWin: number;
  effectiveTotalOdds: number;
  totalStake: number;
  balance: number;
  insufficientFunds: boolean;
  isOffline: boolean;
  conflictMessage: string | null;
  submitDisabled: boolean;
  placing: boolean;
  onSubmit: () => void;
  onStakeSubmit: () => void;
  onLayout: (event: LayoutChangeEvent) => void;
}

/** `transition-all duration-200` on the stake presets. */
const PRESET_TRANSITION = {
  transitionProperty: ['transform', 'backgroundColor'],
  transitionDuration: 200,
};

/** Web coupon footer: potential win, AKO stake and presets, notices and `Obstaw`. */
export function CouponFooter({
  activeTab,
  potentialWin,
  effectiveTotalOdds,
  totalStake,
  balance,
  insufficientFunds,
  isOffline,
  conflictMessage,
  submitDisabled,
  placing,
  onSubmit,
  onStakeSubmit,
  onLayout,
}: CouponFooterProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const stake = useCouponStake();
  const maxStake = maxStakeFor(balance);

  const pickStake = (value: string) => {
    haptics.selection();
    couponSheetActions.setStake(value);
  };

  return (
    <View style={styles.footer} onLayout={onLayout}>
      <View style={styles.winRow}>
        <Text color="mutedForeground" style={styles.winLabel}>
          Potencjalna wygrana
        </Text>
        <Text color="success" tabular style={styles.winValue}>
          {potentialWin.toFixed(2)} zł
        </Text>
      </View>

      {activeTab === 'ako' ? (
        <>
          <Text color="mutedForeground" tabular style={styles.small}>
            Współczynnik {effectiveTotalOdds.toFixed(2)}
          </Text>
          <StakeInput
            variant="ako"
            value={stake}
            onChangeValue={couponSheetActions.setStake}
            onSubmitEditing={onStakeSubmit}
            placeholder="Stawka (zł)"
            accessibilityLabel="Stawka (zł)"
          />
          <View style={styles.presets}>
            {STAKE_PRESETS.map((preset) => (
              <PresetButton key={preset} label={`${preset} zł`} active={stake === preset} onPress={() => pickStake(preset)} />
            ))}
            <PresetButton label="2x" accessibilityLabel="Podwój stawkę" active={false} onPress={() => pickStake(doubleStake(stake))} />
            <PresetButton
              label="Max"
              accessibilityHint="Postaw całe saldo"
              active={stake === maxStake && balance > 0}
              disabled={balance <= 0}
              onPress={() => pickStake(maxStake)}
            />
          </View>
        </>
      ) : (
        <Text color="mutedForeground" tabular style={styles.total}>
          Łączna stawka: {totalStake.toFixed(2)} zł
        </Text>
      )}

      {insufficientFunds ? (
        <Text color="destructive" tabular style={styles.notice}>
          Niewystarczające środki — saldo {balance.toFixed(2)} zł
        </Text>
      ) : null}

      {isOffline ? (
        <Text color="destructive" style={styles.notice}>
          {OFFLINE_WRITE_MESSAGE}
        </Text>
      ) : null}

      {conflictMessage ? (
        <View style={styles.conflict} accessibilityRole="alert">
          <AlertTriangle size={14} color={colors.destructive} style={styles.conflictIcon} />
          <Text color="destructive" style={styles.conflictText}>
            {conflictMessage}
          </Text>
        </View>
      ) : null}

      <PressScale
        accessibilityRole="button"
        accessibilityState={{ disabled: submitDisabled, busy: placing }}
        disabled={submitDisabled}
        onPress={onSubmit}
        style={[styles.submit, submitDisabled && styles.submitDisabled]}
      >
        <Text style={styles.submitText}>{placing ? 'Stawianie...' : 'Obstaw'}</Text>
      </PressScale>
    </View>
  );
}

function PresetButton({
  label,
  active,
  disabled,
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected: active, disabled: !!disabled }}
      disabled={disabled}
      hitSlop={{ top: 6, bottom: 6 }}
      onPress={onPress}
      style={styles.presetSlot}
    >
      <Animated.View style={[styles.preset, active && styles.presetActive, disabled && styles.presetDisabled, PRESET_TRANSITION]}>
        <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.presetText, active && styles.presetTextActive]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const useStyles = createStyles(({ colors, gradients, radius }) => ({
  // `border-t border-border p-3 space-y-2.5 bg-card/85` (blurred on the web).
  footer: {
    gap: 10,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: alpha(colors.card, 0.85),
  },
  winRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  winLabel: { fontSize: 14, lineHeight: 21 },
  winValue: { fontSize: 15, lineHeight: 22.5, fontWeight: '700' },
  small: { fontSize: 11, lineHeight: 16.5 },
  total: { fontSize: 12, lineHeight: 18 },
  notice: { fontSize: 11, lineHeight: 16.5, fontWeight: '600' },
  // `grid grid-cols-6 gap-1.5`.
  presets: { flexDirection: 'row', gap: 6 },
  presetSlot: { flex: 1 },
  // `text-[11px] font-semibold px-2 h-8 rounded-md`, idle `bg-card`.
  preset: {
    height: 32,
    paddingHorizontal: 8,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    transform: [{ scale: 1 }],
  },
  // `bg-foreground text-background shadow-sm scale-[1.02]`.
  presetActive: {
    backgroundColor: colors.foreground,
    boxShadow: '0px 1px 2px 0px rgba(0, 0, 0, 0.05)',
    transform: [{ scale: 1.02 }],
  },
  presetDisabled: { opacity: 0.5 },
  presetText: { fontSize: 11, lineHeight: 16.5, fontWeight: '600', color: colors.foreground },
  presetTextActive: { color: colors.background },
  // `rounded-lg border border-destructive/30 bg-destructive/10 p-2.5`, inner `flex items-start gap-2`.
  conflict: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: alpha(colors.destructive, 0.3),
    backgroundColor: alpha(colors.destructive, 0.1),
  },
  conflictIcon: { marginTop: 2 },
  conflictText: { flex: 1, fontSize: 11, lineHeight: 16.5, fontWeight: '600' },
  // `gradient-primary h-10 rounded-lg shadow-[0_4px_16px_hsl(355_100%_45%/0.35)]`.
  submit: {
    height: 40,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundImage: gradients.primary,
    boxShadow: `0px 4px 16px ${hsl(355, 100, 45, 0.35)}`,
  },
  // `disabled:opacity-60 disabled:shadow-none`.
  submitDisabled: { opacity: 0.6, boxShadow: 'none' },
  submitText: { fontSize: 13, lineHeight: 19.5, fontWeight: '700', color: colors.primaryForeground },
}));
