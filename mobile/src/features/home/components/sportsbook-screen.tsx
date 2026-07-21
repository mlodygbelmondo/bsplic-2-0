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
const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'newest', label: 'Najnowsze' },
  { value: 'popular', label: 'Popularne' },
  { value: 'ending_soon', label: 'Kończące się' },
];

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
  optionCount,
}: {
  bet: Bet;
  option: Bet['options'][number];
  optionCount: number;
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
      style={{
        width: optionCount === 1 ? '100%' : optionCount === 3 ? '31.6%' : '48.7%',
      }}>
      <View style={{ minHeight: 50, justifyContent: 'center', alignItems: 'center', gap: 2, borderRadius: 11, borderCurve: 'continuous', paddingHorizontal: 10, paddingVertical: 8, backgroundColor: selected ? tokens.colors.foreground : '#FFE14A' }}>
        <Text numberOfLines={1} style={{ color: selected ? '#FFE14A' : '#27220F', fontSize: 12, fontWeight: '700' }}>{option.name}</Text>
        <Text selectable style={{ color: selected ? '#FFE14A' : '#171405', fontSize: 16, fontWeight: '900', fontStyle: 'italic', fontVariant: ['tabular-nums'] }}>{option.odds.toFixed(2)}</Text>
      </View>
    </Pressable>
  );
}

