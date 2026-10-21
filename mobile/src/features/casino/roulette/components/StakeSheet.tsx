import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBalance } from '@/features/auth/auth-store';
import { createStyles, text } from '@/theme';
import { PressScale, Text } from '@/ui';

import { rgba, tw } from '../../shared/casinoTheme';
import { adjustRouletteStake, getMaxRouletteStake, normalizeStakeInput } from '../lib/rouletteGame';
import { rouletteSession, useRouletteSession } from '../state/sessionStore';
import { useRouletteTable } from '../state/tableStore';

const STAKE_PRESETS = [10, 25, 50, 100];

/**
 * `/sheets/roulette-stake` (web mobile `StakeDrawer` sheet): presets, a
 * custom amount and 1/2 · 2x · MAX. The stake lives in the roulette session
 * store, so the table's bar updates as the player types.
 */
export function StakeSheet() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const balance = Number(useBalance());
  const stake = useRouletteSession((state) => state.stake);
  const loading = useRouletteTable((state) => state.isPlacingBet);
  const parsedStake = Number(stake);

  useEffect(() => {
    rouletteSession.setStakeSheetOpen(true);
    return () => rouletteSession.setStakeSheetOpen(false);
  }, []);

  const setStake = (value: string) => rouletteSession.setStake(value);

  return (
    <View style={[styles.sheet, { paddingBottom: 16 + insets.bottom }]} collapsable={false}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text size="lg" weight="600" accessibilityRole="header" style={styles.title}>
            Wybierz stawkę
          </Text>
          <Text style={styles.description}>Saldo: {balance.toFixed(2)} zł. Kwota dotyczy jednego zakładu.</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Zamknij"
          onPress={() => router.back()}
          style={styles.close}
        >
          <X size={16} color={rgba(tw.white, 0.7)} />
        </Pressable>
      </View>

      <View style={styles.presets}>
        {STAKE_PRESETS.map((preset) => {
          const selected = parsedStake === preset;
          const disabled = preset > balance || loading;
          return (
            <Pressable
              key={preset}
              accessibilityRole="button"
              accessibilityLabel={`${preset} zł`}
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => setStake(String(preset))}
              style={[styles.preset, selected ? styles.presetSelected : styles.presetIdle, disabled && styles.presetDisabled]}
            >
              <Text size="base" weight="600" style={selected ? styles.presetTextSelected : styles.presetText}>
                {preset}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text nativeID="roulette-stake-label" style={styles.label}>
        Własna kwota w zł
      </Text>
      <TextInput
        accessibilityLabel="Własna kwota w zł"
        accessibilityLabelledBy="roulette-stake-label"
        value={stake}
        editable={!loading}
        onChangeText={(value) => rouletteSession.setStake(normalizeStakeInput(value))}
        keyboardType="decimal-pad"
        inputMode="decimal"
        returnKeyType="done"
        selectTextOnFocus
        maxFontSizeMultiplier={1.35}
        placeholderTextColor={rgba(tw.white, 0.3)}
        keyboardAppearance="dark"
        style={[styles.input, loading && styles.inputDisabled]}
      />

      <View style={styles.adjust}>
        <AdjustButton label="1/2" onPress={() => setStake(adjustRouletteStake(stake, 0.5))} />
        <AdjustButton label="2x" onPress={() => setStake(adjustRouletteStake(stake, 2))} />
        <AdjustButton label="MAX" onPress={() => setStake(getMaxRouletteStake(balance))} />
      </View>

      <PressScale
        scaleTo={0.98}
        accessibilityRole="button"
        accessibilityLabel="Gotowe"
        onPress={() => router.back()}
        style={styles.done}
      >
        <Text size="base" weight="700" style={styles.doneText}>
          Gotowe
        </Text>
      </PressScale>
    </View>
  );
}

function AdjustButton({ label, onPress }: { label: string; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.adjustButton}>
      <Text weight="600" style={styles.adjustText}>
        {label}
      </Text>
    </Pressable>
  );
}

const useStyles = createStyles(() => ({
  // `rounded-t-2xl border-white/15 bg-[#0b1713] px-4 pb-[1rem+safe-area] text-white` (+ SheetContent `p-6` top)
  sheet: { backgroundColor: '#0b1713', paddingHorizontal: 16, paddingTop: 24 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerText: { flex: 1, gap: 4 },
  title: { color: tw.white },
  description: { color: rgba(tw.white, 0.75) },
  // `h-11 w-11` close button in the top-right corner.
  close: {
    width: 44,
    height: 44,
    marginTop: -16,
    marginRight: -8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  presets: { marginVertical: 16, flexDirection: 'row', gap: 8 },
  // `min-h-12 rounded-xl border text-base font-semibold disabled:opacity-40`
  preset: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1 },
  presetIdle: { borderColor: rgba(tw.white, 0.2) },
  presetSelected: { borderColor: tw.amber300, backgroundColor: rgba(tw.amber400, 0.15) },
  presetDisabled: { opacity: 0.4 },
  presetText: { color: tw.white },
  presetTextSelected: { color: tw.amber100 },
  label: { marginBottom: 8, color: rgba(tw.white, 0.8) },
  // `h-12 border-white/25 bg-black/30 text-center text-lg font-bold text-white` (shadcn Input `rounded-md`)
  input: {
    ...text.lg,
    height: 48,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: rgba(tw.white, 0.25),
    backgroundColor: rgba(tw.black, 0.3),
    paddingHorizontal: 12,
    paddingVertical: 0,
    textAlign: 'center',
    fontWeight: '700',
    color: tw.white,
  },
  inputDisabled: { opacity: 0.5 },
  adjust: { marginVertical: 12, flexDirection: 'row', gap: 8 },
  // `min-h-11 rounded-xl border border-white/20 font-semibold`
  adjustButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: rgba(tw.white, 0.2),
  },
  adjustText: { ...text.base, color: tw.white },
  // `h-12 w-full rounded-xl bg-amber-400 text-base font-bold text-black`
  done: { height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: tw.amber400 },
  doneText: { color: tw.black },
}));
