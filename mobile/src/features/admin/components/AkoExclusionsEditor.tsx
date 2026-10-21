import { Plus, X } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { haptics } from '@/lib/haptics';
import { createStyles, useTheme } from '@/theme';
import type { Bet } from '@/types/database';
import { PressScale, Text } from '@/ui';
import { findAkoCandidates } from '../ako-search';
import type { BetAkoExclusionDraft } from '../api/ako-exclusions';
import { CapsLabel, Input } from './form';

interface AkoExclusionsEditorProps {
  availableBets: Bet[];
  value: BetAkoExclusionDraft[];
  onChange: (value: BetAkoExclusionDraft[]) => void;
  currentBetId?: string;
  disabled?: boolean;
  loading?: boolean;
}

/** Web `AkoExclusionsEditor`: search active bets, add them, give each an optional reason. */
export function AkoExclusionsEditor({
  availableBets,
  value,
  onChange,
  currentBetId,
  disabled = false,
  loading = false,
}: AkoExclusionsEditorProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [search, setSearch] = useState('');
  const matches = findAkoCandidates({ availableBets, search, currentBetId, selected: value });

  const addBet = (bet: Bet) => {
    haptics.selection();
    onChange([...value, { betId: bet.id, title: bet.title, reason: null }]);
    setSearch('');
  };

  const updateReason = (betId: string, reason: string) => {
    onChange(value.map((exclusion) => (exclusion.betId === betId ? { ...exclusion, reason } : exclusion)));
  };

  const removeBet = (betId: string) => {
    haptics.selection();
    onChange(value.filter((exclusion) => exclusion.betId !== betId));
  };

  return (
    <View style={styles.section}>
      <View style={styles.headerText}>
        <Text weight="600">Wykluczenia AKO</Text>
        <Text size="xs" color="mutedForeground">
          Nie pozwalaj łączyć tego zakładu z wybranymi zdarzeniami na kuponie AKO.
        </Text>
      </View>

      <View style={styles.searchBlock}>
        <CapsLabel>Szukaj wykluczenia AKO</CapsLabel>
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Wpisz tytuł zakładu"
          accessibilityLabel="Szukaj wykluczenia AKO"
          disabled={disabled}
          autoCorrect={false}
          returnKeyType="search"
          style={styles.cardInput}
        />
      </View>

      {loading ? (
        <Text size="xs" color="mutedForeground">
          Wczytywanie wykluczeń…
        </Text>
      ) : null}

      {matches.length > 0 ? (
        <View style={styles.matches}>
          {matches.map((bet) => (
            <PressScale
              key={bet.id}
              scaleTo={0.98}
              accessibilityRole="button"
              accessibilityLabel={`Dodaj ${bet.title}`}
              disabled={disabled}
              onPress={() => addBet(bet)}
              style={[styles.match, disabled && styles.disabled]}
            >
              <Text size="xs" weight="500" numberOfLines={2} style={styles.flex}>
                {bet.title}
              </Text>
              <Plus size={14} color={colors.foreground} />
            </PressScale>
          ))}
        </View>
      ) : null}

      {value.length > 0 ? (
        <View style={styles.selected}>
          {value.map((exclusion) => (
            <View key={exclusion.betId} style={styles.item}>
              <View style={styles.itemHeader}>
                <Text size="xs" weight="600" style={styles.itemTitle}>
                  {exclusion.title}
                </Text>
                <PressScale
                  accessibilityRole="button"
                  accessibilityLabel={`Usuń ${exclusion.title}`}
                  disabled={disabled}
                  hitSlop={12}
                  onPress={() => removeBet(exclusion.betId)}
                  style={[styles.remove, disabled && styles.disabled]}
                >
                  <X size={14} color={colors.mutedForeground} />
                </PressScale>
              </View>
              <Input
                value={exclusion.reason ?? ''}
                onChangeText={(reason) => updateReason(exclusion.betId, reason)}
                disabled={disabled}
                accessibilityLabel={`Powód dla ${exclusion.title}`}
                placeholder="Powód (opcjonalnie)"
                style={styles.reasonInput}
              />
            </View>
          ))}
        </View>
      ) : (
        <Text size="xs" color="mutedForeground">
          Brak wykluczeń dla tego zakładu.
        </Text>
      )}
    </View>
  );
}

const useStyles = createStyles(({ colors, radius }) => ({
  section: {
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: `${colors.background}99`,
    padding: 16,
    gap: 12,
  },
  headerText: { gap: 4 },
  searchBlock: { gap: 8 },
  cardInput: { backgroundColor: colors.card },
  matches: { gap: 6 },
  match: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 44,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  flex: { flex: 1 },
  disabled: { opacity: 0.6 },
  selected: { gap: 8 },
  item: {
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 10,
    gap: 8,
  },
  itemHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  itemTitle: { flex: 1, lineHeight: 16.5 },
  remove: { borderRadius: radius.md, padding: 4 },
  reasonInput: { height: 32, fontSize: 12 },
}));
