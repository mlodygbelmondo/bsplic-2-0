import { FlashList, type FlashListRef, type ViewToken } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowUp } from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { Pressable, RefreshControl, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from 'zustand';

import { useProfile, useUserId } from '@/features/auth/auth-store';
import { AppHeader } from '@/features/shell/AppHeader';
import { getErrorMessage } from '@/lib/errors';
import { useHasBeenFocused } from '@/lib/focus';
import { haptics } from '@/lib/haptics';
import { toast } from '@/lib/toast';
import { createStyles } from '@/theme';
import type { SocialFeedItem } from '@/types/database';
import { PressScale, SectionLoader, Text } from '@/ui';
import { publishPost, publishStory } from '../api/actions';
import { socialStoriesQuery } from '../api/queries';
import { PostComposer } from '../compose/PostComposer';
import { useSocialFeed } from '../hooks/useSocialFeed';
import { useSocialRealtimeFeed } from '../hooks/useSocialRealtimeFeed';
import { FILTER_EMPTY_TITLES, getStoryProfiles, parseFeedFilter, type FeedFilter } from '../lib/feedList';
import { getFeedItemKey } from '../lib/routes';
import { getNextScrollChromeState, type ScrollChromeState } from '@/lib/scroll-chrome';
import { SocialStories } from '../stories/SocialStories';
import { createFeedChromeStore, patchFeedChrome, type FeedChromeStore } from './feedChrome';
import { createFeedVisibilityStore, FeedVisibilityContext } from './feedVisibility';
import { FeedFilterBar, FILTER_BAR_HEIGHT } from './FeedFilterBar';
import { SocialFeedCard } from './SocialFeedCard';
import { social } from './socialColors';
import { Spinner } from './Spinner';

/** Web `showBackToTop`: shown past 600 px of scrolling. */
const BACK_TO_TOP_OFFSET = 600;
/** Near the top new items scroll into view by themselves (no pill). */
const TOP_ZONE = 32;
/** Web loads more about 1200 px before the end; roughly 1.5 screens. */
const END_REACHED_THRESHOLD = 1.5;
const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 10, minimumViewTime: 150 };
const MAINTAIN_POSITION = { autoscrollToTopThreshold: TOP_ZONE };

/** Port of the web `SocialPage` at phone size (`/social`). */
export function SocialScreen() {
  const styles = useStyles();
  const focused = useHasBeenFocused();
  return (
    <View style={styles.page}>
      <AppHeader />
      {focused ? <SocialFeedBody /> : null}
    </View>
  );
}

