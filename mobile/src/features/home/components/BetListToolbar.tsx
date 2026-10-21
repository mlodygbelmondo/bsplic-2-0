import { ChevronDown } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text as RNText, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, Keyframe, type AnimatedStyle } from 'react-native-reanimated';

import { haptics } from '@/lib/haptics';
import { alpha, createStyles, useTheme } from '@/theme';
import { PressScale } from '@/ui';
import type { Category } from '@/types/database';
import { SORT_OPTIONS, type SortMode } from '../logic/sort-bets';

export type FilterPanel = 'sort' | 'category';

/** `pt-2` + `h-11` trigger + `pb-2`: the box that slides away on scroll. */
export const TOOLBAR_HEIGHT = 60;
/** Toolbar plus its `mb-2.5`: where the list content starts. */
export const TOOLBAR_SPACE = TOOLBAR_HEIGHT + 10;

const MAX_FONT_SCALE = 1.35;
const SHADOW_MD = '0px 4px 6px -1px rgba(0, 0, 0, 0.1), 0px 2px 4px -2px rgba(0, 0, 0, 0.1)';

/** `filter-option-enter`: 220 ms, 28 ms cascade. */
function makeOptionEntering(index: number) {
  return new Keyframe({
    0: { opacity: 0, transform: [{ translateY: -8 }, { scale: 0.94 }] },
    100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }], easing: Easing.bezier(0.16, 1, 0.3, 1) },
  })
    .duration(220)
    .delay(index * 28);
}

const optionEnterings = new Map<number, ReturnType<typeof makeOptionEntering>>();
function optionEntering(index: number) {
  let keyframe = optionEnterings.get(index);
  if (!keyframe) {
    keyframe = makeOptionEntering(index);
    optionEnterings.set(index, keyframe);
  }
  return keyframe;
}

interface BetListToolbarProps {
  style: StyleProp<AnimatedStyle<StyleProp<ViewStyle>>>;
  panel: FilterPanel | null;
  onTogglePanel: (panel: FilterPanel) => void;
  onClosePanel: () => void;
  sort: SortMode;
  onSelectSort: (sort: SortMode) => void;
  activeOnly: boolean;
  onToggleActiveOnly: () => void;
  selectedCategory: string | null;
  categories: Category[];
  categoryMap: Record<string, Category>;
  onSelectCategory: (id: string | null) => void;
  /** Marks touches that start inside the toolbar, so the screen does not treat them as outside taps. */
  onTouchInside: () => void;
}

/**
 * Phone toolbar of the web `BetList`: sort and category pills that open
 * floating option stacks over the list. Positioned over the list and moved by
 * the parent (hidden on scroll, follows pull-to-refresh).
 */
export function BetListToolbar({
  style,
  panel,
  onTogglePanel,
  onClosePanel,
  sort,
  onSelectSort,
  activeOnly,
  onToggleActiveOnly,
  selectedCategory,
  categories,
  categoryMap,
  onSelectCategory,
  onTouchInside,
}: BetListToolbarProps) {
  const styles = useStyles();
  const { height: windowHeight } = useWindowDimensions();
  const panelMaxHeight = { maxHeight: Math.round(windowHeight * 0.55) };
  const selected = selectedCategory ? categoryMap[selectedCategory] : undefined;
  const sortLabel = SORT_OPTIONS.find((option) => option.value === sort)?.label ?? 'Sortowanie';

  return (
    <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, style]}>
      <View pointerEvents="box-none" style={styles.triggerRow} onTouchStart={onTouchInside}>
        <FilterTrigger open={panel === 'sort'} onPress={() => onTogglePanel('sort')}>
          <View style={styles.triggerLabel}>
            {activeOnly ? <View style={[styles.dot, styles.dotOn]} /> : null}
            <RNText maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={1} style={styles.triggerText}>
              {sortLabel}
            </RNText>
          </View>
        </FilterTrigger>
        <FilterTrigger open={panel === 'category'} onPress={() => onTogglePanel('category')}>
          <RNText maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={1} style={[styles.triggerText, styles.shrink]}>
            {selected ? `${selected.emoji} ${selected.name}` : '🌐 Wszystkie'}
          </RNText>
        </FilterTrigger>
      </View>

      <View pointerEvents="box-none" style={styles.panelRow} onTouchStart={onTouchInside}>
        <View pointerEvents="box-none" style={styles.panelColumn}>
          {panel === 'sort' ? (
            <FilterPanelList maxHeight={panelMaxHeight}>
              {SORT_OPTIONS.map((option, index) => (
                <FilterOption
                  key={option.value}
                  index={index}
                  label={option.label}
                  selected={sort === option.value}
                  onPress={() => {
                    onSelectSort(option.value);
                    onClosePanel();
                  }}
                />
              ))}
              <FilterOption
                index={SORT_OPTIONS.length}
                label="Aktywne"
                selected={activeOnly}
                toggle
                onPress={onToggleActiveOnly}
              />
            </FilterPanelList>
          ) : null}
        </View>
        <View pointerEvents="box-none" style={styles.panelColumn}>
          {panel === 'category' ? (
            <FilterPanelList maxHeight={panelMaxHeight}>
              <FilterOption
                index={0}
                label="🌐 Wszystkie"
                selected={!selectedCategory}
                onPress={() => {
                  onSelectCategory(null);
                  onClosePanel();
                }}
              />
              {categories.map((category, index) => (
                <FilterOption
                  key={category.id}
                  index={index + 1}
                  label={`${category.emoji} ${category.name}`}
                  selected={selectedCategory === category.id}
                  onPress={() => {
                    onSelectCategory(category.id);
                    onClosePanel();
                  }}
                />
              ))}
            </FilterPanelList>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}

function FilterTrigger({ open, onPress, children }: { open: boolean; onPress: () => void; children: ReactNode }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      onPress={onPress}
      style={[styles.trigger, open ? styles.triggerOpen : styles.triggerClosed]}
    >
      {children}
      <Animated.View
        style={{
          transform: [{ rotate: open ? '180deg' : '0deg' }],
          transitionProperty: 'transform',
          transitionDuration: 200,
        }}
      >
        <ChevronDown size={16} color={colors.mutedForeground} />
      </Animated.View>
    </PressScale>
  );
}

