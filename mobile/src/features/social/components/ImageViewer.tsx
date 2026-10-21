import { Image, type ImageLoadEventData } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import {
  GestureDetector,
  GestureHandlerRootView,
  useCompetingGestures,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
} from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withDecay, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { createStyles } from '@/theme';

const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 1000;
const SPRING = { damping: 22, stiffness: 240 } as const;

interface Size {
  width: number;
  height: number;
}

/** Size of an image drawn with `contentFit="contain"` into the screen. */
function containSize(image: Size | null, screen: Size): Size {
  if (!image) return screen;
  const ratio = Math.min(screen.width / image.width, screen.height / image.height);
  return { width: image.width * ratio, height: image.height * ratio };
}

const close = () => {
  if (router.canGoBack()) router.back();
};

/**
 * `/sheets/image-viewer?uri=` — full-screen photo viewer for post and comment
 * images: pinch and double-tap zoom, pan while zoomed, swipe down to close.
 * Gestures and motion run on the UI thread.
 */
export function ImageViewer() {
  const styles = useStyles();
  const { uri } = useLocalSearchParams<{ uri?: string }>();
  const screen = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [natural, setNatural] = useState<Size | null>(null);
  const fitted = containSize(natural, screen);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const dismissY = useSharedValue(0);

  const maxOffset = (nextScale: number) => {
    'worklet';
    return {
      x: Math.max(0, (fitted.width * nextScale - screen.width) / 2),
      y: Math.max(0, (fitted.height * nextScale - screen.height) / 2),
    };
  };

  const clamp = (value: number, limit: number) => {
    'worklet';
    return Math.min(limit, Math.max(-limit, value));
  };

  const settle = () => {
    'worklet';
    if (scale.get() <= 1) {
      scale.set(withSpring(1, SPRING));
      translateX.set(withSpring(0, SPRING));
      translateY.set(withSpring(0, SPRING));
      savedScale.set(1);
      savedX.set(0);
      savedY.set(0);
      return;
    }
    const nextScale = Math.min(scale.get(), MAX_SCALE);
    const limit = maxOffset(nextScale);
    const nextX = clamp(translateX.get(), limit.x);
    const nextY = clamp(translateY.get(), limit.y);
    scale.set(withSpring(nextScale, SPRING));
    translateX.set(withSpring(nextX, SPRING));
    translateY.set(withSpring(nextY, SPRING));
    savedScale.set(nextScale);
    savedX.set(nextX);
    savedY.set(nextY);
  };

  // Start from where the image is now (a decay or spring may still be running).
  const captureStart = () => {
    'worklet';
    savedScale.set(scale.get());
    savedX.set(translateX.get());
    savedY.set(translateY.get());
  };

  const pinch = usePinchGesture({
    onActivate: () => {
      'worklet';
      captureStart();
    },
    onUpdate: (event) => {
      'worklet';
      const nextScale = Math.min(MAX_SCALE * 1.2, Math.max(0.6, savedScale.get() * event.scale));
      const factor = nextScale / savedScale.get();
      // Keep the point under the fingers in place.
      const focalX = event.focalX - screen.width / 2;
      const focalY = event.focalY - screen.height / 2;
      scale.set(nextScale);
      translateX.set(focalX - (focalX - savedX.get()) * factor);
      translateY.set(focalY - (focalY - savedY.get()) * factor);
    },
    onDeactivate: () => {
      'worklet';
      settle();
    },
  });

  const pan = usePanGesture({
    maxPointers: 1,
    onActivate: () => {
      'worklet';
      if (savedScale.get() > 1) captureStart();
    },
    onUpdate: (event) => {
      'worklet';
      if (savedScale.get() > 1) {
        translateX.set(savedX.get() + event.translationX);
        translateY.set(savedY.get() + event.translationY);
      } else {
        dismissY.set(event.translationY);
      }
    },
    onDeactivate: (event) => {
      'worklet';
      if (savedScale.get() > 1) {
        const limit = maxOffset(savedScale.get());
        translateX.set(withDecay({ velocity: event.velocityX, clamp: [-limit.x, limit.x] }));
        translateY.set(withDecay({ velocity: event.velocityY, clamp: [-limit.y, limit.y] }));
        return;
      }
      if (Math.abs(event.translationY) > DISMISS_DISTANCE || Math.abs(event.velocityY) > DISMISS_VELOCITY) {
        const direction = event.translationY < 0 ? -1 : 1;
        dismissY.set(withTiming(direction * screen.height, { duration: 180 }));
        scheduleOnRN(close);
        return;
      }
      dismissY.set(withSpring(0, SPRING));
    },
  });

  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    onActivate: (event) => {
      'worklet';
      if (savedScale.get() > 1) {
        scale.set(withTiming(1));
        translateX.set(withTiming(0));
        translateY.set(withTiming(0));
        savedScale.set(1);
        savedX.set(0);
        savedY.set(0);
        return;
      }
      const limit = maxOffset(DOUBLE_TAP_SCALE);
      const nextX = clamp(-(event.x - screen.width / 2) * (DOUBLE_TAP_SCALE - 1), limit.x);
      const nextY = clamp(-(event.y - screen.height / 2) * (DOUBLE_TAP_SCALE - 1), limit.y);
      scale.set(withTiming(DOUBLE_TAP_SCALE));
      translateX.set(withTiming(nextX));
      translateY.set(withTiming(nextY));
      savedScale.set(DOUBLE_TAP_SCALE);
      savedX.set(nextX);
      savedY.set(nextY);
    },
  });

  const zoomAndPan = useSimultaneousGestures(pinch, pan);
  const gesture = useCompetingGestures(doubleTap, zoomAndPan);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(1, Math.abs(dismissY.get()) / (screen.height * 0.6)),
  }));
  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.get() },
      { translateY: translateY.get() + dismissY.get() },
      { scale: scale.get() },
    ],
  }));

  const handleLoad = (event: ImageLoadEventData) => {
    if (event.source.width > 0 && event.source.height > 0) {
      setNatural({ width: event.source.width, height: event.source.height });
    }
  };

  return (
    // Own gesture root: the viewer is a native modal presented outside the app's root view.
    <GestureHandlerRootView collapsable={false} style={styles.root}>
      <StatusBar style="light" />
      <Animated.View pointerEvents="none" style={[styles.backdrop, backdropStyle]} />
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.stage, imageStyle]}>
          {uri ? (
            <Image
              source={{ uri }}
              style={styles.image}
              contentFit="contain"
              cachePolicy="memory-disk"
              accessibilityLabel="Zdjęcie"
              onLoad={handleLoad}
            />
          ) : null}
        </Animated.View>
      </GestureDetector>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Zamknij"
        hitSlop={8}
        onPress={close}
        style={({ pressed }) => [styles.close, { top: insets.top + 8 }, pressed && styles.closePressed]}
      >
        <X size={22} color="#ffffff" />
      </Pressable>
    </GestureHandlerRootView>
  );
}

const useStyles = createStyles(() => ({
  root: { flex: 1, backgroundColor: 'transparent' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0, 0, 0, 0.96)' },
  stage: { flex: 1 },
  image: { flex: 1 },
  close: {
    position: 'absolute',
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  closePressed: { backgroundColor: 'rgba(255, 255, 255, 0.24)' },
}));
