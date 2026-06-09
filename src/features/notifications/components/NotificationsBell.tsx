import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, Volume2, VolumeX } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { UserNotification } from "@/types/database";
import {
  fetchUnreadNotificationsCount,
  fetchUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/features/notifications/api/notifications";
import {
  formatNotificationTime,
  formatNotificationTypeLabel,
  getNotificationLink,
} from "@/features/notifications/format";
import {
  getNotificationsSoundMuted,
  playNotificationSound,
  prepareNotificationSound,
  setNotificationsSoundMuted,
} from "@/features/notifications/sound";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface NotificationsBellProps {
  userId?: string;
  className?: string;
}

export function NotificationsBell({
  userId,
  className,
}: NotificationsBellProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [soundMuted, setSoundMuted] = useState(getNotificationsSoundMuted());
  const navigate = useNavigate();
  const openRef = useRef(open);
  const soundMutedRef = useRef(soundMuted);

  const hasUnread = unreadCount > 0;

  const unreadBadge = useMemo(() => {
    if (unreadCount <= 0) return null;
    if (unreadCount > 99) return "99+";
    return String(unreadCount);
  }, [unreadCount]);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    soundMutedRef.current = soundMuted;
  }, [soundMuted]);

  const loadNotifications = useCallback(
    async (cancelledRef?: { current: boolean }) => {
      if (!userId || cancelledRef?.current) return;
      setLoading(true);
      try {
        const data = await fetchUserNotifications(userId, 20, 0);
        if (!cancelledRef?.current) {
          setNotifications(data);
        }
      } catch {
        if (!cancelledRef?.current) {
          setNotifications([]);
        }
      } finally {
        if (!cancelledRef?.current) {
          setLoading(false);
        }
      }
    },
    [userId],
  );

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    let cancelled = false;
    const cancelledRef = {
      get current() {
        return cancelled;
      },
    };

    const loadCount = async () => {
      try {
        const count = await fetchUnreadNotificationsCount(userId);
        if (!cancelled) {
          setUnreadCount(count);
        }
      } catch {
        if (!cancelled) {
          setUnreadCount(0);
        }
      }
    };

    void loadCount();

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT" && !soundMutedRef.current) {
            void playNotificationSound();
          }
          void loadCount();
          if (openRef.current) {
            void loadNotifications(cancelledRef);
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [loadNotifications, userId]);

  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;

    const cancelledRef = {
      get current() {
        return cancelled;
      },
    };

    void loadNotifications(cancelledRef);

    return () => {
      cancelled = true;
    };
  }, [loadNotifications, open, userId]);

  if (!userId) return null;

  const handleNotificationClick = async (notification: UserNotification) => {
    if (!notification.is_read) {
      try {
        await markNotificationRead(userId, notification.id);
        setUnreadCount((prev) => Math.max(prev - 1, 0));
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id
              ? {
                  ...n,
                  is_read: true,
                }
              : n,
          ),
        );
      } catch {
        // non-blocking
      }
    }

    setOpen(false);
    navigate(getNotificationLink(notification));
  };

  const handleMarkAllRead = async () => {
    if (!hasUnread) return;
    try {
      await markAllNotificationsRead(userId);
      setUnreadCount(0);
      setNotifications((prev) =>
        prev.map((item) => ({ ...item, is_read: true })),
      );
    } catch {
      // non-blocking
    }
  };

  const handleToggleSound = () => {
    const nextMuted = !soundMuted;
    setSoundMuted(nextMuted);
    setNotificationsSoundMuted(nextMuted);
    if (!nextMuted) {
      void prepareNotificationSound();
    }
  };

  const handleBellClick = () => {
    if (!soundMutedRef.current) {
      void prepareNotificationSound();
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Powiadomienia"
          onClick={handleBellClick}
          className={`relative inline-flex items-center justify-center rounded-full p-1.5 transition-colors ${
            hasUnread
              ? "text-primary-foreground hover:bg-primary-foreground/20"
              : "text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
          } ${className ?? ""}`}
        >
          <Bell className="h-4 w-4" />
          {unreadBadge && (
            <span className="absolute -right-1 -top-1 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] leading-4 font-bold text-center">
              {unreadBadge}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] p-0">
        <div className="border-b border-border px-3 py-2 flex items-center justify-between">
          <p className="text-sm font-semibold">Powiadomienia</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleSound}
              aria-label={
                soundMuted
                  ? "Włącz dźwięk powiadomień"
                  : "Wycisz dźwięk powiadomień"
              }
              className="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
              title={soundMuted ? "Dźwięk wyłączony" : "Dźwięk włączony"}
            >
              {soundMuted ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              className="text-xs text-primary disabled:text-muted-foreground"
              disabled={!hasUnread}
              onClick={() => void handleMarkAllRead()}
            >
              Oznacz wszystkie
            </button>
          </div>
        </div>

        {loading ? (
          <div className="px-3 py-4 text-xs text-muted-foreground">
            Ładowanie...
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-3 py-4 text-xs text-muted-foreground">
            Brak powiadomień
          </div>
        ) : (
          <div className="max-h-[380px] overflow-y-auto py-1">
            {notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => void handleNotificationClick(notification)}
                className={`w-full text-left px-3 py-2 hover:bg-muted/60 transition-colors border-l-2 ${notification.is_read ? "border-transparent" : "border-primary"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-foreground line-clamp-2">
                    {notification.title}
                  </p>
                  {!notification.is_read && (
                    <span
                      className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0"
                      aria-hidden="true"
                    />
                  )}
                </div>
                {notification.body && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                    {notification.body}
                  </p>
                )}
                <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{formatNotificationTypeLabel(notification.type)}</span>
                  <span>{formatNotificationTime(notification.created_at)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
