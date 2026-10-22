import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { Volume2, VolumeX } from 'lucide-react-native';
import { memo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useUserId } from '@/features/auth/auth-store';
import { whenOnline } from '@/lib/connectivity';
import { haptics } from '@/lib/haptics';
import { usePreferences } from '@/lib/preferences';
import { alpha, createStyles, useTheme } from '@/theme';
import { OverlayScreen, Text, useOverlayClose } from '@/ui';
import type { UserNotification } from '@/types/database';
import { notificationsQueries } from './api/notifications';
import { formatNotificationTime, formatNotificationTypeLabel, getNotificationLink } from './format';
import { notificationsActions, useNotificationsLive, useUnreadNotificationsCount } from './notifications-store';
import { prepareNotificationSound, setNotificationsSoundMuted } from './sound';

/** Web mobile panel: `fixed left-1/2 top-[calc(3.25rem+env(safe-area-inset-top))] w-[calc(100vw-2rem)] max-w-[340px] -translate-x-1/2`. */
const PANEL_TOP = 52;
const PANEL_MAX_WIDTH = 340;
const PANEL_SIDE_GAP = 32;

/**
 * Notifications popover (web mobile `notifications-popover-content` in
 * `NotificationsBell`): a card under the navbar, centered on the screen,
 * no dimming, closes on outside tap.
 */
export function NotificationsSheet() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const panelWidth = Math.min(width - PANEL_SIDE_GAP, PANEL_MAX_WIDTH);

  return (
    <OverlayScreen
      variant="popover"
      anchor={{ top: insets.top + PANEL_TOP, left: (width - panelWidth) / 2 }}
      style={{ width: panelWidth }}
      accessibilityLabel="Powiadomienia"
    >
      <NotificationsPanel />
    </OverlayScreen>
  );
}

function NotificationsPanel() {
  const userId = useUserId();
  useNotificationsLive(userId);
  const styles = useStyles();
  const { colors } = useTheme();
  const close = useOverlayClose();
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
    close(() => router.push(getNotificationLink(notification) as Href));
  };

  const handleRefresh = () => {
    setRefreshing(true);
    return listQuery.refetch().finally(() => setRefreshing(false));
  };

  return (
    <>
      <View style={styles.header}>
        <Text size="sm" weight="600" color="popoverForeground" accessibilityRole="header">
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
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={whenOnline(() => void handleRefresh())} tintColor={colors.mutedForeground} />
          }
        >
          {notifications.map((notification) => (
            <NotificationRow key={notification.id} notification={notification} onPress={handleNotificationPress} />
          ))}
        </ScrollView>
      )}
    </>
  );
}

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  soundButton: { padding: 4, borderRadius: 6 },
  soundButtonPressed: { backgroundColor: colors.muted },
  stateText: { paddingHorizontal: 12, paddingVertical: 16 },
  // `max-h-[380px] overflow-y-auto py-1` (border-box: the padding counts toward the cap).
  list: { flexGrow: 0, maxHeight: 380 },
  listContent: { paddingVertical: 4 },
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
