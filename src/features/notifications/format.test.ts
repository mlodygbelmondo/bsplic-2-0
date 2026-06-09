import { describe, expect, it } from 'vitest';
import { formatNotificationTypeLabel, getNotificationLink } from '@/features/notifications/format';
import type { UserNotification } from '@/types/database';

const baseNotification: UserNotification = {
  id: 'n1',
  user_id: 'u1',
  actor_user_id: null,
  actor_username: null,
  type: 'mention_post',
  title: 'title',
  body: null,
  link_path: null,
  metadata: {},
  is_read: false,
  read_at: null,
  created_at: new Date().toISOString(),
};

describe('notifications format helpers', () => {
  it('maps notification type to Polish label', () => {
    expect(formatNotificationTypeLabel('mention_post')).toBe('Wzmianka w poście');
    expect(formatNotificationTypeLabel('mention_comment')).toBe('Wzmianka w komentarzu');
    expect(formatNotificationTypeLabel('coupon_won')).toBe('Wygrany kupon');
    expect(formatNotificationTypeLabel('comment_post')).toBe('Komentarz do posta');
  });

  it('returns social fallback link when link_path is missing', () => {
    expect(getNotificationLink(baseNotification)).toBe('/social');
  });

  it('returns dedicated social item route for legacy social query links', () => {
    expect(
      getNotificationLink({
        ...baseNotification,
        link_path: '/social?itemType=post&itemId=abc',
      }),
    ).toBe('/social/post/abc');
  });

  it('returns explicit notification link when available', () => {
    expect(
      getNotificationLink({
        ...baseNotification,
        link_path: '/profile/user-1',
      }),
    ).toBe('/profile/user-1');
  });
});
