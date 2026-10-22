import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { useUserId } from '@/features/auth/auth-store';
import { PREFETCH_PRESS_DELAY_MS, prefetchPublicProfile } from '@/features/profile/api/profileQueries';
import { alpha, createStyles, useTheme } from '@/theme';
import type { ReactorUser } from '@/types/social';
import { OverlayScreen, Text, useOverlayClose } from '@/ui';
import { reactorsQuery } from '../api/queries';
import { REACTION_EMOJIS, REACTION_TYPES, type ReactionType } from '../lib/reactions';
import { parseReactorsRouteParams, type ReactorsTarget } from '../lib/routes';

/**
 * `/sheets/reactors?postId|couponId|casinoShareId|commentId&initial=` (web
 * `ReactorsDialog`): everyone who reacted, one tab per emoji. Failures show
 * the empty state, like the web.
 */
export function ReactorsSheet() {
  const styles = useStyles();
  const { width: windowWidth } = useWindowDimensions();
  const parsed = parseReactorsRouteParams(useLocalSearchParams());

  return (
    // `w-[calc(100%-1rem)] max-w-md rounded-lg p-6 grid gap-4`.
    <OverlayScreen variant="dialog" accessibilityLabel="Reakcje" style={[styles.card, { width: windowWidth - 16 }]}>
      {/* DialogHeader is `text-center` below `sm`. */}
      <Text style={styles.title} accessibilityRole="header">
        Reakcje
      </Text>
      {parsed ? (
        <ReactorsBody target={parsed.target} initial={parsed.initial} />
      ) : (
        <Text color="mutedForeground">Brak reakcji</Text>
      )}
      <DialogClose />
    </OverlayScreen>
  );
}

/** shadcn `DialogPrimitive.Close`: `absolute right-4 top-4 opacity-70`, 16 px X, no background. */
function DialogClose() {
  const styles = useStyles();
  const { colors } = useTheme();
  const close = useOverlayClose();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Zamknij"
      hitSlop={14}
      onPress={() => close()}
      style={styles.close}
    >
      <X size={16} color={colors.foreground} />
    </Pressable>
  );
}

function ReactorsBody({ target, initial }: { target: ReactorsTarget; initial: ReactionType | null }) {
  const styles = useStyles();
  const currentUserId = useUserId();
  const { data: reactors, isPending } = useQuery(reactorsQuery(target));
  const [selected, setSelected] = useState<ReactionType | null>(null);

  if (isPending) return <Text color="mutedForeground">Ładowanie...</Text>;
  if (!reactors || reactors.length === 0) return <Text color="mutedForeground">Brak reakcji</Text>;

  const byType = new Map<ReactionType, ReactorUser[]>();
  for (const reactor of reactors) {
    byType.set(reactor.emoji, [...(byType.get(reactor.emoji) ?? []), reactor]);
  }
  const available = REACTION_TYPES.filter((type) => (byType.get(type)?.length ?? 0) > 0);
  const active =
    selected && available.includes(selected)
      ? selected
      : initial && available.includes(initial)
        ? initial
        : available[0];
  const list = byType.get(active) ?? [];

  return (
    <View style={styles.body}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsList}
        contentContainerStyle={styles.tabsRow}
        accessibilityRole="tablist"
      >
        {available.map((type) => {
          const isActive = type === active;
          return (
            <Pressable
              key={type}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              onPress={() => setSelected(type)}
              style={[styles.tab, isActive && styles.tabActive]}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {REACTION_EMOJIS[type]} {byType.get(type)?.length ?? 0}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} alwaysBounceVertical={false}>
        {list.map((reactor) => (
          <ReactorRow
            key={`${reactor.user_id}-${reactor.created_at}`}
            reactor={reactor}
            isSelf={reactor.user_id === currentUserId}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function ReactorRow({ reactor, isSelf }: { reactor: ReactorUser; isSelf: boolean }) {
  const styles = useStyles();
  const close = useOverlayClose();
  return (
    <Pressable
      accessibilityRole="link"
      unstable_pressDelay={PREFETCH_PRESS_DELAY_MS}
      onPressIn={() => {
        if (!isSelf) prefetchPublicProfile(reactor.user_id);
      }}
      // By id, the key the press-in prefetch warmed (a username needs a lookup first).
      onPress={() => close(() => router.push(`/profile/${reactor.user_id}`))}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      {({ pressed }) => (
        <Text numberOfLines={1} style={[styles.rowText, pressed && styles.rowTextPressed]}>
          @{reactor.username}
        </Text>
      )}
    </Pressable>
  );
}

const useStyles = createStyles(({ colors, radius }) => ({
  card: { maxWidth: 448, borderRadius: radius.lg, padding: 24, gap: 16 },
  // DialogTitle: `text-lg font-semibold leading-none tracking-tight`.
  title: { fontSize: 18, lineHeight: 18, fontWeight: '600', letterSpacing: -0.45, textAlign: 'center' },
  close: { position: 'absolute', top: 16, right: 16, opacity: 0.7 },
  // Tabs `space-y-2`; shrinks so the reactor list scrolls inside the dialog's max height.
  body: { flexShrink: 1, gap: 8 },
  // `TabsList`: rounded-md border bg-muted/60 p-1, `w-full justify-start gap-1`.
  tabsList: {
    flexGrow: 0,
    flexShrink: 0,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: alpha(colors.muted, 0.6),
  },
  tabsRow: { gap: 4, padding: 4 },
  // Trigger: `rounded-sm px-2.5 py-1.5 text-xs font-medium border border-transparent`.
  tab: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  // Active: `border-primary/40 bg-primary/10 text-primary shadow-sm`.
  tabActive: {
    borderColor: alpha(colors.primary, 0.4),
    backgroundColor: alpha(colors.primary, 0.1),
    boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)',
  },
  tabText: { fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.mutedForeground },
  tabTextActive: { color: colors.primary },
  // `space-y-1 overflow-y-auto pr-1`.
  list: { flexGrow: 0, flexShrink: 1 },
  listContent: { gap: 4, paddingRight: 4 },
  // `block rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted hover:text-primary`.
  row: { borderRadius: radius.md, paddingHorizontal: 8, paddingVertical: 6 },
  rowPressed: { backgroundColor: colors.muted },
  rowText: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: colors.foreground },
  rowTextPressed: { color: colors.primary },
}));
