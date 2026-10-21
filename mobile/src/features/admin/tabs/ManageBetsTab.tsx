import { FlashList } from '@shopify/flash-list';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, RefreshControl, View } from 'react-native';

import { categoriesQueryOptions } from '@/features/home/api/categories';
import { OFFLINE_WRITE_MESSAGE, useIsOffline } from '@/lib/connectivity';
import { getErrorMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { toast } from '@/lib/toast';
import { createStyles, useTheme } from '@/theme';
import type { Bet, Category } from '@/types/database';
import { SectionLoader, Text } from '@/ui';
import { deleteBet } from '../api/bets';
import { ADMIN_BETS_KEY, adminQueries } from '../api/queries';
import { settleBetWithBackend, type CorrectionScope, type SettlementMode } from '../api/settlement';
import { AdminPageHeader, useAdminChrome, useAdminContentBottomPadding } from '../components/AdminChrome';
import { fireConfetti } from '../components/Confetti';
import { Input } from '../components/form';
import { SelectField, type SelectOption } from '../components/SelectField';
import { BetCard } from '../manage/BetCard';
import { EditBetSheet, type SheetSession } from '../manage/EditBetSheet';
import { filterBets, PAGE_SIZE, type BetStatusFilter, type BetTypeFilter } from '../manage/filters';
import { PaginationBar } from '../manage/PaginationBar';
import { ResolveBetSheet } from '../manage/ResolveBetSheet';

const EMPTY_BETS: Bet[] = [];
const EMPTY_CATEGORIES: Category[] = [];

const STATUS_OPTIONS: SelectOption<BetStatusFilter>[] = [
  { value: 'all', label: 'Wszystkie statusy' },
  { value: 'active', label: 'Aktywne' },
  { value: 'resolved', label: 'Rozstrzygnięte' },
  { value: 'closed', label: 'Zamknięte' },
];

const TYPE_OPTIONS: SelectOption<BetTypeFilter>[] = [
  { value: 'all', label: 'Wszystkie typy' },
  { value: 'single', label: 'Single' },
  { value: '12', label: '1/2' },
  { value: '1x2', label: '1X2' },
  { value: 'multi', label: 'Multi' },
];

const nextSession = (previous: SheetSession | null, bet: Bet): SheetSession => ({
  bet,
  open: true,
  session: (previous?.session ?? 0) + 1,
});

const closeSession = (previous: SheetSession | null) => (previous ? { ...previous, open: false } : previous);

/**
 * Web `ManageBetsTab` at phone size: every bet loaded once and filtered on
 * the device (search, status, type), 15 cards per page, edit / settle /
 * refund / delete actions.
 */
export function ManageBetsTab() {
  const styles = useStyles();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const { onScroll } = useAdminChrome();
  const offline = useIsOffline();
  const paddingBottom = useAdminContentBottomPadding();

  const betsQuery = useQuery(adminQueries.bets());
  const categoriesQuery = useQuery(categoriesQueryOptions());
  const bets = betsQuery.data ?? EMPTY_BETS;
  const categories = categoriesQuery.data ?? EMPTY_CATEGORIES;
  const loading = betsQuery.isPending || categoriesQuery.isPending;
  const loadError = betsQuery.error ?? categoriesQuery.error;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<BetStatusFilter>('all');
  const [betTypeFilter, setBetTypeFilter] = useState<BetTypeFilter>('all');
  const [page, setPage] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const [editor, setEditor] = useState<SheetSession | null>(null);
  const [resolve, setResolve] = useState<SheetSession | null>(null);
  const [resolvingBetId, setResolvingBetId] = useState<string | null>(null);
  const [deletingBetId, setDeletingBetId] = useState<string | null>(null);
  const isResolveInProgress = Boolean(resolve?.open && resolvingBetId === resolve.bet.id);

  useEffect(() => {
    if (loadError) toast.error(getErrorMessage(loadError, 'Nie udało się pobrać zakładów'));
  }, [loadError]);

  const filtered = filterBets({ bets, search, status: statusFilter, betType: betTypeFilter });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paginated = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const showPagination = !loading && filtered.length > PAGE_SIZE;

  const refreshBets = () => queryClient.invalidateQueries({ queryKey: ADMIN_BETS_KEY });

  const pullToRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([betsQuery.refetch(), categoriesQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  const closeResolve = () => {
    if (isResolveInProgress) return;
    setResolve(closeSession);
  };

  const resolveBet = async (
    bet: Bet,
    winningOptionNames: string[],
    mode: SettlementMode = 'normal',
    scope: CorrectionScope = 'pending_only',
  ) => {
    if (offline) {
      toast.error(OFFLINE_WRITE_MESSAGE);
      return;
    }
    // One settlement at a time: a second request would share the in-progress flag.
    if (resolvingBetId) return;
    setResolvingBetId(bet.id);
    const isCorrection = Boolean(bet.winning_option);
    try {
      await settleBetWithBackend({ betId: bet.id, winningOptionNames, mode, scope });

      haptics.success();
      if (mode === 'refund') {
        toast.success(isCorrection ? 'Korekta zapisana jako zwrot' : 'Zakład rozliczony jako zwrot');
      } else if (mode === 'force_lost') {
        toast.success(
          isCorrection
            ? 'Korekta zapisana jako przegrana dla wszystkich'
            : 'Zakład rozliczony jako przegrany dla wszystkich',
        );
      } else {
        toast.success(isCorrection ? 'Korekta wyniku zapisana' : 'Wynik ogłoszony!');
        if (!isCorrection) fireConfetti();
      }
      setResolve(closeSession);
      void refreshBets();
    } catch (err: unknown) {
      haptics.error();
      toast.error(getErrorMessage(err, 'Nie udało się ogłosić wyniku'));
    } finally {
      setResolvingBetId(null);
    }
  };

  const performDelete = async (bet: Bet) => {
    setDeletingBetId(bet.id);
    try {
      await deleteBet(bet.id);
      if (editor?.bet.id === bet.id) setEditor(closeSession);
      if (resolve?.bet.id === bet.id) setResolve(closeSession);
      haptics.success();
      toast.success('Zakład usunięty');
      void refreshBets();
    } catch (err: unknown) {
      haptics.error();
      toast.error(getErrorMessage(err, 'Nie udało się usunąć zakładu'));
    } finally {
      setDeletingBetId(null);
    }
  };

  const confirmDelete = (bet: Bet) => {
    if (offline) {
      toast.error(OFFLINE_WRITE_MESSAGE);
      return;
    }
    haptics.warning();
    Alert.alert(`Czy na pewno chcesz usunąć zakład "${bet.title}"?`, undefined, [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Usuń', style: 'destructive', onPress: () => void performDelete(bet) },
    ]);
  };

  const openEditor = (bet: Bet) => setEditor((previous) => nextSession(previous, bet));
  const openResolve = (bet: Bet) => setResolve((previous) => nextSession(previous, bet));
  const refundBet = (bet: Bet) => void resolveBet(bet, [], 'refund');

  const header = (
    <View>
      <AdminPageHeader offlineNote />
      <View style={styles.filters}>
        <View style={styles.searchWrap}>
          <View pointerEvents="none" style={styles.searchIcon}>
            <Search size={16} color={colors.mutedForeground} />
          </View>
          <Input
            value={search}
            onChangeText={(value) => {
              setSearch(value);
              setPage(0);
            }}
            placeholder="Szukaj zakładów..."
            accessibilityLabel="Szukaj zakładów"
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
            style={styles.search}
          />
        </View>
        <SelectField
          value={statusFilter}
          options={STATUS_OPTIONS}
          placeholder="Status"
          accessibilityLabel="Status"
          onChange={(value) => {
            setStatusFilter(value);
            setPage(0);
          }}
          triggerStyle={styles.filterTrigger}
        />
        <SelectField
          value={betTypeFilter}
          options={TYPE_OPTIONS}
          placeholder="Typ zakładu"
          accessibilityLabel="Typ zakładu"
          onChange={(value) => {
            setBetTypeFilter(value);
            setPage(0);
          }}
          triggerStyle={styles.filterTrigger}
        />
      </View>
      {showPagination ? (
        <PaginationBar currentPage={safePage} totalPages={totalPages} onPageChange={setPage} style={styles.topPagination} />
      ) : null}
    </View>
  );

  return (
    <>
      <FlashList
        data={loading ? EMPTY_BETS : paginated}
        keyExtractor={(bet) => bet.id}
        extraData={`${resolvingBetId}|${deletingBetId}|${offline}`}
        renderItem={({ item }) => (
          <BetCard
            bet={item}
            resolving={resolvingBetId === item.id}
            deleting={deletingBetId === item.id}
            offline={offline}
            onEdit={openEditor}
            onResolve={openResolve}
            onRefund={refundBet}
            onDelete={confirmDelete}
          />
        )}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={header}
        ListEmptyComponent={
          loading ? (
            <SectionLoader label="Wczytywanie zakładów..." />
          ) : (
            <View style={styles.empty}>
              <Text size="base" color="mutedForeground" align="center">
                Brak zakładów
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          // Web: the card list keeps `pb-20`, then the bottom pagination (`mt-4`).
          <View style={styles.footer}>
            {showPagination ? (
              <PaginationBar
                currentPage={safePage}
                totalPages={totalPages}
                onPageChange={setPage}
                style={styles.bottomPagination}
              />
            ) : null}
          </View>
        }
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={pullToRefresh} tintColor={colors.mutedForeground} />
        }
        contentContainerStyle={{ padding: 16, paddingBottom }}
      />

      <EditBetSheet
        editor={editor}
        bets={bets}
        categories={categories}
        onClose={() => setEditor(closeSession)}
        onDismissed={() => setEditor((previous) => (previous?.open ? previous : null))}
        onSaved={() => {
          setEditor(closeSession);
          void refreshBets();
        }}
      />

      <ResolveBetSheet
        resolve={resolve}
        inProgress={isResolveInProgress}
        offline={offline}
        onClose={closeResolve}
        onDismissed={() => setResolve((previous) => (previous?.open ? previous : null))}
        onSettle={(bet, winners, mode, scope) => void resolveBet(bet, winners, mode, scope)}
      />
    </>
  );
}

function Separator() {
  return <View style={{ height: 16 }} />;
}

const useStyles = createStyles(({ colors }) => ({
  filters: { gap: 12, marginBottom: 24 },
  searchWrap: { height: 44 },
  searchIcon: { position: 'absolute', left: 14, top: 14, zIndex: 1 },
  search: {
    height: 44,
    paddingLeft: 40,
    borderRadius: 12,
    borderColor: colors.border,
    backgroundColor: colors.card,
    boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.25)',
  },
  filterTrigger: {
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.card,
    boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.25)',
  },
  topPagination: { marginBottom: 16 },
  bottomPagination: { marginTop: 16 },
  footer: { paddingTop: 80 },
  empty: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 32,
  },
}));
