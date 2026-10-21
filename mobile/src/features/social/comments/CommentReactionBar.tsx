import { useRef, useState, type ComponentRef } from 'react';
import { Modal, Pressable, useWindowDimensions, View } from 'react-native';
import { Pressable as GesturePressable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptics } from '@/lib/haptics';
import { createStyles } from '@/theme';
import { Text } from '@/ui';
import { social } from '../components/socialColors';
import {
  REACTION_EMOJIS,
  REACTION_LABELS,
  REACTION_TYPES,
  sortedReactions,
  totalReactions,
  type ReactionCounts,
  type ReactionType,
} from '../lib/reactions';

/** Web `LONG_PRESS_MS`. */
const LONG_PRESS_MS = 500;
const VISIBLE_REACTION_LIMIT = 3;
// `.social-reaction-picker`: 2rem options, 0.2rem gap, 0.3rem padding, 1px border.
const OPTION_SIZE = 32;
const OPTION_GAP = 3.2;
const PICKER_PADDING = 4.8;
const PICKER_WIDTH = REACTION_TYPES.length * OPTION_SIZE + (REACTION_TYPES.length - 1) * OPTION_GAP + PICKER_PADDING * 2 + 2;
const PICKER_HEIGHT = OPTION_SIZE + PICKER_PADDING * 2 + 2;
const PICKER_OFFSET = 5.6;
const SCREEN_MARGIN = 8;

interface PickerAnchor {
  left: number;
  top: number;
}

/**
 * Web `ReactionBar` under a comment (summary + text action, no icon): the
 * emoji summary opens the reactors sheet, a tap toggles the current reaction
 * (or 👍), a 500 ms press opens the emoji picker.
 */
