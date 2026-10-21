import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  GestureDetector,
  GestureHandlerRootView,
  useCompetingGestures,
  useLongPressGesture,
  usePanGesture,
  useTapGesture,
} from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import { useAppActive } from '@/lib/focus';
import { alpha, createStyles, useTheme } from '@/theme';
import type { SocialStory } from '@/types/database';
import { Text } from '@/ui';
import { socialStoriesQuery } from '../api/queries';
import { getSocialImageUrl } from '../images';
import { parseSocialContent } from '../lib/content';
import {
  formatStoryAge,
  formatStoryTimeLeft,
  getActiveStories,
  resolveStoryIndex,
  STORY_CLOCK_MS,
  STORY_VIEW_MS,
} from './storyFormat';
import { StoryImage } from './StoryImage';

/** Web tap zones skip the top and bottom 6rem (`inset-y-24`). */
const TAP_ZONE_INSET = 96;
/** Native additions: hold to pause, swipe down to close. */
const HOLD_TO_PAUSE_MS = 200;
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 1000;
const SPRING = { damping: 22, stiffness: 240 } as const;

const close = () => {
  if (router.canGoBack()) router.back();
};

/**
 * `/sheets/story-viewer?index=&id=`: web `StoryViewer` full screen. Each story
 * runs 7 s, tap the left/right third to go back/forward, the last story
 * closes. Native: hold to pause, swipe down to close, paused in the
 * background. The progress runs on the UI thread.
 */
export function StoryViewerScreen() {
  const styles = useStyles();
  const params = useLocalSearchParams<{ index?: string; id?: string }>();
  // The strip's cached list; opening the viewer does not refetch it.
  const { data: stories } = useQuery({ ...socialStoriesQuery(), refetchOnMount: false });
  const [now, setNow] = useState(() => Date.now());
  const active = getActiveStories(stories ?? [], now);
  const [index, setIndex] = useState(() =>
    resolveStoryIndex(getActiveStories(stories ?? [], Date.now()), params.id, Number(params.index ?? 0)),
  );
  // Web clamps the index when the list shrinks while open.
  const storyIndex = Math.min(index, Math.max(0, active.length - 1));
  const story: SocialStory | undefined = active[storyIndex];

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), STORY_CLOCK_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!story) close();
  }, [story]);

  if (!story) return <View collapsable={false} style={styles.root} />;

  return (
    <StoryPlayer
      stories={active}
      storyIndex={storyIndex}
      now={now}
      onIndexChange={setIndex}
    />
  );
}

