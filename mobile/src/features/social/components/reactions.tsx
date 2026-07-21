import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { ThumbsUp } from 'lucide-react-native';

import { AppAvatar } from '@/components/ui/AppAvatar';
import { AppModal } from '@/components/ui/AppModal';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/hooks/use-app-theme';
import type { ReactionEmoji } from '@/types/database';

import { fetchReactors, type ReactorUser } from '../api/reactions';
import { REACTION_EMOJIS, REACTION_LABELS, REACTION_TYPES, sortedReactions, totalReactions } from '../reactions';

export type ReactionTarget = { postId?: string; couponId?: string; casinoShareId?: string; commentId?: string };

interface ReactionBarProps {
  reactions: Partial<Record<ReactionEmoji, number>> | null;
  myReaction: ReactionEmoji | null;
  disabled?: boolean;
  compact?: boolean;
  onToggle(emoji: ReactionEmoji): void;
  onOpenReactors?(): void;
}

export function ReactionBar({ reactions, myReaction, disabled, compact, onToggle, onOpenReactors }: ReactionBarProps) {
  const { tokens } = useAppTheme();
  const sorted = sortedReactions(reactions);
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <View style={styles.wrap}>
      {totalReactions(reactions) > 0 ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Pokaż reakcje (${totalReactions(reactions)})`} onPress={onOpenReactors} style={styles.summary}>
          <AppText variant="caption">{sorted.slice(0, 3).map((entry) => entry.emoji).join(' ')}</AppText>
          <AppText variant="caption" tone="muted" style={{ fontVariant: ['tabular-nums'] }}>{totalReactions(reactions)}</AppText>
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={myReaction ? `Usuń reakcję ${REACTION_LABELS[myReaction]}` : 'Lubię to'}
        accessibilityHint="Przytrzymaj, aby wybrać inną reakcję"
        disabled={disabled}
        onPress={() => onToggle(myReaction ?? 'like')}
        onLongPress={() => setPickerOpen((open) => !open)}
        style={styles.likeButton}
      >
        <ThumbsUp size={16} color={myReaction ? tokens.colors.primary : tokens.colors.mutedForeground} fill={myReaction ? tokens.colors.primary : 'transparent'} />
        <AppText variant="caption" tone={myReaction ? 'primary' : 'muted'}>{myReaction ? REACTION_LABELS[myReaction] : 'Lubię to'}</AppText>
      </Pressable>
      {pickerOpen ? <View style={[styles.picker, { backgroundColor: tokens.colors.card, borderColor: tokens.colors.border }]}>
        {(compact ? REACTION_TYPES.slice(0, 4) : REACTION_TYPES).map((type) => (
          <Pressable
            key={type}
            accessibilityRole="button"
            accessibilityLabel={REACTION_LABELS[type]}
            accessibilityState={{ selected: myReaction === type, disabled }}
            disabled={disabled}
            onPress={() => { onToggle(type); setPickerOpen(false); }}
            style={[styles.reaction, myReaction === type && { backgroundColor: `${tokens.colors.primary}20`, borderColor: tokens.colors.primary }]}
          >
            <AppText style={styles.emoji}>{REACTION_EMOJIS[type]}</AppText>
          </Pressable>
        ))}
      </View> : null}
    </View>
  );
}

export function ReactorsModal({ visible, target, onClose }: { visible: boolean; target: ReactionTarget | null; onClose(): void }) {
  const { tokens } = useAppTheme();
  const [reactors, setReactors] = useState<ReactorUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!visible || !target) return;
    setLoading(true);
    setError(null);
    void fetchReactors(target)
      .then(setReactors)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Nie udało się wczytać reakcji.'))
      .finally(() => setLoading(false));
  }, [target, visible]);
  return (
    <AppModal visible={visible} title="Reakcje" onClose={onClose}>
      <View style={styles.list}>
        {loading ? <ActivityIndicator color={tokens.colors.primary} /> : null}
        {error ? <AppText selectable tone="danger">{error}</AppText> : null}
        {!loading && !error && reactors.length === 0 ? <AppText tone="muted">Brak reakcji.</AppText> : null}
        {reactors.map((reactor) => (
          <View key={`${reactor.user_id}-${reactor.emoji}`} style={styles.reactor}>
            <AppAvatar name={reactor.username} size={34} />
            <AppText variant="label" style={styles.flex}>{reactor.username}</AppText>
            <AppText>{REACTION_EMOJIS[reactor.emoji]}</AppText>
          </View>
        ))}
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 5 },
  summary: { minHeight: 28, flexDirection: 'row', gap: 5, alignItems: 'center' },
  likeButton: { minHeight: 38, flexDirection: 'row', gap: 7, alignItems: 'center', paddingRight: 8 },
  picker: { position: 'absolute', left: 0, bottom: 40, zIndex: 10, flexDirection: 'row', gap: 3, borderWidth: StyleSheet.hairlineWidth, borderRadius: 24, padding: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.28)' },
  reaction: { width: 38, minHeight: 38, borderRadius: 19, borderWidth: StyleSheet.hairlineWidth, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 19 },
  list: { gap: 12 },
  reactor: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
});
