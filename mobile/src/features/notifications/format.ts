import type { FeedItemType, NotificationType, UserNotification } from '@/types/database';

export function formatNotificationTypeLabel(type: NotificationType): string {
  switch (type) {
    case 'mention_post':
      return 'Wzmianka w poście';
    case 'mention_comment':
      return 'Wzmianka w komentarzu';
    case 'coupon_won':
      return 'Wygrany kupon';
    case 'comment_post':
      return 'Komentarz do posta';
    case 'jackpot_draw_ready':
      return 'Losowanie jackpotu';
    case 'money_transfer':
      return 'Transfer środków';
    default:
      return 'Powiadomienie';
  }
}

export function formatNotificationTime(dateStr: string, now: number = Date.now()): string {
  const diff = now - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return 'przed chwilą';
  if (minutes < 60) return `${minutes} min temu`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} godz. temu`;

  const days = Math.floor(hours / 24);
  if (days === 1) return '1 dzień temu';
  if (days < 7) return `${days} dni temu`;

  return new Date(dateStr).toLocaleDateString('pl-PL');
}

function isFeedItemType(value: string | undefined): value is FeedItemType {
  return value === 'post' || value === 'coupon' || value === 'casino';
}

/** Web `getSocialItemPath` (`src/features/social/routes.ts`). */
function getSocialItemPath(itemType: FeedItemType, itemId: string): string {
  return `/social/${encodeURIComponent(itemType)}/${encodeURIComponent(itemId)}`;
}

/**
 * Splits a link into pathname and query params the way `new URL(link, base)`
 * does on the web (React Native's URL has no reliable `searchParams`).
 */
function parseLink(link: string): { pathname: string; params: Map<string, string> } {
  const withoutHash = link.split('#')[0] ?? '';
  const queryIndex = withoutHash.indexOf('?');
  const rawPath = queryIndex === -1 ? withoutHash : withoutHash.slice(0, queryIndex);
  const query = queryIndex === -1 ? '' : withoutHash.slice(queryIndex + 1);
  const pathOnly = rawPath.replace(/^[a-z][a-z\d+.-]*:\/\/[^/]*/i, '');
  const pathname = pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;

  const params = new Map<string, string>();
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const [rawKey, ...rest] = pair.split('=');
    const key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
    if (!params.has(key)) {
      params.set(key, decodeURIComponent(rest.join('=').replace(/\+/g, ' ')));
    }
  }
  return { pathname, params };
}

export function getNotificationLink(notification: UserNotification): string {
  const linkPath = notification.link_path || '/social';

  try {
    const { pathname, params } = parseLink(linkPath);
    const itemType = params.get('itemType');
    const itemId = params.get('itemId');

    if (pathname === '/social' && isFeedItemType(itemType) && itemId) {
      return getSocialItemPath(itemType, itemId);
    }
    // Money transfers link to `/?wallet=history`; the web navbar opens the wallet on History.
    if (params.get('wallet') === 'history') {
      return '/sheets/wallet?tab=history';
    }
  } catch {
    return linkPath;
  }

  return linkPath;
}
