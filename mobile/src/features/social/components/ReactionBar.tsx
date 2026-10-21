import { ThumbsUp } from 'lucide-react-native';
import { useRef, useState, type ComponentRef } from 'react';
import { Modal, Pressable, useWindowDimensions, View } from 'react-native';
import { Pressable as GesturePressable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptics } from '@/lib/haptics';
import { createStyles } from '@/theme';
import { Text } from '@/ui';
import { REACTION_EMOJIS, REACTION_LABELS, REACTION_TYPES, type ReactionType } from '../lib/reactions';
import { social } from './socialColors';

/** Web `LONG_PRESS_MS`: a touch held this long opens the picker instead of toggling. */
const LONG_PRESS_MS = 500;

// `.social-reaction-picker`: 2rem options, 0.2rem gap, 0.3rem padding, 1px border.
const OPTION_SIZE = 32;
const OPTION_GAP = 3.2;
const PICKER_PADDING = 4.8;
const PICKER_WIDTH = REACTION_TYPES.length * OPTION_SIZE + (REACTION_TYPES.length - 1) * OPTION_GAP + PICKER_PADDING * 2 + 2;
const PICKER_HEIGHT = OPTION_SIZE + PICKER_PADDING * 2 + 2;
/** `bottom: calc(100% + 0.35rem)`. */
const PICKER_OFFSET = 5.6;
const SCREEN_MARGIN = 8;

interface PickerAnchor {
  left: number;
  top: number;
}

/**
 * Phone reaction control (web `ReactionBar` with `showSummary={false}` and
 * `showActionIcon`): a tap toggles the current reaction (or 👍), a 500 ms
 * long press opens the emoji picker above the button.
 */
export function ReactionBar({
  myReaction,
  onToggle,
  disabled,
}: {
  myReaction: ReactionType | null;
  onToggle: (emoji: ReactionType) => void;
  disabled?: boolean;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const buttonRef = useRef<ComponentRef<typeof View>>(null);
  const [anchor, setAnchor] = useState<PickerAnchor | null>(null);
  const selected = myReaction ?? 'like';
  const label = REACTION_LABELS[selected];

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
    <View style={styles.wrap}>
      <GesturePressable
        ref={buttonRef}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Przytrzymaj, aby wybrać reakcję"
        accessibilityState={{ selected: myReaction !== null, disabled: Boolean(disabled), expanded: anchor !== null }}
        accessibilityActions={[{ name: 'longpress', label: 'Wybierz reakcję' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'longpress') openPicker();
        }}
        disabled={disabled}
        delayLongPress={LONG_PRESS_MS}
        onLongPress={openPicker}
        onPress={() => select(selected)}
        style={({ pressed }) => [
          styles.button,
          myReaction !== null ? styles.buttonPressed : pressed && styles.buttonActive,
          disabled && styles.disabled,
        ]}
      >
        {myReaction ? (
          <Text maxFontSizeMultiplier={1.2} style={styles.emoji}>
            {REACTION_EMOJIS[myReaction]}
          </Text>
        ) : (
          <ThumbsUp size={16} color={social.mutedForeground} />
        )}
        <Text numberOfLines={1} style={[styles.label, myReaction !== null && styles.labelActive]}>
          {label}
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
  // `.social-mobile-reaction-control`: fills its grid column.
  wrap: { flex: 1, minWidth: 0 },
  // `.social-mobile-action-button` (h 2.35rem, radius 0.375rem, gap 0.35rem) with `px-2.5`.
  button: {
    height: 37.6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5.6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  buttonActive: { backgroundColor: social.muted },
  // `button[aria-pressed="true"]`: primary/10 background, primary text.
  buttonPressed: { backgroundColor: social.primarySoft },
  disabled: { opacity: 0.55 },
  emoji: { fontSize: 13.44, lineHeight: 17 },
  label: { flexShrink: 1, fontSize: 13.44, lineHeight: 17, fontWeight: '700', color: social.mutedForeground },
  labelActive: { color: social.primary },
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
  option: {
    width: OPTION_SIZE,
    height: OPTION_SIZE,
    borderRadius: OPTION_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // `:hover, .is-selected`: muted background, lifted and scaled 1.12.
  optionSelected: { backgroundColor: social.muted, transform: [{ translateY: -2.56 }, { scale: 1.12 }] },
  optionEmoji: { fontSize: 18.4, lineHeight: 22 },
}));
