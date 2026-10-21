import { RotateCcw, Sparkles, Trash2, Trophy } from 'lucide-react-native';
import { memo } from 'react';
import { View } from 'react-native';

import { alpha, createStyles, useTheme, type Palette } from '@/theme';
import type { Bet } from '@/types/database';
import { Text } from '@/ui';
import { AdminButton } from '../components/AdminButton';
import { Spinner } from '../components/Spinner';
import { BET_STATUS_LABEL, getBetStatus, type BetStatusTone } from './status';

interface BetCardProps {
  bet: Bet;
  resolving: boolean;
  deleting: boolean;
  offline: boolean;
  onEdit: (bet: Bet) => void;
  onResolve: (bet: Bet) => void;
  onRefund: (bet: Bet) => void;
  onDelete: (bet: Bet) => void;
}

/** Mobile bet card from the web `ManageBetsTab` (`md:hidden` list). */
export const BetCard = memo(function BetCard({
  bet,
  resolving,
  deleting,
  offline,
  onEdit,
  onResolve,
  onRefund,
  onDelete,
}: BetCardProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const settled = Boolean(bet.winning_option);

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.info}>
          <Text weight="700" numberOfLines={2} style={styles.title}>
            {bet.title}
          </Text>
          <View style={styles.meta}>
            <Text weight="500" color="mutedForeground" style={styles.type}>
              {bet.bet_type}
            </Text>
            {bet.is_bsplicboost ? (
              <View style={styles.boost}>
                <Sparkles size={12} color={colors.primary} />
                <Text weight="700" color="primary" style={styles.boostText}>
                  BOOST
                </Text>
              </View>
            ) : null}
            <Text weight="500" color="mutedForeground" style={styles.count}>
              {bet.bet_count} zakł.
            </Text>
          </View>
        </View>
        <StatusBadge tone={getBetStatus(bet)} />
      </View>

      <View style={styles.actions}>
        <View style={styles.actionRow}>
          <AdminButton
            tone="secondary"
            label="Edytuj"
            accessibilityLabel={`Edytuj ${bet.title}`}
            onPress={() => onEdit(bet)}
            style={styles.action}
          />
          <AdminButton
            tone="gradient"
            weight="600"
            label={settled ? 'Korekta' : 'Wynik'}
            icon={
              resolving ? (
                <Spinner size={12} color={colors.primaryForeground} />
              ) : (
                <Trophy size={12} color={colors.primaryForeground} />
              )
            }
            disabled={resolving}
            onPress={() => onResolve(bet)}
            style={styles.action}
          />
        </View>
        <View style={styles.actionRow}>
          {!settled ? (
            <AdminButton
              tone="outline"
              label="1.00"
              icon={<RotateCcw size={12} color={colors.foreground} />}
              disabled={resolving || offline}
              onPress={() => onRefund(bet)}
              style={[styles.action, styles.outline]}
            />
          ) : null}
          <AdminButton
            tone="ghostDestructive"
            accessibilityLabel={`Usuń ${bet.title}`}
            icon={
              deleting ? <Spinner size={12} color={colors.destructive} /> : <Trash2 size={16} color={colors.destructive} />
            }
            disabled={deleting || offline}
            onPress={() => onDelete(bet)}
            style={[styles.action, styles.delete]}
          />
          {/* Grid cell placeholder: a settled bet has no refund button. */}
          {settled ? <View style={styles.action} /> : null}
        </View>
      </View>
    </View>
  );
});

function statusColors(tone: BetStatusTone, colors: Palette['colors']) {
  switch (tone) {
    case 'lost':
      return colors.destructive;
    case 'resolved':
      return colors.success;
    case 'active':
      return colors.primary;
    default:
      return colors.mutedForeground;
  }
}

/** Web `statusBadge`: `text-[11px] border px-2 py-0.5 rounded-md font-semibold tracking-wide`. */
function StatusBadge({ tone }: { tone: BetStatusTone }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const color = statusColors(tone, colors);
  const muted = tone === 'refund' || tone === 'closed';
  return (
    <View
      style={[
        styles.badge,
        {
          borderColor: alpha(color, 0.3),
          backgroundColor: muted ? alpha(colors.muted, 0.5) : alpha(color, 0.1),
        },
      ]}
    >
      <Text weight="600" style={[styles.badgeText, { color }]}>
        {BET_STATUS_LABEL[tone]}
      </Text>
    </View>
  );
}

const useStyles = createStyles(({ colors, radius }) => ({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    borderCurve: 'continuous',
    padding: 16,
    gap: 12,
    boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)',
    overflow: 'hidden',
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  info: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontSize: 15, lineHeight: 18.75 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  type: { fontSize: 10, lineHeight: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  boost: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  boostText: { fontSize: 10, lineHeight: 14 },
  count: { fontSize: 11, lineHeight: 16 },
  // `grid grid-cols-2 gap-2 pt-1`.
  actions: { gap: 8, paddingTop: 4 },
  actionRow: { flexDirection: 'row', gap: 8 },
  action: { flex: 1, borderRadius: radius.lg },
  outline: { borderColor: colors.border },
  delete: { paddingHorizontal: 0 },
  badge: {
    borderWidth: 1,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 11, lineHeight: 16, letterSpacing: 0.275 },
}));
