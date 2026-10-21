import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { Volume2, VolumeX } from 'lucide-react-native';
import { memo, useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useUserId } from '@/features/auth/auth-store';
import { haptics } from '@/lib/haptics';
import { usePreferences } from '@/lib/preferences';
import { alpha, createStyles, useTheme } from '@/theme';
import { Text } from '@/ui';
import type { UserNotification } from '@/types/database';
import { notificationsQueries } from './api/notifications';
import { formatNotificationTime, formatNotificationTypeLabel, getNotificationLink } from './format';
import { notificationsActions, useNotificationsLive, useUnreadNotificationsCount } from './notifications-store';
import { prepareNotificationSound, setNotificationsSoundMuted } from './sound';

/**
 * Notifications panel (web mobile popover `notifications-popover-content`),
 * presented as a native form sheet. Same header, rows, states and copy.
 */
export function NotificationsSheet() {
  const userId = useUserId();
  useNotificationsLive(userId);
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const unreadCount = useUnreadNotificationsCount();
  const soundMuted = usePreferences((s) => !s.notificationSound);
  const [refreshing, setRefreshing] = useState(false);

  const listQuery = useQuery({ ...notificationsQueries.list(userId ?? ''), enabled: userId !== null });
  const notifications = listQuery.data ?? [];
  const hasUnread = unreadCount > 0;

  const handleToggleSound = () => {
    haptics.selection();
    const nextMuted = !soundMuted;
    setNotificationsSoundMuted(nextMuted);
    if (!nextMuted) prepareNotificationSound();
  };

  const handleNotificationPress = (notification: UserNotification) => {
    if (!userId) return;
    void notificationsActions.markRead(userId, notification);
    router.back();
    router.push(getNotificationLink(notification) as Href);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await listQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={styles.container} accessibilityLabel="Powiadomienia" collapsable={false}>
      <View style={styles.header}>
        <Text size="sm" weight="600" accessibilityRole="header">
          Powiadomienia
        </Text>
        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={soundMuted ? 'Włącz dźwięk powiadomień' : 'Wycisz dźwięk powiadomień'}
            accessibilityHint={soundMuted ? 'Dźwięk wyłączony' : 'Dźwięk włączony'}
            hitSlop={10}
            onPress={handleToggleSound}
            style={({ pressed }) => [styles.soundButton, pressed && styles.soundButtonPressed]}
          >
            {({ pressed }) =>
              soundMuted ? (
                <VolumeX size={16} color={pressed ? colors.foreground : colors.mutedForeground} />
              ) : (
                <Volume2 size={16} color={pressed ? colors.foreground : colors.mutedForeground} />
              )
            }
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !hasUnread }}
            disabled={!hasUnread}
            hitSlop={12}
            onPress={() => {
              if (!userId) return;
              haptics.selection();
              void notificationsActions.markAllRead(userId);
            }}
          >
            <Text size="xs" color={hasUnread ? 'primary' : 'mutedForeground'}>
              Oznacz wszystkie
            </Text>
          </Pressable>
        </View>
      </View>

      {listQuery.isPending && listQuery.fetchStatus !== 'idle' ? (
        <Text size="xs" color="mutedForeground" style={styles.stateText}>
          Ładowanie...
        </Text>
      ) : notifications.length === 0 ? (
        <Text size="xs" color="mutedForeground" style={styles.stateText}>
          Brak powiadomień
        </Text>
      ) : (
        <FlashList
          data={notifications}
          keyExtractor={keyExtractor}
          renderItem={({ item }) => <NotificationRow notification={item} onPress={handleNotificationPress} />}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: insets.bottom + 4 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={colors.mutedForeground} />
          }
        />
      )}
    </View>
  );
}

const keyExtractor = (item: UserNotification) => item.id;

const NotificationRow = memo(function NotificationRow({
  notification,
  onPress,
}: {
  notification: UserNotification;
  onPress: (notification: UserNotification) => void;
}) {
  const styles = useStyles();
  const unread = !notification.is_read;
  const typeLabel = formatNotificationTypeLabel(notification.type);
  const time = formatNotificationTime(notification.created_at);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[notification.title, notification.body, typeLabel, time].filter(Boolean).join(', ')}
      onPress={() => onPress(notification)}
      style={({ pressed }) => [styles.row, unread ? styles.rowUnread : styles.rowRead, pressed && styles.rowPressed]}
    >
      <View style={styles.titleRow}>
        <Text size="sm" weight="500" numberOfLines={2} style={styles.title}>
          {notification.title}
        </Text>
        {unread ? <View style={styles.dot} /> : null}
      </View>
      {notification.body ? (
        <Text size="xs" color="mutedForeground" numberOfLines={2} style={styles.body}>
          {notification.body}
        </Text>
      ) : null}
      <View style={styles.footer}>
        <Text color="mutedForeground" style={styles.footerText}>
          {typeLabel}
        </Text>
        <Text color="mutedForeground" style={styles.footerText}>
          {time}
        </Text>
      </View>
    </Pressable>
  );
});

const useStyles = createStyles(({ colors }) => ({
  container: { flex: 1, backgroundColor: colors.popover },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 20,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  soundButton: { padding: 4, borderRadius: 6 },
  soundButtonPressed: { backgroundColor: colors.muted },
  stateText: { paddingHorizontal: 12, paddingVertical: 16 },
  row: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderLeftWidth: 2,
  },
  rowUnread: { borderLeftColor: colors.primary },
  rowRead: { borderLeftColor: 'transparent' },
  rowPressed: { backgroundColor: alpha(colors.muted, 0.6) },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  title: { flexShrink: 1 },
  dot: { marginTop: 4, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, flexShrink: 0 },
  body: { marginTop: 2 },
  footer: { marginTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerText: { fontSize: 11, lineHeight: 16 },
}));
