import { Trophy } from 'lucide-react-native';
import { memo } from 'react';
import { ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { createStyles } from '@/theme';
import { Avatar, Text } from '@/ui';
import type { RouletteRecentWin } from '@/types/database';

import { arbitraryText, rgba, tw } from '../../shared/casinoTheme';
import { fadeSlideIn } from '../../shared/motion';
import { formatRouletteBetValue, getRouletteBetTypeLabel } from '../lib/roulette';
import { useRouletteTable } from '../state/tableStore';
import { RailCard } from './RailCard';

const CARD_ENTERING = fadeSlideIn({ x: 20, delayMs: 250 });
const ROW_ENTERING = Array.from({ length: 10 }, (_, index) => fadeSlideIn({ x: 10, delayMs: index * 40 }));

/** Web `RecentWinsFeed`: the ten newest wins at the table, scrollable inside 400 pt. */
export const RecentWinsFeed = memo(function RecentWinsFeed() {
  const styles = useStyles();
  const wins = useRouletteTable((state) => state.recentWins);

  if (wins.length === 0) {
    return (
      <RailCard Icon={Trophy} title="Ostatnie wygrane" tightHeader entering={CARD_ENTERING}>
        <Text style={styles.empty}>Brak ostatnich wygranych</Text>
      </RailCard>
    );
  }

  return (
    <RailCard Icon={Trophy} title="Ostatnie wygrane" entering={CARD_ENTERING} style={styles.scrollCard}>
      <ScrollView
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={styles.list}
      >
        {wins.slice(0, 10).map((win, index) => (
          <WinRow key={win.id} win={win} index={index} />
        ))}
      </ScrollView>
    </RailCard>
  );
});

function WinRow({ win, index }: { win: RouletteRecentWin; index: number }) {
  const styles = useStyles();
  return (
    <Animated.View
      entering={ROW_ENTERING[index]}
      accessible
      accessibilityLabel={`${win.username}, +${win.payout.toFixed(2)} zł, ${getRouletteBetTypeLabel(win.bet_type)} ${formatRouletteBetValue(win.bet_type, win.bet_value)}, runda ${win.round_number}`}
      style={styles.row}
    >
      <Avatar
        uri={win.avatar_url}
        name={win.username}
        size={32}
        initials={2}
        recyclingKey={win.id}
        style={styles.avatar}
        fallbackStyle={styles.avatarFallback}
        fallbackTextStyle={styles.avatarFallbackText}
      />
      <View style={styles.rowText}>
        <View style={styles.rowTop}>
          <Text weight="500" numberOfLines={1} style={styles.username}>
            {win.username}
          </Text>
          <Text weight="700" style={styles.payout}>
            +{win.payout.toFixed(2)}
          </Text>
        </View>
        <Text style={styles.meta}>
          {getRouletteBetTypeLabel(win.bet_type)} • {formatRouletteBetValue(win.bet_type, win.bet_value)} • #
          {win.round_number}
        </Text>
      </View>
    </Animated.View>
  );
}

const useStyles = createStyles(() => ({
  empty: { color: rgba(tw.white, 0.4) },
  // `max-h-[400px] overflow-y-auto`: the whole card scrolls on the web; the
  // header stays put here and the list scrolls in the remaining height.
  scrollCard: { maxHeight: 400 },
  scroll: { flexGrow: 0 },
  list: { gap: 8 },
  // `flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-2.5`
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: rgba(tw.white, 0.05),
    backgroundColor: rgba(tw.white, 0.02),
    padding: 10,
  },
  avatar: { borderWidth: 1, borderColor: rgba(tw.white, 0.1), backgroundColor: 'transparent' },
  avatarFallback: { backgroundColor: rgba(tw.white, 0.05) },
  avatarFallbackText: { fontSize: 10, color: rgba(tw.white, 0.6) },
  rowText: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  username: { color: tw.white, flexShrink: 1 },
  payout: { color: tw.emerald400 },
  meta: { ...arbitraryText(10), color: rgba(tw.white, 0.4) },
}));
