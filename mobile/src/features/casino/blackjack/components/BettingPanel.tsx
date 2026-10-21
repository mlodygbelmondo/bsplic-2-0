import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { haptics } from '@/lib/haptics';
import { createStyles, fonts } from '@/theme';
import { PressScale, Text } from '@/ui';
import { enterUp, exitUp } from './motion';
import { TableButton } from './TableButton';
import { black, bj, white } from './tokens';

const QUICK_STAKES = [10, 25, 50, 100, 250, 1000];

interface BettingPanelProps {
  betInput: string;
  onBetInputChange: (next: string) => void;
  parsedBet: number;
  balance: number;
  isBetValid: boolean;
  isDealing: boolean;
  isSyncing: boolean;
  actionMessage: string | null;
  /** Shown instead of the action message while offline. */
  offlineMessage: string | null;
  /** `min-[380px]`: input and button side by side. */
  wide: boolean;
  onStart: () => void;
}

function StakeChip({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      style={[styles.chip, selected ? styles.chipSelected : styles.chipIdle, disabled && styles.chipDisabled]}
    >
      <Text size="sm" weight="700" style={selected ? styles.chipSelectedText : styles.chipText}>
        {label}
      </Text>
    </PressScale>
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) rows.push(items.slice(index, index + size));
  return rows;
}

/** "Rozpocznij rozdanie": quick stakes, more stake options, stake input and "Graj". */
export function BettingPanel({
  betInput,
  onBetInputChange,
  parsedBet,
  balance,
  isBetValid,
  isDealing,
  isSyncing,
  actionMessage,
  offlineMessage,
  wide,
  onStart,
}: BettingPanelProps) {
  const styles = useStyles();
  const [moreOpen, setMoreOpen] = useState(false);
  const maxStake = Math.max(0, Math.floor(balance));
  const noFunds = balance < 1;

  const multiply = (factor: number) => {
    const value = Number(betInput.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0 || maxStake < 1) return;
    onBetInputChange(String(Math.min(value * factor, maxStake)));
  };

  const modifiers: { label: string; onPress: () => void }[] = [
    { label: 'MIN', onPress: () => onBetInputChange('1') },
    { label: '1/4', onPress: () => onBetInputChange(String(Math.max(1, Math.floor(balance / 4)))) },
    { label: '1/2', onPress: () => onBetInputChange(String(Math.max(1, Math.floor(balance / 2)))) },
    { label: 'x2', onPress: () => multiply(2) },
    { label: 'x4', onPress: () => multiply(4) },
    { label: 'MAX', onPress: () => onBetInputChange(String(maxStake)) },
  ];

  const message = offlineMessage ?? actionMessage;

  return (
    <Animated.View entering={enterUp} exiting={exitUp} style={styles.panel}>
      <Text size="xl" weight="700" accessibilityRole="header" style={styles.title}>
        Rozpocznij rozdanie
      </Text>
      <View style={styles.stakes}>
        <View style={styles.grid}>
          {chunk(QUICK_STAKES, 3).map((row) => (
            <View key={row.join('-')} style={styles.chipRow}>
              {row.map((amount) => (
                <StakeChip
                  key={amount}
                  label={String(amount)}
                  selected={parsedBet === amount}
                  disabled={amount > balance}
                  onPress={() => onBetInputChange(String(amount))}
                />
              ))}
            </View>
          ))}
        </View>
        <View>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: moreOpen }}
            onPress={() => setMoreOpen((open) => !open)}
            style={styles.more}
          >
            <Text size="sm" weight="600" style={styles.moreText}>
              Więcej opcji stawki
            </Text>
          </Pressable>
          {moreOpen ? (
            <View style={styles.grid}>
              {chunk(modifiers, 3).map((row) => (
                <View key={row.map((item) => item.label).join('-')} style={styles.chipRow}>
                  {row.map((item) => (
                    <StakeChip
                      key={item.label}
                      label={item.label}
                      selected={false}
                      disabled={noFunds}
                      onPress={item.onPress}
                    />
                  ))}
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>
      <View style={[styles.entry, wide && styles.entryWide]}>
        <TextInput
          accessibilityLabel="Stawka blackjacka"
          keyboardType="decimal-pad"
          inputMode="decimal"
          value={betInput}
          onChangeText={onBetInputChange}
          selectTextOnFocus
          maxFontSizeMultiplier={1.35}
          placeholderTextColor={white(0.4)}
          keyboardAppearance="dark"
          style={[styles.input, wide && styles.inputWide]}
        />
        <TableButton
          label={isDealing ? 'Rozdawanie...' : 'Graj'}
          tone="amber"
          radius={12}
          size="sm"
          bold
          disabled={isSyncing || isDealing || !isBetValid || offlineMessage !== null}
          onPress={onStart}
          style={[styles.play, wide && styles.playWide]}
        />
      </View>
      {message ? (
        <View style={styles.message}>
          <Text size="xs" weight="600" style={styles.messageText}>
            {message}
          </Text>
        </View>
      ) : null}
      <Text size="sm" style={styles.balance}>
        Saldo: {balance.toFixed(2)} zł
      </Text>
    </Animated.View>
  );
}

const useStyles = createStyles(() => ({
  // `flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl bg-[#211014]/95 p-4`
  panel: {
    width: '100%',
    maxWidth: 384,
    alignSelf: 'center',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: bj.panel95,
    padding: 16,
  },
  title: { color: bj.white },
  // `flex w-full flex-col gap-1.5`, chip grids `grid-cols-3 gap-2`
  stakes: { width: '100%', gap: 6 },
  grid: { gap: 8 },
  chipRow: { flexDirection: 'row', gap: 8 },
  // `h-11 min-w-0 flex-1 basis-0 rounded-full border px-2 text-sm font-bold`
  chip: {
    flex: 1,
    height: 44,
    borderRadius: 9999,
    borderWidth: 1,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipIdle: { borderColor: white(0.15), backgroundColor: black(0.35) },
  chipSelected: { borderColor: 'rgba(252, 211, 77, 0.7)', backgroundColor: 'rgba(251, 191, 36, 0.2)' },
  chipDisabled: { opacity: 0.35 },
  chipText: { color: white(0.75) },
  chipSelectedText: { color: bj.amber100 },
  // `<summary>`: `flex min-h-11 items-center justify-center text-sm font-semibold text-white/80`
  more: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  moreText: { color: white(0.8) },
  // `flex w-full flex-col items-stretch gap-3 min-[380px]:flex-row min-[380px]:items-center justify-center`
  entry: { width: '100%', gap: 12, alignItems: 'stretch', justifyContent: 'center' },
  entryWide: { flexDirection: 'row', alignItems: 'center' },
  // `h-12 w-full rounded-xl border-white/20 bg-black/40 text-center text-lg text-white min-[380px]:w-32`
  input: {
    height: 48,
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: white(0.2),
    backgroundColor: black(0.4),
    paddingHorizontal: 12,
    textAlign: 'center',
    color: bj.white,
    fontFamily: fonts.family,
    fontSize: 18,
  },
  inputWide: { width: 128 },
  // `h-12 rounded-xl px-8 min-[380px]:w-32 font-bold text-black`
  play: { paddingHorizontal: 32 },
  playWide: { width: 128, paddingHorizontal: 0 },
  // `rounded-full border border-white/10 bg-black/35 px-3 py-1 text-xs font-semibold text-white/70`
  message: {
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: white(0.1),
    backgroundColor: black(0.35),
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  messageText: { color: white(0.7) },
  balance: { color: white(0.75) },
}));
