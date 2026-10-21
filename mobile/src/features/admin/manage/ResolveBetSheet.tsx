import { AlertTriangle, Check, CircleOff, RotateCcw, Trophy } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { formatOdds } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { alpha, createStyles, useTheme } from '@/theme';
import type { Bet } from '@/types/database';
import { PressScale, Text } from '@/ui';
import type { CorrectionScope, SettlementMode } from '../api/settlement';
import { AdminButton } from '../components/AdminButton';
import { AdminSheet } from '../components/AdminSheet';
import { Spinner } from '../components/Spinner';
import { BET_WINNING_OPTION_FORCED_LOSS, BET_WINNING_OPTION_REFUND } from '../constants';
import { normalizeOptions, parseWinningOptions } from '../helpers';
import type { SheetSession } from './EditBetSheet';

type ResolveStep = 'selection' | 'non_multi_warning';

/** Fixed Tailwind amber shades used by the web warning (same in both themes). */
const AMBER = {
  border: '#fcd34d',
  background: '#fffbeb',
  icon: '#b45309',
  title: '#78350f',
  text: '#92400e',
};

/** Web settle / correct dialog (`Ogłoś wynik` / `Korekta wyniku`). */
export function ResolveBetSheet({
  resolve,
  inProgress,
  offline,
  onClose,
  onDismissed,
  onSettle,
}: {
  resolve: SheetSession | null;
  inProgress: boolean;
  offline: boolean;
  onClose: () => void;
  onDismissed: () => void;
  onSettle: (bet: Bet, winners: string[], mode: SettlementMode, scope: CorrectionScope) => void;
}) {
  const bet = resolve?.bet;
  return (
    <AdminSheet
      open={resolve?.open ?? false}
      title={bet ? `${bet.winning_option ? 'Korekta wyniku' : 'Ogłoś wynik'}: ${bet.title}` : ''}
      titleSize="base"
      description={
        bet
          ? bet.winning_option
            ? 'Wybierz nowe rozstrzygnięcie i zakres korekty.'
            : 'Wybierz opcje, które wygrały.'
          : undefined
      }
      locked={inProgress}
      onClose={onClose}
      onDismissed={onDismissed}
    >
      {resolve ? (
        <ResolveForm
          key={resolve.session}
          bet={resolve.bet}
          inProgress={inProgress}
          offline={offline}
          onSettle={onSettle}
        />
      ) : null}
    </AdminSheet>
  );
}

