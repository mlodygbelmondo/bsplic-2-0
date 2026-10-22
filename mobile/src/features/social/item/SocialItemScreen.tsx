import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useUserId } from '@/features/auth/auth-store';
import { useBootHold } from '@/features/boot/boot-store';
import { AppHeader } from '@/features/shell/AppHeader';
import { whenOnline } from '@/lib/connectivity';
import { getErrorMessage } from '@/lib/errors';
import { useScreenActive } from '@/lib/focus';
import { useMinuteClockTicker } from '@/lib/minute-clock';
import { toast } from '@/lib/toast';
import { createStyles } from '@/theme';
import type { FeedItemType } from '@/types/database';
import { Text } from '@/ui';
import { getCachedFeedItem, reloadComments } from '../api/cache';
import { socialItemQuery } from '../api/queries';
import { SocialFeedCard } from '../components/SocialFeedCard';
import { social } from '../components/socialColors';
import { Spinner } from '../components/Spinner';
import { isFeedItemType } from '../lib/routes';

/**
 * `/social/:itemType/:itemId` (web `SocialItemPage`): one feed card with its
 * comments open. Seeded from the feed on press-in, refreshed in the
 * background; pull to refresh re-reads the item and its comments.
 */
const NOT_FOUND_BODY = 'Ten wpis mógł zostać usunięty albo nie masz do niego dostępu.';

export function SocialItemScreen() {
  const styles = useStyles();
  const params = useLocalSearchParams<{ itemType?: string; itemId?: string }>();
  const itemType = isFeedItemType(params.itemType) ? params.itemType : null;
  const itemId = params.itemId ?? null;

  return (
    <View style={styles.page}>
      <AppHeader back />
      {itemType && itemId ? <SocialItemBody itemType={itemType} itemId={itemId} /> : <ItemScroll state={<Message title="Nie znaleziono wpisu" body={NOT_FOUND_BODY} />} />}
    </View>
  );
}

function SocialItemBody({ itemType, itemId }: { itemType: FeedItemType; itemId: string }) {
  const userId = useUserId();
  useMinuteClockTicker(useScreenActive());
  // Show the cached feed copy at once (notification taps, deep links) while the item loads.
  const query = useQuery({
    ...socialItemQuery(itemType, itemId, userId),
    placeholderData: () => getCachedFeedItem(userId, itemType, itemId),
  });
  const [refreshing, setRefreshing] = useState(false);
  const paused = query.isPending && query.fetchStatus === 'paused';
  useBootHold(query.isPending && !paused);

  useEffect(() => {
    if (query.error) toast.error(getErrorMessage(query.error, 'Nie udało się załadować wpisu'));
  }, [query.error]);

  const refresh = () => {
    setRefreshing(true);
    return Promise.all([query.refetch(), reloadComments(itemType, itemId)]).finally(() => setRefreshing(false));
  };

  // Placeholder data only covers the first load: after a failed one, keep showing the cached copy.
  const item = query.data ?? (query.isError ? getCachedFeedItem(userId, itemType, itemId) : undefined);
  let state;
  if (item) state = <SocialFeedCard item={item} currentUserId={userId} detail />;
  else if (paused) state = <Message title="Brak połączenia" body="Wczytamy wpis, gdy wrócisz online." />;
  else if (query.isPending) state = <Loading />;
  else if (query.isError) {
    state = (
      <Message
        title="Nie udało się wczytać wpisu"
        body="Sprawdź połączenie i spróbuj ponownie."
        onRetry={() => void query.refetch()}
      />
    );
  } else {
    state = <Message title="Nie znaleziono wpisu" body={NOT_FOUND_BODY} />;
  }

  return <ItemScroll state={state} refreshing={refreshing} onRefresh={query.isPending ? undefined : () => void refresh()} />;
}

function ItemScroll({
  state,
  refreshing = false,
  onRefresh,
}: {
  state: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAwareScrollView
      bottomOffset={16}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.content, { paddingBottom: 12 + insets.bottom }]}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={whenOnline(onRefresh)} tintColor={social.mutedForeground} /> : undefined
      }
    >
      <Pressable
        accessibilityRole="link"
        hitSlop={8}
        // Pops back to the tabs; a navigate would push a second copy of them.
        onPress={() => router.dismissTo('/social')}
        style={styles.back}
      >
        {({ pressed }) => (
          <>
            <ChevronLeft size={16} color={pressed ? social.foreground : social.mutedForeground} />
            <Text style={[styles.backText, pressed && styles.backTextPressed]}>Social</Text>
          </>
        )}
      </Pressable>
      {state}
    </KeyboardAwareScrollView>
  );
}

function Loading() {
  const styles = useStyles();
  return (
    <View style={styles.loading}>
      <Spinner size={16} color={social.mutedForeground} />
      <Text style={styles.loadingText}>Ładowanie wpisu...</Text>
    </View>
  );
}

function Message({ title, body, onRetry }: { title: string; body: string; onRetry?: () => void }) {
  const styles = useStyles();
  return (
    <View style={styles.notFound}>
      <Text style={styles.notFoundTitle}>{title}</Text>
      <Text style={styles.notFoundBody}>{body}</Text>
      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          onPress={whenOnline(onRetry)}
          style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}
        >
          <Text style={styles.retryText}>Spróbuj ponownie</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = createStyles(() => ({
  // `.social-mobile-page`: flat phone Social background in both themes.
  page: { flex: 1, backgroundColor: social.background },
  // `.social-facebook-feed px-0 pt-2`.
  content: { paddingTop: 8 },
  // `mb-3 inline-flex items-center gap-1 px-3 text-sm font-medium text-muted-foreground`.
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginBottom: 12, paddingHorizontal: 12 },
  backText: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: social.mutedForeground },
  backTextPressed: { color: social.foreground },
  // `flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground`.
  loading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 64 },
  loadingText: { fontSize: 14, lineHeight: 20, color: social.mutedForeground },
  // `mx-3 rounded-xl border border-border bg-card p-8 text-center`.
  notFound: {
    marginHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: social.border,
    backgroundColor: social.card,
    padding: 32,
    alignItems: 'center',
  },
  notFoundTitle: { textAlign: 'center', fontSize: 18, lineHeight: 28, fontWeight: '600', color: social.foreground },
  notFoundBody: { marginTop: 4, textAlign: 'center', fontSize: 14, lineHeight: 20, color: social.mutedForeground },
  retry: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: social.border,
  },
  retryPressed: { backgroundColor: social.background },
  retryText: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: social.foreground },
}));
