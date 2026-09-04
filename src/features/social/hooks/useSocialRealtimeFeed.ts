import { useEffect, useRef } from 'react';

import { supabase } from '@/integrations/supabase/client';
import type { FeedItemType, SocialFeedItem } from '@/types/database';

interface RealtimeRow {
  target_type?: unknown;
  target_id?: unknown;
  source_table?: unknown;
  operation?: unknown;
}

interface SocialRealtimePayload {
  eventType: string;
  new: RealtimeRow;
  old: RealtimeRow;
}

interface FeedTarget {
  itemType: FeedItemType;
  itemId: string;
  sourceTable: string;
  operation: string;
}

interface UseSocialRealtimeFeedParams {
  feedItems: SocialFeedItem[];
  commentsLoadedMap: Record<string, boolean>;
  refreshFeedItem: (
    itemType: FeedItemType,
    itemId: string,
    options?: { allowInsert?: boolean },
  ) => void | Promise<void>;
  loadComments: (
    itemId: string,
    itemType: FeedItemType,
  ) => void | Promise<void>;
}

function getStringValue(row: RealtimeRow, key: keyof RealtimeRow) {
  const value = row[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function getChangedRow(payload: SocialRealtimePayload) {
  return payload.eventType === 'DELETE' ? payload.old : payload.new;
}

function getFeedTargetFromRealtimeEvent(row: RealtimeRow): FeedTarget | null {
  const targetType = getStringValue(row, 'target_type');
  const targetId = getStringValue(row, 'target_id');
  const sourceTable = getStringValue(row, 'source_table');
  const operation = getStringValue(row, 'operation');

  if (
    !targetId ||
    !sourceTable ||
    !operation ||
    (targetType !== 'post' &&
      targetType !== 'coupon' &&
      targetType !== 'casino')
  ) {
    return null;
  }

  return { itemType: targetType, itemId: targetId, sourceTable, operation };
}

export function useSocialRealtimeFeed({
  feedItems,
  commentsLoadedMap,
  refreshFeedItem,
  loadComments,
}: UseSocialRealtimeFeedParams) {
  const commentsLoadedMapRef = useRef(commentsLoadedMap);
  const feedItemsRef = useRef(feedItems);

  useEffect(() => {
    commentsLoadedMapRef.current = commentsLoadedMap;
  }, [commentsLoadedMap]);

  useEffect(() => {
    feedItemsRef.current = feedItems;
  }, [feedItems]);

  useEffect(() => {
    // A single action can emit several events for the same feed item.
    // Merge them before reading, and never overlap reads for that item.
    const pending = new Map<
      string,
      {
        itemType: FeedItemType;
        itemId: string;
        allowInsert: boolean;
        refreshItem: boolean;
        refreshComments: boolean;
      }
    >();
    const inFlight = new Set<string>();
    let timeoutId: number | undefined;
    let disposed = false;

    const scheduleFlush = () => {
      if (disposed || timeoutId !== undefined) return;
      timeoutId = window.setTimeout(flush, 250);
    };

    const flush = () => {
      timeoutId = undefined;
      for (const [key, target] of pending) {
        if (inFlight.has(key)) continue;
        pending.delete(key);
        inFlight.add(key);
        const reads: Array<() => void | Promise<void>> = [];
        if (target.refreshItem) {
          reads.push(() =>
            refreshFeedItem(target.itemType, target.itemId, {
              allowInsert: target.allowInsert,
            }),
          );
        }
        if (
          target.refreshComments &&
          commentsLoadedMapRef.current[target.itemId]
        ) {
          reads.push(() => loadComments(target.itemId, target.itemType));
        }
        void Promise.allSettled(
          reads.map((read) => Promise.resolve().then(read)),
        ).then((results) => {
          for (const result of results) {
            if (result.status === 'rejected') {
              console.error('Social realtime refresh failed:', result.reason);
            }
          }
          inFlight.delete(key);
          if (pending.has(key)) scheduleFlush();
        });
      }
    };

    const refreshSocialTarget = (payload: SocialRealtimePayload) => {
      if (disposed) return;
      const row = getChangedRow(payload);
      const target = getFeedTargetFromRealtimeEvent(row);
      if (!target) return;

      const isLoaded = feedItemsRef.current.some(
        (item) =>
          item.id === target.itemId && item.item_type === target.itemType,
      );
      const isFeedItemInsert =
        target.operation === 'INSERT' &&
        (target.sourceTable === 'social_posts' ||
          target.sourceTable === 'casino_social_shares' ||
          target.sourceTable === 'coupons');

      const refreshComments = Boolean(
        (target.sourceTable === 'social_comments' ||
          target.sourceTable === 'social_reactions') &&
        commentsLoadedMapRef.current[target.itemId],
      );
      if (!isLoaded && !isFeedItemInsert && !refreshComments) return;

      const key = `${target.itemType}:${target.itemId}`;
      const previous = pending.get(key);
      pending.set(key, {
        itemType: target.itemType,
        itemId: target.itemId,
        allowInsert: isFeedItemInsert || (previous?.allowInsert ?? false),
        refreshItem:
          isLoaded || isFeedItemInsert || (previous?.refreshItem ?? false),
        refreshComments:
          refreshComments || (previous?.refreshComments ?? false),
      });
      scheduleFlush();
    };

    const channel = supabase
      .channel('social-feed-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'social_realtime_events',
        },
        (payload) => refreshSocialTarget(payload as SocialRealtimePayload),
      )
      .subscribe();

    return () => {
      disposed = true;
      window.clearTimeout(timeoutId);
      pending.clear();
      supabase.removeChannel(channel);
    };
  }, [loadComments, refreshFeedItem]);
}
