import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ArrowLeft, RefreshCw } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore, useUserId } from '@/features/auth/auth-store';
import { useBootHold } from '@/features/boot/boot-store';
import { AppHeader } from '@/features/shell/AppHeader';
import { haptics } from '@/lib/haptics';
import { alpha, createStyles, useTheme } from '@/theme';
import { Button, ScreenBackground, Surface, Text } from '@/ui';
import { replayHistoryQuery } from './api/replay-history';
import { buildReplay, PERIOD_LABELS, type ReplayPeriod } from './model';
import { replayTone } from './replay-colors';
import { ReplayShare } from './ReplayShare';
import { ReplaySummary } from './ReplaySummary';

const PERIODS: ReplayPeriod[] = ['7', '30', 'all'];

function goToProfile() {
  if (router.canGoBack()) router.back();
  else router.replace('/profile');
}

/** `/replay`: read-only sportsbook summary of the signed-in user (web `ReplayPage`). */
export function ReplayScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const userId = useUserId();
  const username = useAuthStore((state) => state.profile?.username) ?? 'Gracz';
  const [period, setPeriod] = useState<ReplayPeriod>('30');
  const [pulling, setPulling] = useState(false);
  const history = useQuery(replayHistoryQuery(userId));
  // Periods filter one snapshot locally; they never issue another request. The
  // poster export keys on this object's identity, so keep it explicitly stable.
  const model = useMemo(() => (history.data ? buildReplay(history.data, period) : null), [history.data, period]);
  // Offline without a cached snapshot the query pauses; show the web's failure state, not an endless loader.
  const failed = history.isError || (!model && history.fetchStatus === 'paused');
  const loading = !model && history.isPending && !failed;
  useBootHold(loading);

  const refresh = () => void history.refetch();
  const onPull = () => {
    setPulling(true);
    void history.refetch().finally(() => setPulling(false));
  };

  return (
    <ScreenBackground>
      <AppHeader />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        accessibilityLabel="Replay"
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void onPull()} tintColor={colors.mutedForeground} />}
      >
        <View style={styles.header}>
          <View style={styles.headerTitle}>
            <Button
              variant="ghost"
              size="icon"
              style={styles.iconButton}
              accessibilityLabel="Do profilu"
              icon={<ArrowLeft size={16} color={colors.foreground} />}
              onPress={goToProfile}
            />
            <Text size="2xl" weight="700" style={styles.title} accessibilityRole="header">Replay</Text>
          </View>
          <View style={styles.headerActions}>
            <Button
              variant="ghost"
              size="icon"
              style={styles.iconButton}
              accessibilityLabel="Odśwież Replay"
              disabled={history.isFetching}
              icon={<RefreshCw size={16} color={colors.foreground} />}
              onPress={refresh}
            />
            {model && model.coupons.length > 0 ? <ReplayShare key={userId} model={model} username={username} /> : null}
          </View>
        </View>

        <View style={styles.periodRow}>
          <Surface variant="sub" style={styles.periods} accessibilityLabel="Zakres Replay">
            {PERIODS.map((value) => {
              const selected = period === value;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    if (!selected) haptics.selection();
                    setPeriod(value);
                  }}
                  style={[styles.period, selected && styles.periodSelected]}
                >
                  {({ pressed }) => (
                    <Text weight="600" style={selected ? styles.periodSelectedText : pressed ? undefined : styles.muted}>
                      {PERIOD_LABELS[value]}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </Surface>
          {model ? <Text style={styles.muted}>{model.rangeLabel}</Text> : null}
        </View>

        {model?.limited ? (
          <View style={styles.limited} accessibilityLiveRegion="polite">
            <Text>Zakres jest częściowy: pokazujemy najnowsze 200 kuponów.</Text>
          </View>
        ) : null}

        {failed ? (
          <View style={styles.error} accessibilityRole="alert">
            <Text>{model ? 'Nie udało się odświeżyć danych. Pokazujemy poprzedni zapis.' : 'Nie udało się wczytać Replay.'}</Text>
            <Button variant="outline" label="Spróbuj ponownie" disabled={history.isFetching} onPress={refresh} />
          </View>
        ) : null}

        {loading ? (
          <Surface variant="app" style={styles.loading} accessibilityRole="progressbar" accessibilityLabel="Wczytywanie Replay">
            <Text style={styles.muted}>Wczytywanie…</Text>
            <View style={styles.loadingNet} />
            <View style={styles.loadingChart} />
          </Surface>
        ) : null}

        {model ? (
          model.coupons.length > 0 ? (
            <ReplaySummary key={`${userId}-${period}`} model={model} />
          ) : (
            <Surface variant="app" style={styles.empty} accessibilityLabel="Pusty Replay">
              <Text size="lg" weight="600" align="center" accessibilityRole="header">Brak kuponów w tym okresie</Text>
              <View style={styles.emptyActions}>
                {period !== 'all' ? <Button variant="outline" label="Zobacz ostatnie kupony" onPress={() => setPeriod('all')} /> : null}
                <Button variant="ghost" label="Wróć do profilu" onPress={goToProfile} />
              </View>
            </Surface>
          )
        ) : null}
      </ScrollView>
    </ScreenBackground>
  );
}

const useStyles = createStyles((palette) => {
  const { colors, radius } = palette;
  return {
    scroll: { flex: 1 },
    content: { paddingHorizontal: 12, paddingTop: 16 },
    muted: { color: replayTone(palette).muted },
    header: { marginBottom: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0, flexShrink: 1 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    iconButton: { width: 44, height: 44 },
    title: { letterSpacing: -0.6 },
    periodRow: {
      marginBottom: 20,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      columnGap: 16,
      rowGap: 12,
    },
    periods: { flexDirection: 'row', padding: 4, borderRadius: radius.lg },
    period: { minHeight: 44, borderRadius: radius.md, paddingHorizontal: 12, justifyContent: 'center' },
    periodSelected: { backgroundColor: colors.foreground, boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)' },
    periodSelectedText: { color: colors.background },
    limited: {
      marginBottom: 16,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: alpha(colors.warning, 0.4),
      backgroundColor: alpha(colors.warning, 0.1),
      padding: 12,
    },
    error: {
      marginBottom: 16,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: alpha(colors.destructive, 0.4),
      backgroundColor: alpha(colors.destructive, 0.1),
      padding: 12,
    },
    loading: { borderRadius: 12, padding: 24 },
    loadingNet: { marginTop: 16, height: 48, width: 192, borderRadius: radius.lg, backgroundColor: colors.muted },
    loadingChart: { marginTop: 24, height: 192, borderRadius: radius.lg, backgroundColor: alpha(colors.muted, 0.5) },
    empty: { borderRadius: 12, paddingHorizontal: 20, paddingVertical: 48, alignItems: 'center' },
    emptyActions: { marginTop: 20, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  };
});
