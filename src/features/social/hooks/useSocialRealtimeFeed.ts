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
    (targetType !== 'post' && targetType !== 'coupon' && targetType !== 'casino')
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
    const refreshSocialTarget = (payload: SocialRealtimePayload) => {
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

      if (isLoaded || isFeedItemInsert) {
        void refreshFeedItem(target.itemType, target.itemId, {
          allowInsert: isFeedItemInsert,
        });
      }

      if (
        (target.sourceTable === 'social_comments' ||
          target.sourceTable === 'social_reactions') &&
        commentsLoadedMapRef.current[target.itemId]
      ) {
        void loadComments(target.itemId, target.itemType);
      }
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
      supabase.removeChannel(channel);
    };
  }, [loadComments, refreshFeedItem]);
}
