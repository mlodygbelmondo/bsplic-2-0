import { Users } from 'lucide-react-native';
import { memo } from 'react';
import { View } from 'react-native';

import { pluralPl } from '@/lib/format';
import { createStyles } from '@/theme';
import { Avatar, Text } from '@/ui';
import type { RouletteRoundParticipant } from '@/types/database';

import { arbitraryText, MONO_FONT, rgba, tw } from '../../shared/casinoTheme';
import { fadeSlideIn } from '../../shared/motion';
import { formatRouletteBetValue, getRouletteBetTypeLabel } from '../lib/roulette';
import { getBetChipColor } from '../lib/rouletteGame';
import { useRouletteTable } from '../state/tableStore';
import { RailCard } from './RailCard';

const CARD_ENTERING = fadeSlideIn({ y: 20, delayMs: 180 });

/** Web `RoundParticipantsList`: everyone in the open round with their bets. */
export const RoundParticipantsList = memo(function RoundParticipantsList() {
  const styles = useStyles();
  const participants = useRouletteTable((state) => state.roundParticipants);

  return (
    <RailCard
      Icon={Users}
      title="Gracze w rundzie"
      entering={CARD_ENTERING}
      right={
        <View style={styles.countPill}>
          <Text weight="600" style={styles.countText}>
            {participants.length}
          </Text>
        </View>
      }
    >
      {participants.length === 0 ? (
        <Text style={styles.empty}>Brak zakładów w tej rundzie.</Text>
      ) : (
        <View style={styles.list}>
          {participants.map((participant) => (
            <ParticipantRow key={participant.user_id} participant={participant} />
          ))}
        </View>
      )}
    </RailCard>
  );
});

function ParticipantRow({ participant }: { participant: RouletteRoundParticipant }) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <View style={styles.identity}>
          <Avatar
            uri={participant.avatar_url}
            name={participant.username}
            size={36}
            initials={2}
            style={styles.avatar}
            fallbackStyle={styles.avatarFallback}
            fallbackTextStyle={styles.avatarFallbackText}
          />
          <View style={styles.identityText}>
            <Text weight="600" numberOfLines={1} style={styles.username}>
              {participant.username}
            </Text>
            <Text style={styles.betCount}>
              {participant.bet_count} {pluralPl(participant.bet_count, ['zakład', 'zakłady', 'zakładów'])}
            </Text>
          </View>
        </View>
        <Text weight="700" style={styles.total}>
          {participant.total_stake.toFixed(2)} zł
        </Text>
      </View>
      {participant.bets.length > 0 ? (
        <View style={styles.bets}>
          {participant.bets.map((bet, index) => {
            const chipColor = getBetChipColor(bet.bet_type, bet.bet_value);
            const tone = chipColor ?? 'neutral';
            return (
              <View key={`${bet.bet_type}-${bet.bet_value}-${index}`} style={styles.betRow}>
                <View style={[styles.chip, styles[`chip_${tone}`]]}>
                  {chipColor ? <View style={[styles.dot, styles[`dot_${chipColor}`]]} /> : null}
                  <Text weight="600" style={[styles.chipText, styles[`chipText_${tone}`]]}>
                    {getRouletteBetTypeLabel(bet.bet_type)}: {formatRouletteBetValue(bet.bet_type, bet.bet_value)}
                  </Text>
                </View>
                {Number.isFinite(bet.stake) ? (
                  <Text weight="600" style={styles.betStake}>
                    {bet.stake.toFixed(2)} zł
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = createStyles(() => ({
  countPill: {
    borderRadius: 9999,
    backgroundColor: rgba(tw.white, 0.05),
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: { ...arbitraryText(10), color: rgba(tw.white, 0.5) },
  empty: { color: rgba(tw.white, 0.45) },
  list: { gap: 8 },
  // `rounded-xl border border-white/10 bg-white/[0.02] p-3`
  row: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: rgba(tw.white, 0.1),
    backgroundColor: rgba(tw.white, 0.02),
    padding: 12,
  },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1, minWidth: 0 },
  avatar: { borderWidth: 1, borderColor: rgba(tw.white, 0.1), backgroundColor: 'transparent' },
  avatarFallback: { backgroundColor: rgba(tw.amber500, 0.1) },
  avatarFallbackText: { fontSize: 12, color: tw.amber200 },
  identityText: { flexShrink: 1, minWidth: 0 },
  username: { color: tw.white },
  betCount: { ...arbitraryText(10), textTransform: 'uppercase', letterSpacing: 0.5, color: rgba(tw.white, 0.35) },
  total: { fontFamily: MONO_FONT, color: tw.amber200, flexShrink: 0 },
  bets: { marginTop: 8, gap: 4, paddingLeft: 48 },
  betRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  // `inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold`
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
    borderRadius: 9999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  chip_red: { borderColor: rgba(tw.rose400, 0.3), backgroundColor: rgba(tw.rose500, 0.1) },
  chip_black: { borderColor: rgba(tw.white, 0.2), backgroundColor: rgba(tw.white, 0.05) },
  chip_green: { borderColor: rgba(tw.emerald400, 0.3), backgroundColor: rgba(tw.emerald500, 0.1) },
  chip_neutral: { borderColor: rgba(tw.amber300, 0.15), backgroundColor: rgba(tw.amber300, 0.1) },
  chipText: arbitraryText(10),
  chipText_red: { color: tw.rose200 },
  chipText_black: { color: tw.stone200 },
  chipText_green: { color: tw.emerald200 },
  chipText_neutral: { color: rgba(tw.amber100, 0.9) },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dot_red: { backgroundColor: tw.rose500 },
  dot_black: { borderWidth: 1, borderColor: tw.stone500, backgroundColor: tw.stone900 },
  dot_green: { backgroundColor: tw.emerald500 },
  betStake: { ...arbitraryText(11), fontFamily: MONO_FONT, color: rgba(tw.amber100, 0.8) },
}));
