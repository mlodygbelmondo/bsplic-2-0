import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ArrowDownLeft, ArrowUpRight, Check } from 'lucide-react-native';
import { memo, useState } from 'react';
import { RefreshControl, View } from 'react-native';

import { getErrorMessage } from '@/lib/errors';
import { alpha, createStyles, useTheme } from '@/theme';
import { Avatar, Button, Text } from '@/ui';
import { moneyTransferHistoryQuery } from './api/transfers';
import { formatMoney, formatTransferDate } from './format';
import type { MoneyTransferHistoryEntry } from './types';

const EMERALD_600 = '#059669';
const EMERALD_500 = '#10b981';

/** Port of the web `MoneyTransferHistory`: sent/received rows, 20 per page. */
export function MoneyTransferHistory() {
  const styles = useStyles();
  const { colors } = useTheme();
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const { data, error, isPending, isFetching, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInfiniteQuery(moneyTransferHistoryQuery());

  const history = data?.pages.flat() ?? [];

  if (isPending) {
    return (
      <View style={styles.centerBlock}>
        <Text color="mutedForeground" align="center">
          Ładowanie historii...
        </Text>
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={[styles.centerBlock, styles.errorBlock]}>
        <Text color="destructive" align="center">
          {getErrorMessage(error, 'Nie udało się pobrać historii transferów')}
        </Text>
        <Button variant="outline" label="Spróbuj ponownie" disabled={isFetching} onPress={() => void refetch()} />
      </View>
    );
  }

  const handleRefresh = async () => {
    setPullRefreshing(true);
    try {
      await refetch();
    } finally {
      setPullRefreshing(false);
    }
  };

  return (
    <FlashList<MoneyTransferHistoryEntry>
      data={history}
      keyExtractor={(entry) => entry.id}
      renderItem={({ item }) => <HistoryRow entry={item} />}
      ItemSeparatorComponent={Separator}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={pullRefreshing} onRefresh={handleRefresh} tintColor={colors.mutedForeground} />
      }
      ListEmptyComponent={
        <View style={styles.centerBlock}>
          <View style={styles.emptyIcon}>
            <Check size={20} color={colors.mutedForeground} />
          </View>
          <Text size="base" weight="600" align="center">
            Brak transferów
          </Text>
          <Text color="mutedForeground" align="center" style={styles.emptyBody}>
            Wysłane i otrzymane środki pojawią się tutaj.
          </Text>
        </View>
      }
      ListFooterComponent={
        hasNextPage && history.length > 0 ? (
          <Button
            variant="ghost"
            fullWidth
            label={isFetchingNextPage ? 'Ładowanie...' : 'Pokaż starsze'}
            disabled={isFetchingNextPage}
            onPress={() => void fetchNextPage()}
            style={styles.more}
          />
        ) : null
      }
    />
  );
}

function Separator() {
  return <View style={separatorStyle} />;
}

const separatorStyle = { height: 8 };

const HistoryRow = memo(function HistoryRow({ entry }: { entry: MoneyTransferHistoryEntry }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const sent = entry.direction === 'sent';
  return (
    <View style={styles.row} accessible accessibilityRole="summary">
      <View style={styles.rowMain}>
        <View style={[styles.direction, sent ? styles.directionSent : styles.directionReceived]}>
          {sent ? (
            <ArrowUpRight size={16} color={colors.mutedForeground} />
          ) : (
            <ArrowDownLeft size={16} color={EMERALD_600} />
          )}
        </View>
        <Avatar
          uri={entry.counterparty_avatar_url}
          name={entry.counterparty_username}
          size={36}
          recyclingKey={entry.id}
        />
        <View style={styles.rowText}>
          <Text weight="600" numberOfLines={1}>
            {sent ? 'Wysłano do' : 'Otrzymano od'} @{entry.counterparty_username}
          </Text>
          <Text color="mutedForeground" style={styles.rowDate}>
            {formatTransferDate(entry.created_at)}
            {entry.counterparty_deleted ? ' · konto usunięte' : ''}
          </Text>
        </View>
        <Text size="base" weight="900" tabular style={sent ? styles.amountSent : styles.amountReceived}>
          {sent ? '−' : '+'}
          {formatMoney(Number(entry.amount))} zł
        </Text>
      </View>
      {entry.message ? (
        <Text size="xs" color="mutedForeground" style={styles.message}>
          {entry.message}
        </Text>
      ) : null}
    </View>
  );
});

const useStyles = createStyles(({ colors }) => ({
  // TabsContent px-5 pb-5 pt-4 around the list's pr-1.
  content: { paddingHorizontal: 20, paddingTop: 16, paddingRight: 24, paddingBottom: 20 },
  centerBlock: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 20 },
  errorBlock: { paddingVertical: 40, gap: 12 },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.muted,
  },
  emptyBody: { marginTop: 4 },
  more: { marginTop: 8 },
  row: {
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: alpha(colors.border, 0.6),
    padding: 12,
  },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  direction: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  directionSent: { backgroundColor: colors.muted },
  directionReceived: { backgroundColor: alpha(EMERALD_500, 0.12) },
  rowText: { flex: 1, minWidth: 0 },
  rowDate: { fontSize: 11, lineHeight: 16 },
  amountSent: { color: colors.foreground },
  amountReceived: { color: EMERALD_600 },
  message: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: alpha(colors.border, 0.6),
  },
}));
