import 'expo-sqlite/localStorage/install';

import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { useAppTheme } from '@/hooks/use-app-theme';
import { useCoupon } from '@/providers/coupon-provider';
import { useBets, type SortMode } from '@/features/home/hooks/useBets';
import { useCategories } from '@/features/home/hooks/useCategories';
import { DailyJackpotCard } from '@/features/jackpot/components/daily-jackpot-card';
import { useRouteActive } from '@/hooks/use-route-active';
import type { Bet, Category, CouponItem } from '@/types/database';

import { ProposeBetModal } from './propose-bet-modal';

const CATEGORY_KEY = 'bsplic.home.category';
const SORT_KEY = 'bsplic.home.sort';
const ACTIVE_ONLY_KEY = 'bsplic.home.activeOnly';

function readValue(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function BetOptionButton({
  bet,
  option,
}: {
  bet: Bet;
  option: Bet['options'][number];
}) {
  const { tokens } = useAppTheme();
  const { items, addItem, removeItem } = useCoupon();
  const selected = items.some(
    (item) =>
      item.bet.id === bet.id && item.selectedOption === option.name,
  );

  const handlePress = () => {
    if (selected) {
      removeItem(bet.id);
      return;
    }

    const item: CouponItem = {
      bet,
      selectedOption: option.name,
      odds: option.odds,
    };
    addItem(item);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${option.name}, kurs ${option.odds.toFixed(2)}`}
      onPress={handlePress}
      style={({ pressed }) => ({
        minHeight: 52,
        flex: 1,
        minWidth: 92,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 2,
        borderRadius: 12,
        borderCurve: 'continuous',
        paddingHorizontal: 10,
        paddingVertical: 8,
        backgroundColor: selected ? tokens.colors.foreground : tokens.colors.odds,
        opacity: pressed ? 0.78 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}>
      <Text
        numberOfLines={1}
        style={{
          color: selected ? tokens.colors.background : tokens.colors.oddsForeground,
          fontSize: 12,
          fontWeight: '700',
        }}>
        {option.name}
      </Text>
      <Text
        selectable
        style={{
          color: selected ? tokens.colors.odds : tokens.colors.oddsForeground,
          fontSize: 16,
          fontWeight: '900',
          fontVariant: ['tabular-nums'],
        }}>
        {option.odds.toFixed(2)}
      </Text>
    </Pressable>
  );
}

function BetCard({ bet, category }: { bet: Bet; category?: Category }) {
  const { tokens } = useAppTheme();
  const closesAt = new Date(bet.ends_at);
  const closed = closesAt.getTime() <= Date.now();

  return (
    <View
      style={{
        marginHorizontal: 12,
        marginBottom: 10,
        gap: 12,
        borderRadius: 18,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: bet.is_live ? tokens.colors.primary : tokens.colors.border,
        backgroundColor: tokens.colors.card,
        padding: 14,
        boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {bet.is_live ? (
          <View
            style={{
              borderRadius: 999,
              backgroundColor: tokens.colors.primary,
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}>
            <Text style={{ color: tokens.colors.primaryForeground, fontSize: 10, fontWeight: '900' }}>
              LIVE
            </Text>
          </View>
        ) : null}
        {bet.is_bsplicboost ? (
          <Text style={{ color: tokens.colors.selectedYellow, fontSize: 11, fontWeight: '900' }}>
            BSPLICBOOST
          </Text>
        ) : null}
        <Text
          numberOfLines={1}
          style={{ flex: 1, color: tokens.colors.mutedForeground, fontSize: 11 }}>
          {category ? `${category.emoji} ${category.name}` : 'Zakład'}
        </Text>
        <Text
          selectable
          style={{ color: tokens.colors.mutedForeground, fontSize: 10, fontVariant: ['tabular-nums'] }}>
          {closed
            ? 'Zamknięty'
            : closesAt.toLocaleString('pl-PL', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
        </Text>
      </View>

      <Text
        selectable
        style={{ color: tokens.colors.foreground, fontSize: 16, fontWeight: '800' }}>
        {bet.title}
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {bet.options.map((option) => (
          <BetOptionButton key={option.name} bet={bet} option={option} />
        ))}
      </View>

      <Text style={{ color: tokens.colors.mutedForeground, fontSize: 10 }}>
        {bet.bet_count} obstawień
      </Text>
    </View>
  );
}

function CategoryPill({
  category,
  selected,
  onPress,
}: {
  category: Category | null;
  selected: boolean;
  onPress: () => void;
}) {
  const { tokens } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 42,
        justifyContent: 'center',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: selected ? tokens.colors.primary : tokens.colors.border,
        backgroundColor: selected ? tokens.colors.secondary : tokens.colors.card,
        paddingHorizontal: 14,
        opacity: pressed ? 0.75 : 1,
      })}>
      <Text
        style={{
          color: selected ? tokens.colors.primary : tokens.colors.foreground,
          fontSize: 13,
          fontWeight: selected ? '800' : '600',
        }}>
        {category ? `${category.emoji} ${category.name}` : 'Wszystkie'}
      </Text>
    </Pressable>
  );
}

export function SportsbookScreen() {
  const routeActive = useRouteActive();
  const { tokens } = useAppTheme();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(() =>
    readValue(CATEGORY_KEY),
  );
  const [sort, setSort] = useState<SortMode>(() => {
    const value = readValue(SORT_KEY);
    return value === 'popular' || value === 'ending_soon' ? value : 'newest';
  });
  const [includeInProgress, setIncludeInProgress] = useState(
    () => readValue(ACTIVE_ONLY_KEY) === 'false',
  );
  const [proposalOpen, setProposalOpen] = useState(false);
  const { items, totalOdds } = useCoupon();
  const { categories, categoryMap, loading: categoriesLoading } = useCategories();
  const {
    liveBets,
    sortedBets,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    refresh,
  } = useBets(selectedCategory, sort, includeInProgress, routeActive);

  const bets = useMemo(() => [...liveBets, ...sortedBets], [liveBets, sortedBets]);

  const selectCategory = (categoryId: string | null) => {
    setSelectedCategory(categoryId);
    try {
      if (categoryId) localStorage.setItem(CATEGORY_KEY, categoryId);
      else localStorage.removeItem(CATEGORY_KEY);
    } catch {
      // Selection remains available for the current session.
    }
  };

  const cycleSort = () => {
    const next: SortMode =
      sort === 'newest' ? 'ending_soon' : sort === 'ending_soon' ? 'popular' : 'newest';
    setSort(next);
    try {
      localStorage.setItem(SORT_KEY, next);
    } catch {
      // Sorting remains available for the current session.
    }
  };

  const toggleInProgress = () => {
    setIncludeInProgress((current) => {
      const next = !current;
      try {
        localStorage.setItem(ACTIVE_ONLY_KEY, String(!next));
      } catch {
        // Preference persistence is best effort.
      }
      return next;
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: tokens.colors.background }}>
      <FlatList
        data={bets}
        keyExtractor={(bet) => bet.id}
        renderItem={({ item }) => (
          <BetCard bet={item} category={item.category ?? categoryMap[item.category_id ?? '']} />
        )}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: items.length ? 160 : 112 }}
        ListHeaderComponent={
          <View style={{ gap: 12, paddingBottom: 12 }}>
            <View style={{ paddingHorizontal: 14, paddingTop: 10 }}>
              <Text
                selectable
                style={{ color: tokens.colors.foreground, fontSize: 26, fontWeight: '900' }}>
                Zakłady
              </Text>
              <Text style={{ color: tokens.colors.mutedForeground, fontSize: 13 }}>
                Luźne betowanko
              </Text>
            </View>

            <DailyJackpotCard enabled={routeActive} />

            {error && <View style={{ marginHorizontal: 12, borderRadius: 12, backgroundColor: tokens.colors.secondary, padding: 10 }}><Text style={{ color: tokens.colors.foreground, fontSize: 12, textAlign: 'center' }}>Pokazujemy ostatnio zapisane dane. {error}</Text></View>}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }}>
              <CategoryPill
                category={null}
                selected={!selectedCategory}
                onPress={() => selectCategory(null)}
              />
              {categories.map((category) => (
                <CategoryPill
                  key={category.id}
                  category={category}
                  selected={selectedCategory === category.id}
                  onPress={() => selectCategory(category.id)}
                />
              ))}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 12 }}>
              <Pressable
                accessibilityRole="button"
                onPress={cycleSort}
                style={{
                  minHeight: 42,
                  flex: 1,
                  justifyContent: 'center',
                  borderRadius: 12,
                  backgroundColor: tokens.colors.cardStrong,
                  paddingHorizontal: 12,
                }}>
                <Text style={{ color: tokens.colors.foreground, fontSize: 12, fontWeight: '700' }}>
                  Sortowanie: {sort === 'newest' ? 'Najnowsze' : sort === 'ending_soon' ? 'Kończące się' : 'Popularne'}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: includeInProgress }}
                onPress={toggleInProgress}
                style={{
                  minHeight: 42,
                  justifyContent: 'center',
                  borderRadius: 12,
                  backgroundColor: includeInProgress ? tokens.colors.secondary : tokens.colors.cardStrong,
                  paddingHorizontal: 12,
                }}>
                <Text style={{ color: includeInProgress ? tokens.colors.primary : tokens.colors.foreground, fontSize: 12, fontWeight: '700' }}>
                  W toku
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Zaproponuj zakład"
                onPress={() => setProposalOpen(true)}
                style={{
                  minHeight: 42,
                  justifyContent: 'center',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: tokens.colors.primary,
                  paddingHorizontal: 12,
                }}>
                <Text style={{ color: tokens.colors.primary, fontSize: 12, fontWeight: '800' }}>
                  + Propozycja
                </Text>
              </Pressable>
            </View>
          </View>
        }
        ListEmptyComponent={
          loading || categoriesLoading ? (
            <ActivityIndicator color={tokens.colors.primary} style={{ padding: 40 }} />
          ) : (
            <View style={{ alignItems: 'center', gap: 8, padding: 40 }}>
              <Text style={{ color: tokens.colors.foreground, fontSize: 17, fontWeight: '800' }}>
                Brak aktywnych zakładów
              </Text>
              <Text style={{ color: tokens.colors.mutedForeground, textAlign: 'center' }}>
                Wybierz inną kategorię albo sprawdź ponownie później.
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          loadingMore ? <ActivityIndicator color={tokens.colors.primary} style={{ padding: 20 }} /> : null
        }
        onEndReached={() => {
          if (hasMore) void loadMore();
        }}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            tintColor={tokens.colors.primary}
            onRefresh={refresh}
          />
        }
      />

      {items.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Otwórz kupon, ${items.length} pozycji`}
          onPress={() => router.push('/coupon')}
          style={({ pressed }) => ({
            position: 'absolute',
            left: 14,
            right: 14,
            bottom: 92,
            minHeight: 58,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderRadius: 18,
            borderCurve: 'continuous',
            backgroundColor: tokens.colors.primary,
            paddingHorizontal: 18,
            opacity: pressed ? 0.82 : 1,
            boxShadow: '0 12px 30px rgba(255,10,84,0.34)',
          })}>
          <Text style={{ color: tokens.colors.primaryForeground, fontSize: 15, fontWeight: '900' }}>
            Kupon · {items.length}
          </Text>
          <Text
            selectable
            style={{ color: tokens.colors.primaryForeground, fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
            Kurs {totalOdds.toFixed(2)}
          </Text>
        </Pressable>
      ) : null}
      <ProposeBetModal
        visible={proposalOpen}
        categories={categories}
        onClose={() => setProposalOpen(false)}
      />
    </View>
  );
}
