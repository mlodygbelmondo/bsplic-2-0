import type { FeedItemType } from '@/types/database';

/**
 * Coalescing behind the web `useSocialRealtimeFeed`: one action can emit
 * several `social_realtime_events` rows for the same feed item, so rows are
 * merged per item, flushed after 250 ms, and reads for one item never overlap.
 */

export interface SocialRealtimeRow {
  target_type?: unknown;
  target_id?: unknown;
  source_table?: unknown;
  operation?: unknown;
}

export interface SocialRealtimeTarget {
  itemType: FeedItemType;
  itemId: string;
  sourceTable: string;
  operation: string;
}

const FLUSH_MS = 250;
const FEED_ITEM_SOURCES = new Set(['social_posts', 'casino_social_shares', 'coupons']);
const ENGAGEMENT_SOURCES = new Set(['social_comments', 'social_reactions']);

function stringValue(row: SocialRealtimeRow, key: keyof SocialRealtimeRow) {
  const value = row[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function getFeedTargetFromRealtimeRow(row: SocialRealtimeRow): SocialRealtimeTarget | null {
  const targetType = stringValue(row, 'target_type');
  const targetId = stringValue(row, 'target_id');
  const sourceTable = stringValue(row, 'source_table');
  const operation = stringValue(row, 'operation');

  if (!targetId || !sourceTable || !operation || (targetType !== 'post' && targetType !== 'coupon' && targetType !== 'casino')) {
    return null;
  }

  return { itemType: targetType, itemId: targetId, sourceTable, operation };
}

export interface RealtimeCoalescerDeps {
  /** The item is in the loaded feed. */
  isLoaded: (itemType: FeedItemType, itemId: string) => boolean;
  /** Someone currently shows this item's comments. */
  areCommentsLoaded: (itemType: FeedItemType, itemId: string) => boolean;
  refreshItem: (itemType: FeedItemType, itemId: string, options: { allowInsert: boolean }) => void | Promise<void>;
  reloadComments: (itemType: FeedItemType, itemId: string) => void | Promise<void>;
  onError?: (reason: unknown) => void;
}

interface PendingTarget {
  itemType: FeedItemType;
  itemId: string;
  allowInsert: boolean;
  refreshItem: boolean;
  refreshComments: boolean;
}

export function createRealtimeCoalescer(deps: RealtimeCoalescerDeps) {
  const pending = new Map<string, PendingTarget>();
  const inFlight = new Set<string>();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  const scheduleFlush = () => {
    if (disposed || timeoutId !== undefined) return;
    timeoutId = setTimeout(flush, FLUSH_MS);
  };

  const flush = () => {
    timeoutId = undefined;
    for (const [key, target] of pending) {
      if (inFlight.has(key)) continue;
      pending.delete(key);
      inFlight.add(key);
      const reads: (() => void | Promise<void>)[] = [];
      if (target.refreshItem) {
        reads.push(() => deps.refreshItem(target.itemType, target.itemId, { allowInsert: target.allowInsert }));
      }
      if (target.refreshComments && deps.areCommentsLoaded(target.itemType, target.itemId)) {
        reads.push(() => deps.reloadComments(target.itemType, target.itemId));
      }
      void Promise.allSettled(reads.map((read) => Promise.resolve().then(read))).then((results) => {
        for (const result of results) {
          if (result.status === 'rejected') {
            (deps.onError ?? ((reason) => console.error('Social realtime refresh failed:', reason)))(result.reason);
          }
        }
        inFlight.delete(key);
        if (pending.has(key)) scheduleFlush();
      });
    }
  };

  return {
    push(row: SocialRealtimeRow) {
      if (disposed) return;
      const target = getFeedTargetFromRealtimeRow(row);
      if (!target) return;

      const isLoaded = deps.isLoaded(target.itemType, target.itemId);
      const isFeedItemInsert = target.operation === 'INSERT' && FEED_ITEM_SOURCES.has(target.sourceTable);
      const refreshComments =
        ENGAGEMENT_SOURCES.has(target.sourceTable) && deps.areCommentsLoaded(target.itemType, target.itemId);
      if (!isLoaded && !isFeedItemInsert && !refreshComments) return;

      const key = `${target.itemType}:${target.itemId}`;
      const previous = pending.get(key);
      pending.set(key, {
        itemType: target.itemType,
        itemId: target.itemId,
        allowInsert: isFeedItemInsert || (previous?.allowInsert ?? false),
        refreshItem: isLoaded || isFeedItemInsert || (previous?.refreshItem ?? false),
        refreshComments: refreshComments || (previous?.refreshComments ?? false),
      });
      scheduleFlush();
    },

    dispose() {
      disposed = true;
      clearTimeout(timeoutId);
      timeoutId = undefined;
      pending.clear();
    },
  };
}

export type RealtimeCoalescer = ReturnType<typeof createRealtimeCoalescer>;
