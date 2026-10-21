import { Image } from 'expo-image';
import { ChevronDown, Users } from 'lucide-react-native';
import { memo, useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { haptics } from '@/lib/haptics';
import { hsl } from '@/theme';
import { Text } from '@/ui';

import { ROSTER_COLLAPSED_COUNT } from '../lib/drawModel';
import { formatPolishCount, formatTicketNumber, getInitials } from '../lib/jackpotFormat';
import type { DailyJackpotParticipant } from '../types';
import { REM } from './tokens';

const ROW_TEXT = hsl(0, 0, 72);

/** `.jackpot-draw-roster`: participants and their first three ticket numbers. */
export function DrawRoster({
  participants,
  participantCount,
  expanded,
  onToggle,
  windowHeight,
}: {
  participants: DailyJackpotParticipant[];
  participantCount: number;
  expanded: boolean;
  onToggle: () => void;
  windowHeight: number;
}) {
  const visible = expanded ? participants : participants.slice(0, ROSTER_COLLAPSED_COUNT);
  const hasHidden = participants.length > ROSTER_COLLAPSED_COUNT;
  const rotation = useSharedValue(expanded ? 180 : 0);

  useEffect(() => {
    rotation.set(withTiming(expanded ? 180 : 0, { duration: 150, easing: Easing.bezier(0.4, 0, 0.2, 1) }));
  }, [expanded, rotation]);

  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.get()}deg` }] }));

  return (
    <View
      style={[styles.roster, { maxHeight: expanded ? Math.min(22 * REM, windowHeight * 0.42) : 16.25 * REM }]}
      accessibilityLabel="Uczestnicy i ich tickety"
    >
      <View style={styles.header}>
        <Users size={1.25 * REM} color={hsl(0, 0, 96)} />
        <Text style={styles.title} accessibilityRole="header">
          Uczestnicy i ich tickety
        </Text>
      </View>
      <View style={styles.columns}>
        <Text style={styles.columnText}>Uczestnik</Text>
        <Text style={styles.columnText}>Tickety</Text>
      </View>
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} nestedScrollEnabled>
        {visible.map((participant, index) => (
          <RosterRow key={participant.userId} participant={participant} position={index + 1} />
        ))}
      </ScrollView>
      {hasHidden ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          onPress={() => {
            haptics.selection();
            onToggle();
          }}
          style={({ pressed }) => [styles.more, pressed && styles.morePressed]}
        >
          <Text style={styles.moreText}>{expanded ? 'Pokaż mniej' : `Pokaż wszystkich (${participantCount})`}</Text>
          <Animated.View style={chevronStyle}>
            <ChevronDown size={REM} color={hsl(0, 0, 74)} />
          </Animated.View>
        </Pressable>
      ) : null}
    </View>
  );
}

const RosterRow = memo(function RosterRow({
  participant,
  position,
}: {
  participant: DailyJackpotParticipant;
  position: number;
}) {
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${position}. ${participant.username}, ${formatPolishCount(participant.ticketCount, 'ticket', 'tickety', 'ticketów')}: ${participant.ticketNumbers.map(formatTicketNumber).join(', ')}`}
    >
      <Text style={[styles.rowText, styles.position]}>{position}</Text>
      <View style={styles.avatarColumn}>
        <View style={styles.avatar}>
          {participant.avatarUrl ? (
            <Image
              source={{ uri: participant.avatarUrl }}
              style={styles.avatarImage}
              contentFit="cover"
              recyclingKey={participant.userId}
            />
          ) : (
            <Text style={styles.initials}>{getInitials(participant.username)}</Text>
          )}
        </View>
      </View>
      <Text style={[styles.rowText, styles.name]} numberOfLines={1}>
        {participant.username}
      </Text>
      <View style={styles.tickets}>
        {participant.ticketNumbers.slice(0, 3).map((ticket) => (
          <View key={ticket} style={styles.chip}>
            <Text style={styles.chipText}>{formatTicketNumber(ticket)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  roster: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: hsl(0, 0, 100, 0.1),
    borderRadius: 0.9 * REM,
    padding: 0.85 * REM,
    backgroundImage: `linear-gradient(180deg, ${hsl(0, 0, 7, 0.92)}, ${hsl(0, 0, 4, 0.94)})`,
    boxShadow: `0px 22px 54px ${hsl(0, 0, 0, 0.42)}`,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 0.55 * REM },
  title: {
    color: hsl(0, 0, 96),
    fontSize: 0.78 * REM,
    lineHeight: 0.78 * REM * 1.5,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  columns: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 0.8 * REM,
    marginBottom: 0.42 * REM,
    paddingHorizontal: 0.1 * REM,
  },
  columnText: { color: hsl(0, 0, 56), fontSize: 0.64 * REM, lineHeight: 0.64 * REM * 1.5, fontWeight: '700' },
  list: { flexGrow: 0, flexShrink: 1 },
  listContent: { gap: 0.18 * REM, paddingRight: 0.15 * REM },
  row: {
    minHeight: 2.65 * REM,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0.38 * REM,
    borderBottomWidth: 1,
    borderBottomColor: hsl(0, 0, 100, 0.07),
  },
  rowText: { color: ROW_TEXT, fontSize: 0.74 * REM, lineHeight: 0.74 * REM * 1.5, fontWeight: '700' },
  position: { width: 1.15 * REM },
  // The 2rem avatar overflows its 1.85rem grid column, as on the web.
  avatarColumn: { width: 1.85 * REM, overflow: 'visible' },
  avatar: {
    width: 2 * REM,
    height: 2 * REM,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: hsl(43, 100, 60, 0.28),
    borderRadius: 999,
    backgroundImage: `linear-gradient(135deg, ${hsl(356, 88, 40)}, ${hsl(39, 100, 38)})`,
  },
  avatarImage: { width: '100%', height: '100%' },
  initials: { color: hsl(0, 0, 100), fontSize: 0.64 * REM, lineHeight: 0.64 * REM * 1.5, fontWeight: '800' },
  name: { flex: 1, minWidth: 0, color: hsl(0, 0, 94), fontWeight: '900' },
  tickets: { flexDirection: 'row', justifyContent: 'flex-end', gap: 0.25 * REM, flexShrink: 0 },
  chip: {
    minWidth: 1.62 * REM,
    minHeight: 1.36 * REM,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 0.34 * REM,
    backgroundColor: hsl(34, 83, 26, 0.22),
  },
  chipText: {
    color: hsl(35, 100, 70),
    fontSize: 0.64 * REM,
    lineHeight: 0.64 * REM * 1.5,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  more: {
    minHeight: 2.2 * REM,
    marginTop: 0.45 * REM,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0.55 * REM,
    borderWidth: 1,
    borderColor: hsl(0, 0, 100, 0.1),
    borderRadius: 0.5 * REM,
    backgroundColor: hsl(0, 0, 3, 0.58),
  },
  morePressed: { backgroundColor: hsl(0, 0, 100, 0.06) },
  moreText: { color: hsl(0, 0, 74), fontSize: 0.74 * REM, lineHeight: 0.74 * REM * 1.5, fontWeight: '800' },
});
