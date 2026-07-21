import { useEffect, useRef } from 'react';

import { supabase } from '@/integrations/supabase/client';
import type { FeedItemType, SocialFeedItem } from '@/types/database';

interface RealtimeRow {
  target_type?: unknown;
  target_id?: unknown;
  source_table?: unknown;
  operation?: unknown;
}

interface Props {
  enabled: boolean;
  feedItems: SocialFeedItem[];
  commentsLoaded: Record<string, boolean>;
  refreshItem(type: FeedItemType, id: string, allowInsert: boolean): void | Promise<void>;
  refreshComments(id: string, type: FeedItemType): void | Promise<void>;
}

let socialChannelSequence = 0;

export function useSocialRealtime({ enabled, feedItems, commentsLoaded, refreshItem, refreshComments }: Props) {
  const itemsRef = useRef(feedItems);
  const commentsRef = useRef(commentsLoaded);
  useEffect(() => { itemsRef.current = feedItems; }, [feedItems]);
  useEffect(() => { commentsRef.current = commentsLoaded; }, [commentsLoaded]);

  useEffect(() => {
    if (!enabled) return;
    const channel = supabase.channel(`mobile-social-feed-realtime:${++socialChannelSequence}`).on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'social_realtime_events' },
      (payload) => {
        const row = payload.new as RealtimeRow;
        const type = row.target_type;
        const id = row.target_id;
        if ((type !== 'post' && type !== 'coupon' && type !== 'casino') || typeof id !== 'string') return;
        const source = typeof row.source_table === 'string' ? row.source_table : '';
        const isInsert = row.operation === 'INSERT' && ['social_posts', 'casino_social_shares', 'coupons'].includes(source);
        const isLoaded = itemsRef.current.some((item) => item.id === id && item.item_type === type);
        if (isLoaded || isInsert) void refreshItem(type, id, isInsert);
        if (commentsRef.current[`${type}:${id}`] && ['social_comments', 'social_reactions'].includes(source)) void refreshComments(id, type);
      },
    ).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [enabled, refreshComments, refreshItem]);
}