function ResolveForm({
  bet,
  inProgress,
  offline,
  onSettle,
}: {
  bet: Bet;
  inProgress: boolean;
  offline: boolean;
  onSettle: (bet: Bet, winners: string[], mode: SettlementMode, scope: CorrectionScope) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const isCorrection = Boolean(bet.winning_option);
  const [selectedWinners, setSelectedWinners] = useState<string[]>(() =>
    parseWinningOptions(bet.winning_option).filter(
      (winner) => winner !== BET_WINNING_OPTION_REFUND && winner !== BET_WINNING_OPTION_FORCED_LOSS,
    ),
  );
  const [step, setStep] = useState<ResolveStep>('selection');
  const [scope, setScope] = useState<CorrectionScope>('pending_only');
  const options = normalizeOptions(bet.options);
  const blocked = inProgress || offline;

  const toggleWinner = (name: string) => {
    haptics.selection();
    setSelectedWinners((previous) =>
      previous.includes(name) ? previous.filter((item) => item !== name) : [...previous, name],
    );
  };

  const submitNormal = () => {
    if (selectedWinners.length === 0 || blocked) return;
    const needsConfirmation = bet.bet_type !== 'multi' && selectedWinners.length > 1;
    if (needsConfirmation && step === 'selection') {
      haptics.warning();
      setStep('non_multi_warning');
      return;
    }
    onSettle(bet, selectedWinners, 'normal', scope);
  };

  const submitSpecial = (mode: Exclude<SettlementMode, 'normal'>) => {
    if (blocked) return;
    onSettle(bet, [], mode, scope);
  };

  return (
    <View style={styles.stack}>
      {isCorrection ? (
        <View style={styles.scopeBox}>
          <Text size="xs" weight="500" style={styles.scopeLabel}>
            Zakres korekty
          </Text>
          <View accessibilityRole="radiogroup" accessibilityLabel="Zakres korekty wyniku" style={styles.radioGroup}>
            <ScopeOption selected={scope === 'pending_only'} onPress={() => setScope('pending_only')}>
              <Text size="xs">
                Tylko zakłady nadal{' '}
                <Text size="xs" weight="600">
                  pending
                </Text>
              </Text>
            </ScopeOption>
            <ScopeOption selected={scope === 'all'} onPress={() => setScope('all')}>
              <Text size="xs" style={styles.flex}>
                Wszystkie zakłady (także już rozliczone, z korektą salda)
              </Text>
            </ScopeOption>
          </View>
        </View>
      ) : null}

      {step === 'selection' ? (
        <>
          <Text size="xs" color="mutedForeground">
            {bet.bet_type === 'multi'
              ? 'Kliknij opcje które wygrały (możesz wybrać wiele):'
              : 'Wybierz wygraną opcję (dla tego typu zwykle 1):'}
          </Text>
          <View style={styles.options}>
            {options.map((option) => {
              const selected = selectedWinners.includes(option.name);
              return (
                <PressScale
                  key={option.name}
                  scaleTo={0.98}
                  accessibilityRole="togglebutton"
                  accessibilityLabel={`Opcja ${option.name}`}
                  accessibilityState={{ checked: selected, disabled: inProgress }}
                  disabled={inProgress}
                  onPress={() => toggleWinner(option.name)}
                  style={[styles.option, selected && styles.optionSelected, inProgress && styles.dimmed]}
                >
                  <View style={styles.optionName}>
                    <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                      {selected ? <Check size={12} color={colors.primaryForeground} /> : null}
                    </View>
                    <Text weight="500" color={selected ? 'primary' : 'foreground'} style={styles.flex}>
                      {option.name}
                    </Text>
                  </View>
                  <Text size="xs" color="mutedForeground" tabular>
                    {formatOdds(option.odds)}
                  </Text>
                </PressScale>
              );
            })}
          </View>
          <AdminButton
            tone="gradient"
            weight="700"
            label={`${isCorrection ? 'Zapisz korektę' : 'Ogłoś wynik'} (${selectedWinners.length} wybranych)`}
            icon={
              inProgress ? (
                <Spinner size={16} color={colors.primaryForeground} />
              ) : (
                <Trophy size={16} color={colors.primaryForeground} />
              )
            }
            disabled={selectedWinners.length === 0 || blocked}
            onPress={submitNormal}
            style={styles.submit}
          />
        </>
      ) : (
        <View style={styles.warning}>
          <View style={styles.warningHeader}>
            <AlertTriangle size={16} color={AMBER.icon} style={styles.warningIcon} />
            <View style={styles.flex}>
              <Text weight="600" style={{ color: AMBER.title }}>
                Wybrano więcej niż 1 opcję dla typu {bet.bet_type.toUpperCase()}
              </Text>
              <Text size="xs" style={{ color: AMBER.text }}>
                To niestandardowe rozliczenie. Potwierdź, że chcesz kontynuować.
              </Text>
            </View>
          </View>
          <View style={styles.warningActions}>
            <AdminButton
              tone="outline"
              label="Wróć"
              disabled={inProgress}
              onPress={() => setStep('selection')}
              style={styles.flex}
            />
            <AdminButton
              tone="gradient"
              label="Potwierdź"
              icon={inProgress ? <Spinner size={16} color={colors.primaryForeground} /> : null}
              disabled={blocked}
              onPress={submitNormal}
              style={styles.flex}
            />
          </View>
        </View>
      )}

      <View style={styles.separator} />
      {bet.is_bsplicboost ? (
        <AdminButton
          tone="outline"
          label="Ogłoś przegraną (wszyscy)"
          icon={<CircleOff size={16} color={colors.foreground} />}
          disabled={blocked}
          onPress={() => submitSpecial('force_lost')}
        />
      ) : null}
      <AdminButton
        tone="outline"
        label="Rozlicz 1.00 (zwrot)"
        icon={<RotateCcw size={16} color={colors.foreground} />}
        disabled={blocked}
        onPress={() => submitSpecial('refund')}
      />
    </View>
  );
}

function ScopeOption({
  selected,
  onPress,
  children,
}: {
  selected: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  const styles = useStyles();
  return (
    <PressScale
      scaleTo={0.98}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      style={styles.radioRow}
    >
      <View style={styles.radio}>{selected ? <View style={styles.radioDot} /> : null}</View>
      {children}
    </PressScale>
  );
}

const useStyles = createStyles(({ colors, radius }) => ({
  stack: { gap: 8 },
  flex: { flex: 1 },
  scopeBox: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 12 },
  scopeLabel: { marginBottom: 8 },
  radioGroup: { gap: 8 },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8,
  },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  options: { gap: 6 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    minHeight: 44,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: alpha(colors.primary, 0.1) },
  dimmed: { opacity: 0.6 },
  optionName: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  submit: { marginTop: 8 },
  warning: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: AMBER.border,
    backgroundColor: AMBER.background,
    padding: 12,
    gap: 12,
  },
  warningHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  warningIcon: { marginTop: 2 },
  warningActions: { flexDirection: 'row', gap: 8 },
  separator: { paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
}));
