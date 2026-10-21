import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { createStyles } from '@/theme';
import { Text } from '@/ui';
import { enterUp } from './motion';
import { TableButton } from './TableButton';
import { black, bj, white } from './tokens';

interface GridAction {
  key: string;
  label: string;
  tone: 'amber' | 'glass';
  bold?: boolean;
  disabled: boolean;
  onPress: () => void;
}

/** `grid w-full grid-cols-2 gap-2`: two equal columns, an odd last button stays in the left column. */
function ActionGrid({ actions }: { actions: GridAction[] }) {
  const styles = useStyles();
  const rows: GridAction[][] = [];
  for (let index = 0; index < actions.length; index += 2) rows.push(actions.slice(index, index + 2));
  return (
    <View style={styles.grid}>
      {rows.map((row) => (
        <View key={row.map((action) => action.key).join('-')} style={styles.gridRow}>
          {row.map((action) => (
            <TableButton
              key={action.key}
              label={action.label}
              tone={action.tone}
              bold={action.bold}
              disabled={action.disabled}
              onPress={action.onPress}
              style={styles.gridCell}
            />
          ))}
          {row.length === 1 ? <View style={styles.gridCell} /> : null}
        </View>
      ))}
    </View>
  );
}

interface PlayingControlsProps {
  message: string;
  locked: boolean;
  canSplit: boolean;
  canDoubleDown: boolean;
  /** Split and double need the active hand's stake again. */
  stakeAffordable: boolean;
  onHit: () => void;
  onStand: () => void;
  onSplit: () => void;
  onDoubleDown: () => void;
}

/** "Twoja decyzja": Dobierz, Pas, and Podziel / Podwój when eligible. */
export function PlayingControls({
  message,
  locked,
  canSplit,
  canDoubleDown,
  stakeAffordable,
  onHit,
  onStand,
  onSplit,
  onDoubleDown,
}: PlayingControlsProps) {
  const styles = useStyles();
  const actions: GridAction[] = [
    { key: 'hit', label: 'Dobierz', tone: 'glass', disabled: locked, onPress: onHit },
    { key: 'stand', label: 'Pas', tone: 'amber', bold: true, disabled: locked, onPress: onStand },
  ];
  if (canSplit) {
    actions.push({ key: 'split', label: 'Podziel', tone: 'glass', disabled: locked || !stakeAffordable, onPress: onSplit });
  }
  if (canDoubleDown) {
    actions.push({
      key: 'double',
      label: 'Podwój',
      tone: 'glass',
      disabled: locked || !stakeAffordable,
      onPress: onDoubleDown,
    });
  }

  return (
    <Animated.View entering={enterUp} style={styles.panel}>
      <View style={styles.messageSlot}>
        <Text size="xs" weight="600" accessibilityLiveRegion="polite" style={styles.messageText}>
          {message}
        </Text>
      </View>
      <ActionGrid actions={actions} />
    </Animated.View>
  );
}

interface InsuranceControlsProps {
  insuranceStake: number;
  message: string | null;
  canTakeInsurance: boolean;
  affordable: boolean;
  resolving: boolean;
  onTake: () => void;
  onDecline: () => void;
}

/** "Ubezpieczenie": the only choices while the dealer shows an ace. */
export function InsuranceControls({
  insuranceStake,
  message,
  canTakeInsurance,
  affordable,
  resolving,
  onTake,
  onDecline,
}: InsuranceControlsProps) {
  const styles = useStyles();
  return (
    <Animated.View entering={enterUp} style={[styles.panel, styles.insurance]}>
      <Text size="lg" weight="900" style={styles.insuranceTitle}>
        Ubezpieczenie
      </Text>
      <Text size="sm" weight="600" style={styles.insuranceCost}>
        Koszt: {insuranceStake.toFixed(2)} zł
      </Text>
      {message ? (
        <View style={[styles.messageSlot, styles.insuranceMessage]}>
          <Text size="xs" weight="600" accessibilityLiveRegion="polite" style={styles.messageText}>
            {message}
          </Text>
        </View>
      ) : null}
      <View style={styles.gridRow}>
        <TableButton
          label="Ubezpiecz"
          tone="sky"
          bold
          disabled={!canTakeInsurance || resolving || !affordable}
          onPress={onTake}
          style={styles.gridCell}
        />
        <TableButton label="Pomiń" tone="glass" disabled={resolving} onPress={onDecline} style={styles.gridCell} />
      </View>
    </Animated.View>
  );
}

const useStyles = createStyles(() => ({
  // `flex w-full max-w-sm flex-col items-center gap-2`
  panel: { width: '100%', maxWidth: 384, alignSelf: 'center', alignItems: 'center', gap: 8 },
  // `min-h-6 rounded-full border border-white/10 bg-black/45 px-3 py-1 text-xs font-semibold text-white/75`
  messageSlot: {
    minHeight: 24,
    justifyContent: 'center',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: white(0.1),
    backgroundColor: black(0.45),
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  messageText: { color: white(0.75) },
  grid: { width: '100%', gap: 8 },
  gridRow: { width: '100%', flexDirection: 'row', gap: 8 },
  gridCell: { flex: 1 },
  // `rounded-2xl border border-sky-300/20 bg-black/35 px-4 py-3`
  insurance: {
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(125, 211, 252, 0.2)',
    backgroundColor: black(0.35),
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  insuranceTitle: { color: bj.white },
  insuranceCost: { color: white(0.65) },
  insuranceMessage: { minHeight: 0 },
}));
