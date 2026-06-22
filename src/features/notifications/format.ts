import type { NotificationType, UserNotification } from '@/types/database';
import { getSocialItemPath, isFeedItemType } from '@/features/social/routes';

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
    default:
      return 'Powiadomienie';
  }
}

export function formatNotificationTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return 'przed chwilą';
  if (minutes < 60) return `${minutes} min temu`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} godz. temu`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} dni temu`;

  return new Date(dateStr).toLocaleDateString('pl-PL');
}

export function getNotificationLink(notification: UserNotification): string {
  const linkPath = notification.link_path || '/social';

  try {
    const url = new URL(linkPath, 'https://bsplic.local');
    const itemType = url.searchParams.get('itemType') ?? undefined;
    const itemId = url.searchParams.get('itemId');

    if (url.pathname === '/social' && isFeedItemType(itemType) && itemId) {
      return getSocialItemPath(itemType, itemId);
    }
  } catch {
    return linkPath;
  }

  return linkPath;
}
