import { router } from 'expo-router';
import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { createStyles } from '@/theme';

/**
 * Web overlay shapes for `transparentModal` routes (declare them with
 * `overlayScreen` from `@/lib/sheet-options`):
 * - `dialog`: shadcn Dialog, `bg-black/80` overlay, centered card, fade + zoom-in-95, 200 ms.
 * - `drawer-right`: shadcn Sheet `side="right"`, slides in 500 ms, out 300 ms.
 * - `popover`: Radix Popover below an anchor, no dimming, fade + zoom-in-95 + slide-in-from-top-2, 150 ms.
 * Tapping outside or `useOverlayClose()` plays the exit animation, then pops the route.
 */
export type OverlayVariant = 'dialog' | 'drawer-right' | 'popover';

const TIMING: Record<OverlayVariant, { open: number; close: number }> = {
  dialog: { open: 200, close: 200 },
  'drawer-right': { open: 500, close: 300 },
  popover: { open: 150, close: 150 },
};
const EASE = Easing.bezier(0.4, 0, 0.2, 1);

/**
 * Plays the exit animation, pops the overlay route, then runs `after` (e.g. a navigation).
 * Pass `{ pop: false }` when `after` leaves the overlay itself (`router.dismissTo`).
 */
type Close = (after?: () => void, options?: { pop?: boolean }) => void;
const OverlayContext = createContext<Close | null>(null);

function finish(after?: () => void, pop = true) {
  if (pop) router.back();
  after?.();
}

/** Closes the surrounding overlay (see `Close`). */
export function useOverlayClose(): Close {
  const close = useContext(OverlayContext);
  return close ?? ((after, options) => finish(after, options?.pop));
}

interface OverlayScreenProps {
  variant: OverlayVariant;
  /** Card / panel look (width, background, border, radius, padding). Position and motion come from the variant. */
  style?: StyleProp<ViewStyle>;
  /** Popover only: window position of the card's top edge and its horizontal placement. */
  anchor?: { top: number; left: number };
  accessibilityLabel?: string;
  /** False while a write is in flight: the backdrop stops closing the overlay. */
  dismissible?: boolean;
  children: ReactNode;
}

export function OverlayScreen({
  variant,
  style,
  anchor,
  accessibilityLabel,
  dismissible = true,
  children,
}: OverlayScreenProps) {
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);
  const closing = useRef(false);
  const drawerWidth = Math.min(width * 0.86, 384);

  useEffect(() => {
    progress.set(withTiming(1, { duration: TIMING[variant].open, easing: EASE }));
  }, [progress, variant]);

  const close: Close = (after, options) => {
    if (closing.current) return;
    closing.current = true;
    const pop = options?.pop ?? true;
    progress.set(
      withTiming(0, { duration: TIMING[variant].close, easing: EASE }, (finished) => {
        if (finished) scheduleOnRN(finish, after, pop);
      }),
    );
  };

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const panelStyle = useAnimatedStyle(() => {
    const value = progress.get();
    if (variant === 'drawer-right') {
      return { transform: [{ translateX: (1 - value) * drawerWidth }] };
    }
    return {
      opacity: value,
      transform: [
        { translateY: variant === 'popover' ? interpolate(value, [0, 1], [-8, 0]) : 0 },
        { scale: interpolate(value, [0, 1], [0.95, 1]) },
      ],
    };
  });

  const panel = (
    <Animated.View
      accessibilityViewIsModal
      accessibilityLabel={accessibilityLabel}
      style={[
        variant === 'drawer-right' && [styles.drawer, { width: drawerWidth }],
        variant === 'popover' && [styles.popover, anchor],
        variant === 'dialog' && styles.dialog,
        style,
        panelStyle,
      ]}
    >
      {children}
    </Animated.View>
  );

  return (
    <OverlayContext.Provider value={close}>
      <View style={styles.root} collapsable={false}>
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, variant !== 'popover' && styles.dim, backdropStyle]}
        />
        <Pressable
          style={StyleSheet.absoluteFill}
          disabled={!dismissible}
          onPress={() => close()}
          accessibilityRole="button"
          accessibilityLabel="Zamknij"
        />
        {variant === 'dialog' ? (
          // The keyboard view animates its own paddingBottom, so the centering
          // padding lives on an inner view (web centers on the whole viewport).
          <KeyboardAvoidingView behavior="padding" pointerEvents="box-none" style={styles.root}>
            <View
              pointerEvents="box-none"
              style={[styles.center, { paddingVertical: Math.max(insets.top, insets.bottom) + 16 }]}
            >
              {panel}
            </View>
          </KeyboardAvoidingView>
        ) : (
          panel
        )}
      </View>
    </OverlayContext.Provider>
  );
}

const useStyles = createStyles(({ colors }) => ({
  root: { flex: 1 },
  dim: { backgroundColor: 'rgba(0, 0, 0, 0.8)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dialog: {
    width: '100%',
    maxHeight: '100%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    boxShadow: '0px 10px 15px -3px rgba(0, 0, 0, 0.1), 0px 4px 6px -4px rgba(0, 0, 0, 0.1)',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    borderLeftWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    boxShadow: '0px 10px 15px -3px rgba(0, 0, 0, 0.1), 0px 4px 6px -4px rgba(0, 0, 0, 0.1)',
  },
  popover: {
    position: 'absolute',
    overflow: 'hidden',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.popover,
    boxShadow: '0px 4px 6px -1px rgba(0, 0, 0, 0.1), 0px 2px 4px -2px rgba(0, 0, 0, 0.1)',
  },
}));
