import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useUserId } from '@/features/auth/auth-store';
import { prefetchPublicProfile } from '@/features/profile/api/profileQueries';
import { alpha, createStyles } from '@/theme';
import type { ReactorUser } from '@/types/social';
import { SheetHeader, Text } from '@/ui';
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
  const parsed = parseReactorsRouteParams(useLocalSearchParams());

  return (
    <View collapsable={false} style={styles.sheet}>
      <SheetHeader title="Reakcje" />
      {parsed ? (
        <ReactorsBody target={parsed.target} initial={parsed.initial} />
      ) : (
        <Text style={styles.message}>Brak reakcji</Text>
      )}
    </View>
  );
}

function ReactorsBody({ target, initial }: { target: ReactorsTarget; initial: ReactionType | null }) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const currentUserId = useUserId();
  const { data: reactors, isPending } = useQuery(reactorsQuery(target));
  const [selected, setSelected] = useState<ReactionType | null>(null);

  if (isPending) return <Text style={styles.message}>Ładowanie...</Text>;
  if (!reactors || reactors.length === 0) return <Text style={styles.message}>Brak reakcji</Text>;

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
      <FlashList
        data={list}
        keyExtractor={(reactor) => `${reactor.user_id}-${reactor.created_at}`}
        renderItem={({ item }) => <ReactorRow reactor={item} isSelf={item.user_id === currentUserId} />}
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      />
    </View>
  );
}

function ReactorRow({ reactor, isSelf }: { reactor: ReactorUser; isSelf: boolean }) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="link"
      onPressIn={() => {
        if (!isSelf) prefetchPublicProfile(reactor.user_id);
      }}
      onPress={() => {
        router.back();
        router.push(`/profile/${encodeURIComponent(reactor.username)}`);
      }}
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
  sheet: { flex: 1, backgroundColor: colors.background },
  message: { paddingHorizontal: 20, fontSize: 14, lineHeight: 20, color: colors.mutedForeground },
  // `space-y-2`.
  body: { flex: 1, gap: 8, paddingHorizontal: 20 },
  // `TabsList`: rounded-md border bg-muted/60 p-1, `w-full justify-start gap-1`.
  tabsList: {
    flexGrow: 0,
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
  // `block rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted hover:text-primary`.
  row: { borderRadius: radius.md, paddingHorizontal: 8, paddingVertical: 6 },
  rowPressed: { backgroundColor: colors.muted },
  rowText: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: colors.foreground },
  rowTextPressed: { color: colors.primary },
}));
