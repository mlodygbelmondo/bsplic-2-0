import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, type ReactElement } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { useUserId } from '@/features/auth/auth-store';
import { AppHeader } from '@/features/shell/AppHeader';
import { useHasBeenFocused } from '@/lib/focus';
import { haptics } from '@/lib/haptics';
import { alpha, createStyles, useTheme } from '@/theme';
import { ScreenBackground, SectionLoader, Text } from '@/ui';
import { rankingsQuery } from './api/queries';
import {
  RANKING_TYPES,
  SORT_TABS,
  getEmptyRankingsMessage,
  sortRankings,
  type RankEntry,
  type RankingType,
  type SortKey,
} from './ranking-logic';
import { RankingRow } from './RankingRow';

/** Port of the web `RankingsPage` at phone size (mobile list only). */
export function RankingsScreen() {
  const focused = useHasBeenFocused();
  return (
    <ScreenBackground>
      <AppHeader />
      {focused ? <RankingsBody /> : null}
    </ScreenBackground>
  );
}

function RankingsBody() {
  const styles = useStyles();
  const { colors } = useTheme();
  const userId = useUserId();
  const [sortBy, setSortBy] = useState<SortKey>('total_profit');
  const [rankingType, setRankingType] = useState<RankingType>('sportsbook');
  const [pullRefreshing, setPullRefreshing] = useState(false);

  const { data: rankings, error, isLoading, isFetching, refetch } = useQuery(rankingsQuery(rankingType));

  useEffect(() => {
    if (error) console.warn('Rankings fetch error:', error);
  }, [error]);

  const sorted = rankings && !error ? sortRankings(rankings, sortBy) : [];

  const handleRefresh = async () => {
    setPullRefreshing(true);
    try {
      await refetch();
    } finally {
      setPullRefreshing(false);
    }
  };

  const header = (
    <View>
      <View style={styles.header}>
        <Text size="xl" weight="700" accessibilityRole="header">
          Rankingi
        </Text>
        <View style={styles.toggle}>
          {RANKING_TYPES.map(({ value, label }) => {
            const active = rankingType === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                hitSlop={{ top: 8, bottom: 8 }}
                onPress={() => {
                  if (active) return;
                  haptics.selection();
                  setRankingType(value);
                }}
                style={({ pressed }) => [
                  styles.toggleButton,
                  active ? styles.toggleButtonActive : pressed && styles.toggleButtonPressed,
                ]}
              >
                <Text size="xs" weight="600" color={active ? 'primaryForeground' : 'mutedForeground'}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsStrip}
        contentContainerStyle={styles.tabsRow}
      >
        {SORT_TABS.map((tab) => {
          const active = sortBy === tab.key;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              hitSlop={{ top: 8, bottom: 8 }}
              onPress={() => {
                if (active) return;
                haptics.selection();
                setSortBy(tab.key);
              }}
              style={({ pressed }) => [
                styles.sortTab,
                active ? styles.sortTabActive : [styles.sortTabIdle, pressed && styles.sortTabPressed],
              ]}
            >
              <Text size="xs" weight="600" color={active ? 'primaryForeground' : 'mutedForeground'}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  let emptyState: ReactElement;
  if (isLoading) {
    emptyState = <SectionLoader label="Wczytywanie rankingu..." />;
  } else if (error) {
    emptyState = (
      <View style={styles.errorBlock}>
        <Text weight="600" align="center">
          Nie udało się wczytać rankingu
        </Text>
        <Text size="xs" color="mutedForeground" align="center" style={styles.errorBody}>
          Sprawdź połączenie i spróbuj ponownie.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: isFetching }}
          disabled={isFetching}
          hitSlop={{ top: 8, bottom: 8 }}
          onPress={() => void refetch()}
          style={({ pressed }) => [styles.retry, pressed && styles.retryPressed, isFetching && styles.retryDisabled]}
        >
          <Text size="xs" weight="600">
            {isFetching ? 'Ładowanie...' : 'Spróbuj ponownie'}
          </Text>
        </Pressable>
      </View>
    );
  } else {
    emptyState = (
      <View style={styles.emptyBlock}>
        <Text size="base" color="mutedForeground" align="center">
          {getEmptyRankingsMessage(rankingType)}
        </Text>
      </View>
    );
  }

  return (
    <FlashList<RankEntry>
      data={sorted}
      keyExtractor={(item) => item.id}
      extraData={`${sortBy}:${userId ?? ''}`}
      renderItem={({ item, index }) => (
        <RankingRow entry={item} rank={index + 1} sortBy={sortBy} isCurrentUser={item.id === userId} />
      )}
      ListHeaderComponent={header}
      ListEmptyComponent={emptyState}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={pullRefreshing} onRefresh={handleRefresh} tintColor={colors.mutedForeground} />
      }
    />
  );
}

const useStyles = createStyles(({ colors, radius, gradients, shadows, scheme }) => ({
  content: { paddingTop: 8, paddingBottom: 16 },
  header: { marginBottom: 12, gap: 12, paddingHorizontal: 12 },
  toggle: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: alpha(colors.border, 0.72),
    backgroundColor: alpha(colors.muted, scheme === 'light' ? 0.6 : 0.52),
  },
  toggleButton: {
    borderRadius: radius.md,
    borderCurve: 'continuous',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  toggleButtonActive: {
    backgroundColor: colors.primary,
    boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)',
  },
  toggleButtonPressed: { backgroundColor: alpha(colors.primary, 0.1) },
  tabsStrip: { marginBottom: 12, flexGrow: 0 },
  tabsRow: { gap: 8, paddingHorizontal: 12, paddingBottom: 4, paddingRight: 16 },
  sortTab: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  sortTabActive: {
    backgroundImage: gradients.primary,
    boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)',
  },
  sortTabIdle: {
    borderWidth: 1,
    borderColor: alpha(colors.border, 0.7),
    backgroundColor: alpha(colors.muted, 0.6),
  },
  sortTabPressed: { borderColor: alpha(colors.primary, 0.3) },
  errorBlock: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 32,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    // `.app-surface.social-edge-surface` (dark) / `.light .app-surface` wins in light.
    borderColor: scheme === 'light' ? colors.border : alpha(colors.border, 0.9),
    backgroundColor: scheme === 'light' ? colors.card : alpha(colors.card, 0.98),
    boxShadow: scheme === 'light' ? shadows.appSurface : undefined,
  },
  errorBody: { marginTop: 4 },
  retry: {
    marginTop: 16,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  retryPressed: { backgroundColor: colors.muted },
  retryDisabled: { opacity: 0.6 },
  emptyBlock: {
    paddingHorizontal: 16,
    paddingVertical: 32,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: alpha(colors.card, 0.8),
  },
}));