function SocialFeedBody() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const userId = useUserId();
  const profile = useProfile();
  const filter = parseFeedFilter(useLocalSearchParams<{ filter?: string }>().filter);
  const feed = useSocialFeed(userId, filter);
  const storiesQuery = useQuery(socialStoriesQuery());
  const [chrome] = useState(createFeedChromeStore);
  const [visibility] = useState(createFeedVisibilityStore);
  const listRef = useRef<FlashListRef<SocialFeedItem>>(null);
  const scrollYRef = useRef(0);
  const chromeStateRef = useRef<ScrollChromeState | undefined>(undefined);

  useSocialRealtimeFeed(userId, () => {
    if (scrollYRef.current > TOP_ZONE) patchFeedChrome(chrome, { newItems: true });
  });

  useEffect(() => {
    if (storiesQuery.error) toast.error(getErrorMessage(storiesQuery.error, 'Nie udało się wczytać relacji'));
  }, [storiesQuery.error]);

  const setFilter = (next: FeedFilter) => {
    router.setParams({ filter: next === 'all' ? undefined : next });
  };

  const scrollToTop = () => {
    patchFeedChrome(chrome, { newItems: false });
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const y = contentOffset.y;
    scrollYRef.current = y;
    const next = getNextScrollChromeState(chromeStateRef.current, {
      scrollTop: y,
      scrollHeight: contentSize.height,
      clientHeight: layoutMeasurement.height,
    });
    chromeStateRef.current = next;
    patchFeedChrome(chrome, {
      filterHidden: next.hidden,
      backToTop: y > BACK_TO_TOP_OFFSET,
      ...(y <= TOP_ZONE ? { newItems: false } : null),
    });
  };

  const handleViewableItemsChanged = ({ viewableItems }: { viewableItems: ViewToken<SocialFeedItem>[] }) => {
    visibility.setVisible(viewableItems.map((token) => token.key));
  };

  const items = feed.items ?? [];
  const filteredItems = feed.filteredItems ?? [];
  const filteredEmpty = filter !== 'all' && items.length > 0 && filteredItems.length === 0;

  const header = (
    <View>
      <View style={styles.filterSpacer} />
      {userId ? (
        <>
          <PostComposer
            onSubmit={publishPost}
            currentUserId={userId}
            currentUsername={profile?.username ?? undefined}
            currentUserAvatarUrl={profile?.avatar_url}
          />
          <SocialStories
            stories={storiesQuery.data ?? []}
            profileFallbacks={getStoryProfiles(items)}
            currentUsername={profile?.username ?? 'Ty'}
            currentAvatarUrl={profile?.avatar_url ?? null}
            onCreateStory={publishStory}
          />
        </>
      ) : null}
    </View>
  );

  let empty: ReactElement | null = null;
  if (feed.isPending) {
    empty = <SectionLoader label="Wczytywanie aktywności..." />;
  } else if (feed.error && !feed.items) {
    empty = (
      <FeedMessage
        title="Nie udało się wczytać aktywności"
        description="Sprawdź połączenie i spróbuj ponownie."
        actionLabel="Spróbuj ponownie"
        onAction={feed.retry}
      />
    );
  } else if (!feed.hasMore) {
    empty = filteredEmpty ? (
      <FeedMessage
        title={FILTER_EMPTY_TITLES[filter as Exclude<FeedFilter, 'all'>]}
        description="Zmień filtr, aby zobaczyć pozostałe wpisy."
        actionLabel="Pokaż wszystko"
        onAction={() => setFilter('all')}
      />
    ) : (
      <FeedMessage title="Brak aktywności" description="Nikt jeszcze nic nie opublikował." />
    );
  }

  const footer = (
    <>
      {filteredItems.length === 0 && feed.hasMore && !feed.isPending ? (
        <Text style={styles.searching}>Szukamy kolejnych wpisów...</Text>
      ) : null}
      {feed.loadingMore ? (
        <View style={styles.loadingMore}>
          <Spinner size={14} color={social.mutedForeground} />
          <Text style={styles.loadingMoreText}>Ładowanie kolejnych wpisów...</Text>
        </View>
      ) : null}
    </>
  );

  return (
    <View style={styles.body}>
      <FeedVisibilityContext value={visibility}>
        <FlashList
          ref={listRef}
          data={filteredItems}
          keyExtractor={getFeedItemKey}
          getItemType={(item) => item.item_type}
          renderItem={({ item, index }) => <SocialFeedCard item={item} currentUserId={userId} spaced={index > 0} />}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          ListFooterComponent={footer}
          onEndReached={feed.loadMore}
          onEndReachedThreshold={END_REACHED_THRESHOLD}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onViewableItemsChanged={handleViewableItemsChanged}
          viewabilityConfig={VIEWABILITY_CONFIG}
          maintainVisibleContentPosition={MAINTAIN_POSITION}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={feed.refreshing}
              onRefresh={feed.refresh}
              tintColor={social.mutedForeground}
              progressViewOffset={FILTER_BAR_HEIGHT}
            />
          }
        />
      </FeedVisibilityContext>
      <FeedFilterBar filter={filter} onChange={setFilter} chrome={chrome} />
      <NewItemsPill chrome={chrome} onPress={scrollToTop} />
      <BackToTopButton chrome={chrome} bottom={insets.bottom + 20} onPress={scrollToTop} />
    </View>
  );
}