function StoryPlayer({
  stories,
  storyIndex,
  now,
  onIndexChange,
}: {
  stories: SocialStory[];
  storyIndex: number;
  now: number;
  onIndexChange: (index: number) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const screen = useWindowDimensions();
  const appActive = useAppActive();
  const [holding, setHolding] = useState(false);
  const [dragging, setDragging] = useState(false);
  const progress = useSharedValue(0);
  const dragY = useSharedValue(0);
  const shownStoryRef = useRef<string | null>(null);

  const story = stories[storyIndex]!;
  const storyCount = stories.length;
  const parsed = parseSocialContent(story.content);
  const imageUrl = parsed.imagePath ? getSocialImageUrl(parsed.imagePath) : null;
  const text = parsed.text.trim();
  const nextStory = stories[storyIndex + 1];
  const nextImagePath = nextStory ? parseSocialContent(nextStory.content).imagePath : null;

  const goTo = (nextIndex: number) => {
    progress.set(0);
    onIndexChange(nextIndex);
  };
  const goPrevious = () => {
    if (storyIndex > 0) goTo(storyIndex - 1);
  };
  const goNext = () => {
    if (storyIndex < storyCount - 1) goTo(storyIndex + 1);
    else close();
  };

  // 7 s per story on the UI thread; paused while held, dragged or in the background.
  const running = !holding && !dragging && appActive;
  useEffect(() => {
    const fromStart = shownStoryRef.current !== story.id;
    shownStoryRef.current = story.id;
    if (!running) {
      cancelAnimation(progress);
      if (fromStart) progress.set(0);
      return;
    }
    const onFinished = storyIndex < storyCount - 1 ? () => onIndexChange(storyIndex + 1) : close;
    scheduleOnUI(
      (reset: boolean) => {
        'worklet';
        if (reset) progress.set(0);
        const remaining = Math.max(0, 1 - progress.get()) * STORY_VIEW_MS;
        progress.set(
          withTiming(1, { duration: remaining, easing: Easing.linear }, (finished) => {
            'worklet';
            if (finished) scheduleOnRN(onFinished);
          }),
        );
      },
      fromStart,
    );
    return () => cancelAnimation(progress);
  }, [running, story.id, storyIndex, storyCount, progress, onIndexChange]);

  // Warm the next photo so the switch is instant.
  useEffect(() => {
    if (nextImagePath) void Image.prefetch(getSocialImageUrl(nextImagePath)).catch(() => undefined);
  }, [nextImagePath]);

  const handleTap = (x: number, y: number) => {
    if (y < TAP_ZONE_INSET || y > screen.height - TAP_ZONE_INSET) return;
    // Web renders each zone only when there is a story on that side.
    if (x < screen.width / 3) goPrevious();
    else if (x > (screen.width * 2) / 3 && storyIndex < storyCount - 1) goNext();
  };

  const tap = useTapGesture({
    maxDuration: HOLD_TO_PAUSE_MS,
    onActivate: (event) => {
      'worklet';
      scheduleOnRN(handleTap, event.x, event.y);
    },
  });

  const hold = useLongPressGesture({
    minDuration: HOLD_TO_PAUSE_MS,
    onActivate: () => {
      'worklet';
      cancelAnimation(progress);
      scheduleOnRN(setHolding, true);
    },
    onFinalize: () => {
      'worklet';
      scheduleOnRN(setHolding, false);
    },
  });

  const pan = usePanGesture({
    activeOffsetY: 12,
    failOffsetX: [-24, 24],
    onActivate: () => {
      'worklet';
      cancelAnimation(progress);
      scheduleOnRN(setDragging, true);
    },
    onUpdate: (event) => {
      'worklet';
      dragY.set(Math.max(0, event.translationY));
    },
    onDeactivate: (event) => {
      'worklet';
      if (event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY) {
        dragY.set(withTiming(screen.height, { duration: 180 }));
        scheduleOnRN(close);
        return;
      }
      dragY.set(withSpring(0, SPRING));
    },
    onFinalize: () => {
      'worklet';
      scheduleOnRN(setDragging, false);
    },
  });

  const gesture = useCompetingGestures(pan, hold, tap);

  const contentStyle = useAnimatedStyle(() => {
    const pulled = Math.min(1, dragY.get() / screen.height);
    return {
      borderRadius: pulled > 0 ? 24 : 0,
      transform: [{ translateY: dragY.get() }, { scale: 1 - pulled * 0.12 }],
    };
  });

  return (
    // Own gesture root: the viewer is a native modal presented outside the app's root view.
    <GestureHandlerRootView collapsable={false} style={styles.root} accessibilityViewIsModal>
      <StatusBar style="light" />
      <Animated.View style={[styles.content, contentStyle]}>
        <GestureDetector gesture={gesture}>
          <Animated.View
            style={StyleSheet.absoluteFill}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={`Relacja ${story.username}`}
            accessibilityValue={{ text: text || undefined }}
            accessibilityActions={[
              { name: 'increment', label: 'Następna relacja' },
              { name: 'decrement', label: 'Poprzednia relacja' },
            ]}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === 'increment') goNext();
              if (event.nativeEvent.actionName === 'decrement') goPrevious();
            }}
          >
            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                cachePolicy="memory-disk"
                recyclingKey={story.id}
              />
            ) : (
              <View style={styles.gradient} />
            )}
            <View style={styles.overlay} />
            {text ? (
              <View pointerEvents="none" style={[styles.textWrap, { bottom: 32 + insets.bottom }]}>
                <Text maxFontSizeMultiplier={1.2} style={styles.text}>
                  {text}
                </Text>
              </View>
            ) : null}
          </Animated.View>
        </GestureDetector>

        <View pointerEvents="box-none" style={[styles.top, { top: 12 + insets.top }]}>
          <View pointerEvents="none" style={styles.bars}>
            {Array.from({ length: storyCount }, (_, barIndex) => (
              <View key={barIndex} style={styles.track}>
                {barIndex < storyIndex ? <View style={styles.barFill} /> : null}
                {barIndex === storyIndex ? <ProgressFill progress={progress} /> : null}
              </View>
            ))}
          </View>

          <View pointerEvents="box-none" style={styles.header}>
            <View style={styles.avatarRing}>
              <View style={styles.avatar}>
                <StoryImage username={story.username} avatarUrl={story.avatar_url ?? null} primary={colors.primary} />
              </View>
            </View>
            <View pointerEvents="none" style={styles.headerText}>
              <Text numberOfLines={1} style={styles.username}>
                {story.username}
              </Text>
              <Text numberOfLines={1} style={styles.meta}>
                {formatStoryAge(story.created_at, now)} · {formatStoryTimeLeft(story.expires_at, now)}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Zamknij relację"
              hitSlop={4}
              onPress={close}
              style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
            >
              <X size={20} color="#ffffff" />
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </GestureHandlerRootView>
  );
}

