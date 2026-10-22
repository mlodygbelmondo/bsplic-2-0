import { useEffect, useRef } from 'react';

import { useRealtimeChannel } from '@/lib/realtime';
import {
  areCommentsShown,
  isFeedItemLoaded,
  mergeFeedItem,
  refreshFeedPages,
  reloadComments,
  removeFeedItem,
} from '../api/cache';
import { fetchSocialFeedItem } from '../api/social';
import { createRealtimeCoalescer, type RealtimeCoalescer, type SocialRealtimeRow } from '../lib/realtimeCoalescer';

/**
 * Realtime feed updates (web `useSocialRealtimeFeed`): `social_realtime_events`
 * inserts refresh, insert or remove feed items and reload open comment threads.
 * `onItemsPrepended` fires when new items land at the top of the feed.
 */
export function useSocialRealtimeFeed(userId: string | null, onItemsPrepended: () => void) {
  const coalescerRef = useRef<RealtimeCoalescer | null>(null);
  const onPrependedRef = useRef(onItemsPrepended);
  const subscribedOnceRef = useRef(false);

  useEffect(() => {
    onPrependedRef.current = onItemsPrepended;
  });

  useEffect(() => {
    const coalescer = createRealtimeCoalescer({
      isLoaded: (itemType, itemId) => isFeedItemLoaded(userId, itemType, itemId),
      areCommentsLoaded: areCommentsShown,
      refreshItem: async (itemType, itemId, { allowInsert }) => {
        const wasLoaded = isFeedItemLoaded(userId, itemType, itemId);
        const item = await fetchSocialFeedItem(itemType, itemId, userId);
        if (!item) {
          removeFeedItem(itemType, itemId);
          return;
        }
        mergeFeedItem(userId, item, allowInsert);
        if (allowInsert && !wasLoaded) onPrependedRef.current();
      },
      reloadComments,
    });
    coalescerRef.current = coalescer;
    return () => {
      coalescer.dispose();
      coalescerRef.current = null;
    };
  }, [userId]);

  useRealtimeChannel(
    'social-feed-realtime',
    (channel) =>
      channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'social_realtime_events' },
        (payload) => coalescerRef.current?.push(payload.new as SocialRealtimeRow),
      ),
    {
      enabled: userId !== null,
      onSubscribed: () => {
        // The first subscription follows the feed's own mount refresh; later ones
        // (back from another tab or the background) catch up on missed events.
        if (!subscribedOnceRef.current) {
          subscribedOnceRef.current = true;
          return;
        }
        refreshFeedPages(userId)
          .then((added) => {
            if (added > 0) onPrependedRef.current();
          })
          .catch((error: unknown) => console.error('Social realtime refresh failed:', error));
      },
    },
  );
}