/** Web empty block: `text-center py-12 text-muted-foreground`, `text-lg font-medium` + `text-sm mt-1`. */
function FeedMessage({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.message}>
      <Text style={styles.messageTitle}>{title}</Text>
      <Text style={styles.messageDescription}>{description}</Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [styles.messageAction, pressed && styles.messageActionPressed]}
        >
          <Text style={styles.messageActionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Shown when realtime adds items above the viewport; scrolls back to the top. */
function NewItemsPill({ chrome, onPress }: { chrome: FeedChromeStore; onPress: () => void }) {
  const styles = useStyles();
  const visible = useStore(chrome, (state) => state.newItems);
  if (!visible) return null;
  return (
    <View pointerEvents="box-none" style={styles.pillAnchor}>
      <PressScale
        accessibilityRole="button"
        accessibilityLabel="Nowe wpisy, wróć na górę"
        onPress={() => {
          haptics.selection();
          onPress();
        }}
        style={styles.pill}
      >
        <ArrowUp size={16} color={social.primaryForeground} />
        <Text style={styles.pillText}>Nowe wpisy</Text>
      </PressScale>
    </View>
  );
}

/** Web back-to-top: `h-11 w-11 rounded-full border bg-card shadow-xl`, `ArrowUp h-5 w-5`. */
function BackToTopButton({ chrome, bottom, onPress }: { chrome: FeedChromeStore; bottom: number; onPress: () => void }) {
  const styles = useStyles();
  const visible = useStore(chrome, (state) => state.backToTop);
  if (!visible) return null;
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel="Wróć na górę"
      onPress={onPress}
      style={[styles.backToTop, { bottom }]}
    >
      <ArrowUp size={20} color={social.foreground} />
    </PressScale>
  );
}

const useStyles = createStyles(() => ({
  // `.social-mobile-page`: flat `hsl(210 17% 95%)` page, no aurora, in both themes.
  page: { flex: 1, backgroundColor: social.background },
  body: { flex: 1, overflow: 'hidden' },
  filterSpacer: { height: FILTER_BAR_HEIGHT },
  // `pb-3` on the feed content.
  content: { paddingBottom: 12 },
  searching: { paddingVertical: 24, textAlign: 'center', fontSize: 12, lineHeight: 16, color: social.mutedForeground },
  loadingMore: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 8 },
  loadingMoreText: { fontSize: 12, lineHeight: 16, color: social.mutedForeground },
  message: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 16 },
  messageTitle: { fontSize: 18, lineHeight: 28, fontWeight: '500', color: social.mutedForeground, textAlign: 'center' },
  messageDescription: { marginTop: 4, fontSize: 14, lineHeight: 20, color: social.mutedForeground, textAlign: 'center' },
  // `mt-4 rounded-full border border-border px-4 py-1.5 text-xs font-semibold text-foreground`.
  messageAction: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: social.border,
  },
  messageActionPressed: { backgroundColor: social.muted },
  messageActionText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: social.foreground },
  pillAnchor: { position: 'absolute', top: FILTER_BAR_HEIGHT + 8, left: 0, right: 0, alignItems: 'center', zIndex: 30 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: social.primary,
    boxShadow: '0px 10px 15px -3px rgba(0, 0, 0, 0.1), 0px 4px 6px -4px rgba(0, 0, 0, 0.1)',
  },
  pillText: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: social.primaryForeground },
  backToTop: {
    position: 'absolute',
    right: 16,
    zIndex: 40,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: social.border,
    backgroundColor: social.card,
    boxShadow: '0px 20px 25px -5px rgba(0, 0, 0, 0.1), 0px 8px 10px -6px rgba(0, 0, 0, 0.1)',
  },
}));