/** Current bar: `social-story-progress` (scaleX 0 → 1 from the left). */
function ProgressFill({ progress }: { progress: SharedValue<number> }) {
  const styles = useStyles();
  const style = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.get() }] }));
  return <Animated.View style={[styles.barFill, styles.barProgress, style]} />;
}

// The viewer dialog sits outside the phone Social palette, so `--primary` is the app theme's.
const useStyles = createStyles(({ colors }) => ({
  // `bg-neutral-950`.
  root: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { flex: 1, overflow: 'hidden', backgroundColor: '#0a0a0a' },
  // `radial-gradient(circle_at_28%_20%, primary/0.9, transparent_32%), linear-gradient(150deg, …)`.
  gradient: {
    ...StyleSheet.absoluteFill,
    backgroundImage: `radial-gradient(circle at 28% 20%, ${alpha(colors.primary, 0.9)} 0%, ${alpha(colors.primary, 0)} 32%), linear-gradient(150deg, #160707 0%, #451010 52%, #09090b 100%)`,
  },
  // `bg-gradient-to-b from-black/72 via-black/18 to-black/78`.
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundImage: 'linear-gradient(180deg, rgba(0, 0, 0, 0.72) 0%, rgba(0, 0, 0, 0.18) 50%, rgba(0, 0, 0, 0.78) 100%)',
  },
  // `absolute left-3 right-3 top-[calc(0.75rem+safe-area)] z-10`.
  top: { position: 'absolute', left: 12, right: 12, zIndex: 10 },
  // `mb-3 grid gap-1`, one column per story.
  bars: { flexDirection: 'row', gap: 4, marginBottom: 12 },
  // `h-1 overflow-hidden rounded-full bg-white/35`.
  track: { flex: 1, height: 4, overflow: 'hidden', borderRadius: 999, backgroundColor: 'rgba(255, 255, 255, 0.35)' },
  barFill: { ...StyleSheet.absoluteFill, borderRadius: 999, backgroundColor: '#ffffff' },
  barProgress: { transformOrigin: 'left' },
  // `flex items-center gap-3`.
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  // `ring-2 ring-primary` around the 2.5rem avatar.
  avatarRing: { width: 40, height: 40, borderRadius: 20, boxShadow: `0px 0px 0px 2px ${colors.primary}` },
  avatar: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden' },
  headerText: { flex: 1, minWidth: 0 },
  // `text-sm font-bold leading-tight`.
  username: { fontSize: 14, lineHeight: 17.5, fontWeight: '700', color: '#ffffff' },
  // `text-xs font-medium text-white/72`.
  meta: { fontSize: 12, lineHeight: 16, fontWeight: '500', color: 'rgba(255, 255, 255, 0.72)' },
  // `h-10 w-10 rounded-full bg-black/30`.
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  closePressed: { backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  // `absolute inset-x-5 bottom-[calc(2rem+safe-area)] z-20`.
  textWrap: { position: 'absolute', left: 20, right: 20, zIndex: 20, alignItems: 'center' },
  // `max-w-[18rem] whitespace-pre-wrap text-center text-2xl font-black leading-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)]`.
  text: {
    maxWidth: 288,
    textAlign: 'center',
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
}));
