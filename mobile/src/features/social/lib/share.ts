import { Platform, Share } from 'react-native';

import { env } from '@/lib/env';
import type { SocialFeedItem } from '@/types/database';
import { getSocialItemPath } from './routes';

export function getSocialItemShareUrl(item: Pick<SocialFeedItem, 'item_type' | 'id'>): string {
  return `${env.webUrl}${getSocialItemPath(item.item_type, item.id)}`;
}

/**
 * Native share sheet for a feed item (web `handleShareItem`: `navigator.share`
 * with `{username} w Socialu`). Failures stay silent like on the web.
 */
export async function shareSocialItem(item: Pick<SocialFeedItem, 'item_type' | 'id' | 'username'>) {
  const url = getSocialItemShareUrl(item);
  const title = `${item.username} w Socialu`;
  try {
    // iOS shares `url` as a link; Android only reads `message`.
    await Share.share(Platform.OS === 'ios' ? { url, title } : { message: url, title });
  } catch {
    // Dismissed or unavailable; the web ignores share errors too.
  }
}