export function CommentReactionBar({
  reactions,
  myReaction,
  onToggle,
  onOpenReactors,
  disabled,
}: {
  reactions: ReactionCounts | null;
  myReaction: ReactionType | null;
  onToggle: (emoji: ReactionType) => void;
  onOpenReactors?: () => void;
  disabled?: boolean;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const buttonRef = useRef<ComponentRef<typeof View>>(null);
  const [anchor, setAnchor] = useState<PickerAnchor | null>(null);
  const selected = myReaction ?? 'like';
  const total = totalReactions(reactions);
  const summaryDisabled = disabled || !onOpenReactors;

  const openPicker = () => {
    if (disabled) return;
    buttonRef.current?.measureInWindow((x, y, _width, height) => {
      const left = Math.min(Math.max(SCREEN_MARGIN, x), screenWidth - PICKER_WIDTH - SCREEN_MARGIN);
      const above = y - PICKER_HEIGHT - PICKER_OFFSET;
      const top = above < insets.top + SCREEN_MARGIN ? y + height + PICKER_OFFSET : above;
      haptics.medium();
      setAnchor({ left, top });
    });
  };

  const select = (reaction: ReactionType) => {
    setAnchor(null);
    if (disabled) return;
    haptics.selection();
    onToggle(reaction);
  };

  return (
    <View accessibilityRole="toolbar" accessibilityLabel="Reakcje" style={styles.bar}>
      {total > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Wyświetl reakcje (${total})`}
          accessibilityState={{ disabled: summaryDisabled }}
          disabled={summaryDisabled}
          hitSlop={8}
          onPress={onOpenReactors}
          style={[styles.summary, summaryDisabled && styles.disabled]}
        >
          <View style={styles.stack} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {sortedReactions(reactions)
              .slice(0, VISIBLE_REACTION_LIMIT)
              .map(({ type, emoji }, index, visible) => (
                <View key={type} style={[styles.bubble, index < visible.length - 1 && styles.bubbleOverlap]}>
                  <Text maxFontSizeMultiplier={1} style={styles.bubbleEmoji}>
                    {emoji}
                  </Text>
                </View>
              ))}
          </View>
          <Text tabular style={styles.summaryText}>
            {total}
          </Text>
        </Pressable>
      ) : null}

      <GesturePressable
        ref={buttonRef}
        accessibilityRole="button"
        accessibilityLabel={REACTION_LABELS[selected]}
        accessibilityHint="Przytrzymaj, aby wybrać reakcję"
        accessibilityState={{ selected: myReaction !== null, disabled: Boolean(disabled), expanded: anchor !== null }}
        accessibilityActions={[{ name: 'longpress', label: 'Wybierz reakcję' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'longpress') openPicker();
        }}
        disabled={disabled}
        hitSlop={8}
        delayLongPress={LONG_PRESS_MS}
        onLongPress={openPicker}
        onPress={() => select(selected)}
        style={({ pressed }) => [
          styles.action,
          myReaction !== null ? styles.actionSelected : pressed && styles.actionPressed,
          disabled && styles.disabled,
        ]}
      >
        {myReaction ? (
          <Text maxFontSizeMultiplier={1.2} style={styles.actionEmoji}>
            {REACTION_EMOJIS[myReaction]}
          </Text>
        ) : null}
        <Text numberOfLines={1} style={[styles.actionText, myReaction !== null && styles.actionTextSelected]}>
          {REACTION_LABELS[selected]}
        </Text>
      </GesturePressable>

      <Modal transparent visible={anchor !== null} animationType="none" statusBarTranslucent onRequestClose={() => setAnchor(null)}>
        <Pressable accessibilityLabel="Zamknij wybór reakcji" style={styles.backdrop} onPress={() => setAnchor(null)} />
        {anchor ? (
          <View accessibilityRole="menu" accessibilityLabel="Wybierz reakcję" style={[styles.picker, anchor]}>
            {REACTION_TYPES.map((reaction) => (
              <Pressable
                key={reaction}
                accessibilityRole="menuitem"
                accessibilityLabel={REACTION_LABELS[reaction]}
                accessibilityState={{ selected: myReaction === reaction }}
                onPress={() => select(reaction)}
                style={({ pressed }) => [styles.option, (pressed || myReaction === reaction) && styles.optionSelected]}
              >
                <Text maxFontSizeMultiplier={1} style={styles.optionEmoji}>
                  {REACTION_EMOJIS[reaction]}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

const useStyles = createStyles(() => ({
  // `social-reaction-bar flex items-center flex-wrap`, phone gap `0.25rem 0.375rem`.
  bar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', rowGap: 4, columnGap: 6 },
  // `inline-flex items-center gap-1 rounded-full text-xs font-medium text-muted-foreground`.
  summary: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999 },
  stack: { flexDirection: 'row-reverse', alignItems: 'center' },
  // `.social-reaction-summary-stack span`: 1.15rem card circles overlapping by 0.25rem.
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
  bubbleOverlap: { marginLeft: -4 },
  bubbleEmoji: { fontSize: 11.52, lineHeight: 14 },
  summaryText: { fontSize: 12, lineHeight: 16, fontWeight: '500', color: social.mutedForeground },
  // `inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold text-muted-foreground`.
  action: { height: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 10, borderRadius: 999 },
  actionPressed: { backgroundColor: social.muted },
  // Phone `button[aria-pressed="true"]`: `bg-primary/10 text-primary`.
  actionSelected: { backgroundColor: social.primarySoft },
  actionEmoji: { fontSize: 12, lineHeight: 16 },
  actionText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: social.mutedForeground },
  actionTextSelected: { color: social.primary },
  disabled: { opacity: 0.55 },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  picker: {
    position: 'absolute',
    width: PICKER_WIDTH,
    height: PICKER_HEIGHT,
    flexDirection: 'row',
    gap: OPTION_GAP,
    padding: PICKER_PADDING,
    borderWidth: 1,
    borderColor: social.pickerBorder,
    borderRadius: 999,
    backgroundColor: social.popover,
    boxShadow: '0px 14px 36px rgba(0, 0, 0, 0.24)',
  },
  option: { width: OPTION_SIZE, height: OPTION_SIZE, borderRadius: OPTION_SIZE / 2, alignItems: 'center', justifyContent: 'center' },
  optionSelected: { backgroundColor: social.muted, transform: [{ translateY: -2.56 }, { scale: 1.12 }] },
  optionEmoji: { fontSize: 18.4, lineHeight: 22 },
}));
