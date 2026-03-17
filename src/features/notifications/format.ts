import type { NotificationType, UserNotification } from '@/types/database';

export function formatNotificationTypeLabel(type: NotificationType): string {
  switch (type) {
    case 'mention_post':
      return 'Wzmianka w poście';
    case 'mention_comment':
      return 'Wzmianka w komentarzu';
    case 'coupon_won':
      return 'Wygrany kupon';
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
  return notification.link_path || '/social';
}
