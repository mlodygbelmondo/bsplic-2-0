import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { createStyles } from '@/theme';
import { Text } from '@/ui';
import { sortedReactions, totalReactions, type ReactionCounts } from '../lib/reactions';
import { social } from './socialColors';

const VISIBLE_REACTION_LIMIT = 3;

/**
 * Web `ReactionSummaryButton` with the phone classes
 * (`social-mobile-reaction-summary`/`-stack`): up to three emojis by count,
 * overlapping, then the total. Hidden without reactions.
 */
export const ReactionSummaryButton = memo(function ReactionSummaryButton({
  reactions,
  onOpenReactors,
  disabled,
}: {
  reactions: ReactionCounts | null;
  onOpenReactors?: () => void;
  disabled?: boolean;
}) {
  const styles = useStyles();
  const total = totalReactions(reactions);
  if (total === 0) return null;
  const visible = sortedReactions(reactions).slice(0, VISIBLE_REACTION_LIMIT);
  const isDisabled = disabled || !onOpenReactors;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Wyświetl reakcje (${total})`}
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      hitSlop={8}
      onPress={onOpenReactors}
      style={styles.button}
    >
      <View style={styles.stack} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {visible.map(({ type, emoji }, index) => (
          <View key={type} style={[styles.bubble, index < visible.length - 1 && styles.bubbleOverlap]}>
            <Text maxFontSizeMultiplier={1} style={styles.emoji}>
              {emoji}
            </Text>
          </View>
        ))}
      </View>
      <Text tabular style={styles.total}>
        {total}
      </Text>
    </Pressable>
  );
});

const useStyles = createStyles(() => ({
  // `inline-flex items-center gap-[0.35rem] text-[0.8125rem] font-medium`.
  button: { flexDirection: 'row', alignItems: 'center', gap: 5.6, minWidth: 0 },
  // `flex-direction: row-reverse`: the first (most used) emoji sits on the right.
  stack: { flexDirection: 'row-reverse', alignItems: 'center' },
  // 1.15rem circle, card background and a 1px card-coloured ring.
  bubble: {
    width: 18.4,
    height: 18.4,
    borderRadius: 9.2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: social.card,
    backgroundColor: social.card,
  },
  // `margin-left: -0.25rem` on every span but the last (leftmost) one.
  bubbleOverlap: { marginLeft: -4 },
  emoji: { fontSize: 11.52, lineHeight: 14 },
  total: { fontSize: 13, lineHeight: 19.5, fontWeight: '500', color: social.mutedForeground },
}));