function FilterPanelList({ maxHeight, children }: { maxHeight: ViewStyle; children: ReactNode }) {
  const styles = useStyles();
  return (
    <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)}>
      <ScrollView
        style={maxHeight}
        contentContainerStyle={styles.panelContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </Animated.View>
  );
}

function FilterOption({
  index,
  label,
  selected,
  toggle,
  onPress,
}: {
  index: number;
  label: string;
  selected: boolean;
  /** The Aktywne switch (`aria-pressed`), which keeps the panel open. */
  toggle?: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <Animated.View entering={optionEntering(index)}>
      <PressScale
        accessibilityRole={toggle ? 'togglebutton' : 'button'}
        accessibilityState={toggle ? { checked: selected } : { selected }}
        onPress={() => {
          haptics.selection();
          onPress();
        }}
        style={[styles.option, selected ? styles.optionSelected : styles.optionIdle]}
      >
        {toggle ? <View style={[styles.dot, selected ? styles.dotOn : styles.dotOff]} /> : null}
        <RNText
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          numberOfLines={1}
          style={[
            styles.optionText,
            selected ? styles.optionTextSelected : toggle ? styles.optionTextMuted : styles.optionTextIdle,
          ]}
        >
          {label}
        </RNText>
      </PressScale>
    </Animated.View>
  );
}

const PILL_TEXT = { fontFamily: 'Inter', fontSize: 14, lineHeight: 18, fontWeight: '600' } as const;

const useStyles = createStyles(({ colors }) => ({
  triggerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 12,
  },
  trigger: {
    flex: 1,
    minWidth: 0,
    height: 44,
    borderRadius: 9999,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  triggerOpen: { borderColor: alpha(colors.foreground, 0.4), backgroundColor: colors.card, boxShadow: SHADOW_MD },
  triggerClosed: { borderColor: colors.border, backgroundColor: alpha(colors.card, 0.8) },
  triggerLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, minWidth: 0 },
  triggerText: { ...PILL_TEXT, color: colors.foreground, flexShrink: 1 },
  shrink: { flexShrink: 1 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotOn: { backgroundColor: colors.success },
  dotOff: { backgroundColor: alpha(colors.mutedForeground, 0.5) },
  panelRow: {
    position: 'absolute',
    top: TOOLBAR_HEIGHT,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  panelColumn: { flex: 1, minWidth: 0 },
  panelContent: { gap: 6 },
  option: {
    height: 44,
    borderRadius: 9999,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  optionSelected: { backgroundColor: colors.foreground, borderColor: 'transparent', boxShadow: SHADOW_MD },
  optionIdle: { backgroundColor: colors.card, borderColor: colors.border },
  optionText: { ...PILL_TEXT, flexShrink: 1 },
  optionTextSelected: { color: colors.background },
  optionTextIdle: { color: colors.foreground },
  optionTextMuted: { color: colors.mutedForeground },
}));
