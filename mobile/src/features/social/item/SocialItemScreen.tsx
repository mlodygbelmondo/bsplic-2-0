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
import { getErrorMessage } from '@/lib/errors';
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
export function SocialItemScreen() {
  const styles = useStyles();
  const params = useLocalSearchParams<{ itemType?: string; itemId?: string }>();
  const itemType = isFeedItemType(params.itemType) ? params.itemType : null;
  const itemId = params.itemId ?? null;

  return (
    <View style={styles.page}>
      <AppHeader back />
      {itemType && itemId ? <SocialItemBody itemType={itemType} itemId={itemId} /> : <ItemScroll state={<NotFound />} />}
    </View>
  );
}

function SocialItemBody({ itemType, itemId }: { itemType: FeedItemType; itemId: string }) {
  const userId = useUserId();
  // Show the cached feed copy at once (notification taps, deep links) while the item loads.
  const query = useQuery({
    ...socialItemQuery(itemType, itemId, userId),
    placeholderData: () => getCachedFeedItem(userId, itemType, itemId),
  });
  const [refreshing, setRefreshing] = useState(false);
  useBootHold(query.isPending);

  useEffect(() => {
    if (query.error) toast.error(getErrorMessage(query.error, 'Nie udało się załadować wpisu'));
  }, [query.error]);

  const refresh = () => {
    setRefreshing(true);
    return Promise.all([query.refetch(), reloadComments(itemType, itemId)]).finally(() => setRefreshing(false));
  };

  let state;
  if (query.isPending) state = <Loading />;
  else if (query.data) state = <SocialFeedCard item={query.data} currentUserId={userId} detail />;
  else state = <NotFound />;

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
        onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={social.mutedForeground} /> : undefined
      }
    >
      <Pressable
        accessibilityRole="link"
        hitSlop={8}
        onPress={() => router.navigate('/social')}
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

function NotFound() {
  const styles = useStyles();
  return (
    <View style={styles.notFound}>
      <Text style={styles.notFoundTitle}>Nie znaleziono wpisu</Text>
      <Text style={styles.notFoundBody}>Ten wpis mógł zostać usunięty albo nie masz do niego dostępu.</Text>
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
}));
