import { router } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { useUserId } from '@/features/auth/auth-store';
import { haptics } from '@/lib/haptics';
import { queryClient } from '@/lib/query-client';
import { alpha, createStyles, useTheme } from '@/theme';
import { Text } from '@/ui';
import { notificationsQueries } from './api/notifications';
import { useNotificationsLive, useUnreadNotificationsCount } from './notifications-store';
import { getNotificationsSoundMuted, prepareNotificationSound } from './sound';

/** Web badge text: the count, or `99+` above 99. */
function formatUnreadBadge(count: number): string | null {
  if (count <= 0) return null;
  if (count > 99) return '99+';
  return String(count);
}

/**
 * Header bell (web `NotificationsBell` trigger, mobile navbar variant:
 * `h-8 w-8` button with a 20 px `Bell`). Opens the notifications popover.
 */
export function NotificationsBell() {
  const userId = useUserId();
  useNotificationsLive(userId);
  const unreadCount = useUnreadNotificationsCount();
  const styles = useStyles();
  const { colors } = useTheme();

  if (!userId) return null;

  const unreadBadge = formatUnreadBadge(unreadCount);
  const hasUnread = unreadBadge !== null;
  const bellLabel = unreadBadge ? `Powiadomienia, ${unreadBadge} nieprzeczytane` : 'Powiadomienia';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={bellLabel}
      hitSlop={6}
      onPressIn={() => {
        void queryClient.prefetchQuery(notificationsQueries.list(userId));
      }}
      onPress={() => {
        haptics.selection();
        if (!getNotificationsSoundMuted()) prepareNotificationSound();
        router.push('/sheets/notifications');
      }}
      style={({ pressed }) => [styles.button, pressed && (hasUnread ? styles.pressedUnread : styles.pressedRead)]}
    >
      <Bell size={20} color={hasUnread ? colors.primaryForeground : alpha(colors.primaryForeground, 0.7)} />
      {unreadBadge ? (
        <View style={styles.badge} pointerEvents="none">
          <Text style={styles.badgeText} maxFontSizeMultiplier={1}>
            {unreadBadge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const useStyles = createStyles(({ colors }) => ({
  button: {
    width: 32,
    height: 32,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressedUnread: { backgroundColor: alpha(colors.primaryForeground, 0.2) },
  pressedRead: { backgroundColor: alpha(colors.primaryForeground, 0.1) },
  badge: {
    position: 'absolute',
    right: -4,
    top: -4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 9999,
    backgroundColor: colors.destructive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 16,
    fontWeight: '700',
    textAlign: 'center',
    color: colors.destructiveForeground,
  },
}));