function BetCard({ bet, category }: { bet: Bet; category?: Category }) {
  const { tokens } = useAppTheme();
  const closesAt = new Date(bet.ends_at);
  const closed = closesAt.getTime() <= Date.now();
  const probabilityDenominator = bet.options.reduce((sum, option) => {
    return Number.isFinite(option.odds) && option.odds > 0 ? sum + 1 / option.odds : sum;
  }, 0);

  return (
    <View
      style={{
        marginHorizontal: 12,
        marginBottom: 9,
        gap: 0,
        borderRadius: 14,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: bet.is_live ? tokens.colors.primary : tokens.colors.border,
        backgroundColor: tokens.colors.card,
        paddingHorizontal: 14,
        paddingTop: 10,
        paddingBottom: 11,
        boxShadow: '0 5px 16px rgba(0,0,0,0.22)',
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
        <Text numberOfLines={1} style={{ flex: 1, color: tokens.colors.mutedForeground, fontSize: 11, fontWeight: '600' }}>
          {category ? `${category.emoji} ${category.name}` : 'Zakład'}
        </Text>
        <Text style={{ color: tokens.colors.mutedForeground, fontSize: 10, fontWeight: '600' }}>
          ◉ {bet.bet_count}
        </Text>
      </View>

      <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 11, gap: 4 }}>
        <Text selectable style={{ color: tokens.colors.foreground, fontSize: 16, lineHeight: 20, fontWeight: '800', textAlign: 'center' }}>
          {bet.title}
        </Text>
        <Text selectable style={{ color: tokens.colors.mutedForeground, fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
          {closed ? 'Zamknięty' : closesAt.toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '')}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {bet.options.map((option) => (
          <BetOptionButton key={option.name} bet={bet} option={option} optionCount={bet.options.length} />
        ))}
      </View>

      <View style={{ flexDirection: 'row', height: 3, gap: 2, marginTop: 8, overflow: 'hidden', borderRadius: 999 }}>
        {bet.options.map((option, index) => (
          <View
            key={option.name}
            style={{
              flex: probabilityDenominator > 0 && option.odds > 0 ? 1 / option.odds / probabilityDenominator : 0,
              minWidth: 2,
              borderRadius: 999,
              backgroundColor: index % 3 === 0 ? tokens.colors.primary : index % 3 === 1 ? tokens.colors.mutedForeground : '#22A06B',
            }}
          />
        ))}
      </View>
    </View>
  );
}

function FilterOption({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { tokens } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        height: 42,
        justifyContent: 'center',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: selected ? tokens.colors.foreground : tokens.colors.border,
        backgroundColor: selected ? tokens.colors.foreground : tokens.colors.card,
        paddingHorizontal: 14,
      }}>
      <Text
        style={{
          color: selected ? tokens.colors.background : tokens.colors.foreground,
          fontSize: 13,
          fontWeight: selected ? '800' : '600',
        }}>
        {label}
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
  const [filterPanel, setFilterPanel] = useState<'sort' | 'category' | null>(null);
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

  const selectSort = (next: SortMode) => {
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
          <View style={{ gap: 10, paddingBottom: 10, zIndex: 20 }}>
            <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 8 }}>
              <View style={{ flex: 1 }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: filterPanel === 'sort' }}
                  onPress={() => setFilterPanel(current => current === 'sort' ? null : 'sort')}
                  style={{ height: 44, borderRadius: 999, borderWidth: 1, borderColor: tokens.colors.border, backgroundColor: tokens.colors.card, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text numberOfLines={1} style={{ color: tokens.colors.foreground, fontSize: 14, fontWeight: '700' }}>{includeInProgress ? '' : '●  '}{SORT_OPTIONS.find(option => option.value === sort)?.label}</Text>
                  <Text style={{ color: tokens.colors.mutedForeground, fontSize: 13 }}>⌄</Text>
                </Pressable>
              </View>

              <View style={{ flex: 1 }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: filterPanel === 'category' }}
                  onPress={() => setFilterPanel(current => current === 'category' ? null : 'category')}
                  style={{ height: 44, borderRadius: 999, borderWidth: 1, borderColor: tokens.colors.border, backgroundColor: tokens.colors.card, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text numberOfLines={1} style={{ flex: 1, color: tokens.colors.foreground, fontSize: 14, fontWeight: '700' }}>{selectedCategory && categoryMap[selectedCategory] ? `${categoryMap[selectedCategory].emoji} ${categoryMap[selectedCategory].name}` : '🌐 Wszystkie'}</Text>
                  <Text style={{ color: tokens.colors.mutedForeground, fontSize: 13 }}>⌄</Text>
                </Pressable>
              </View>
            </View>

            {filterPanel === 'sort' ? <View style={{ position: 'absolute', top: 60, left: 12, width: '47%', zIndex: 40, gap: 6 }}>
              {SORT_OPTIONS.map(option => <FilterOption key={option.value} label={option.label} selected={sort === option.value} onPress={() => { selectSort(option.value); setFilterPanel(null); }} />)}
              <FilterOption label="●  Aktywne" selected={!includeInProgress} onPress={toggleInProgress} />
              <Pressable onPress={() => { setFilterPanel(null); setProposalOpen(true); }} style={{ height: 42, borderRadius: 999, justifyContent: 'center', backgroundColor: tokens.colors.primary, paddingHorizontal: 14 }}><Text style={{ color: tokens.colors.primaryForeground, fontSize: 13, fontWeight: '800' }}>💡 Zaproponuj zakład</Text></Pressable>
            </View> : null}

            {filterPanel === 'category' ? <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={{ position: 'absolute', top: 60, right: 12, width: '47%', maxHeight: 440, zIndex: 40 }} contentContainerStyle={{ gap: 6 }}>
              <FilterOption label="🌐 Wszystkie" selected={!selectedCategory} onPress={() => { selectCategory(null); setFilterPanel(null); }} />
              {categories.map(category => <FilterOption key={category.id} label={`${category.emoji} ${category.name}`} selected={selectedCategory === category.id} onPress={() => { selectCategory(category.id); setFilterPanel(null); }} />)}
            </ScrollView> : null}

            <DailyJackpotCard enabled={routeActive} />

            {error && <View style={{ marginHorizontal: 12, borderRadius: 12, backgroundColor: tokens.colors.secondary, padding: 10 }}><Text style={{ color: tokens.colors.foreground, fontSize: 12, textAlign: 'center' }}>Pokazujemy ostatnio zapisane dane. {error}</Text></View>}

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
          style={{
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
            boxShadow: '0 12px 30px rgba(255,10,84,0.34)',
          }}>
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
