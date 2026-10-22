import { useIsFocused } from 'expo-router';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { create } from 'zustand';

/**
 * Native port of the web boot splash state machine (`src/lib/boot/boot-splash.ts`).
 * The static native splash hands over to `BootOverlay`, which stays up while
 * anything holds boot (auth, the first screen's data), for at least
 * MIN_VISIBLE_MS and at most MAX_VISIBLE_MS.
 */

export type BootPhase = 'app' | 'session' | 'assets' | 'done';

const MIN_VISIBLE_MS = 700;
const REOPEN_MIN_VISIBLE_MS = 700;
const MAX_VISIBLE_MS = 9000;
const SETTLE_MS = 100;
const COMPLETE_MS = 260;
const STATUS_ROTATE_MS = 2100;
const TRICKLE_MS = 450;

export const PHASE_MESSAGES: Record<BootPhase, string[]> = {
  app: ['Przygotowujemy wszystko…', 'Rozgrzewamy silniki…'],
  session: ['Sprawdzamy, czy to na pewno Ty…', 'Łączymy się z bukmacherem…'],
  assets: [
    'Liczymy Twoje saldo…',
    'Układamy kursy…',
    'Odkurzamy Twoje kupony…',
    'Tasujemy karty…',
    'Rozkręcamy ruletkę…',
    'Ładujemy automaty…',
    'Polerujemy żetony…',
  ],
  done: ['Gotowe. Powodzenia!'],
};

interface BootState {
  /** Overlay is showing (or about to fade out). */
  visible: boolean;
  /** Fade-out has started (`.boot-splash-leaving` / `-done`). */
  leaving: boolean;
  /** The overlay was re-shown after login (`.boot-splash-reopen`). */
  reopened: boolean;
  phase: BootPhase;
  messageIndex: number;
  progress: number;
}

export const useBootStore = create<BootState>(() => ({
  visible: true,
  leaving: false,
  reopened: false,
  phase: 'app',
  messageIndex: 0,
  progress: 0.06,
}));

let shownAt = Date.now();
let minVisibleMs = MIN_VISIBLE_MS;
let appMounted = false;
let holdCount = 0;
let progressTarget = 0;
let finishTimer: ReturnType<typeof setTimeout> | undefined;
let completeTimer: ReturnType<typeof setTimeout> | undefined;
let maxTimer: ReturnType<typeof setTimeout> | undefined;
let trickleTimer: ReturnType<typeof setInterval> | undefined;
let rotateTimer: ReturnType<typeof setInterval> | undefined;
let beforeReveal: (() => Promise<unknown>) | null = null;
let nativeSplashHidden = false;

function stopTimers() {
  clearTimeout(finishTimer);
  clearTimeout(maxTimer);
  clearInterval(trickleTimer);
  clearInterval(rotateTimer);
}

function startTimers() {
  stopTimers();
  maxTimer = setTimeout(() => finish(true), MAX_VISIBLE_MS);
  trickleTimer = setInterval(() => {
    const { progress } = useBootStore.getState();
    const ceiling = Math.min(0.94, progressTarget + 0.14);
    if (progress >= ceiling) return;
    useBootStore.setState({ progress: progress + (ceiling - progress) * 0.12 });
  }, TRICKLE_MS);
  rotateTimer = setInterval(() => {
    const { phase, messageIndex } = useBootStore.getState();
    if (PHASE_MESSAGES[phase].length < 2) return;
    useBootStore.setState({ messageIndex: messageIndex + 1 });
  }, STATUS_ROTATE_MS);
}

function runBeforeRevealTask() {
  const task = beforeReveal;
  beforeReveal = null;
  if (!task) return;
  const release = holdBoot();
  void task()
    .catch((error: unknown) => console.warn('Boot task failed:', error))
    .finally(release);
}

function scheduleFinish() {
  clearTimeout(finishTimer);
  const { visible, leaving } = useBootStore.getState();
  if (!visible || leaving || !appMounted || holdCount > 0) return;
  if (beforeReveal) {
    finishTimer = setTimeout(runBeforeRevealTask, SETTLE_MS);
    return;
  }
  const remaining = minVisibleMs - (Date.now() - shownAt);
  finishTimer = setTimeout(() => finish(false), Math.max(SETTLE_MS, remaining));
}

function finish(force: boolean) {
  const { visible, leaving } = useBootStore.getState();
  if (!visible || leaving) return;
  if (!force && (holdCount > 0 || !appMounted)) return;

  stopTimers();
  if (beforeReveal) {
    const task = beforeReveal;
    beforeReveal = null;
    void task().catch(() => undefined);
  }
  progressTarget = 1;
  useBootStore.setState({ progress: 1, phase: 'done', messageIndex: 0, leaving: true });

  // The overlay fades out over its own animation, then reports `onBootOverlayHidden`.
  completeTimer = setTimeout(() => undefined, COMPLETE_MS);
}

/** Called by the overlay once its fade-out finished. */
export function onBootOverlayHidden() {
  clearTimeout(completeTimer);
  useBootStore.setState({ visible: false, leaving: false, reopened: false });
}

/** Called by the overlay on its first frame: the native splash can go. */
export function hideNativeSplash() {
  if (nativeSplashHidden) return;
  nativeSplashHidden = true;
  SplashScreen.hideAsync().catch(() => undefined);
}

/** Starts the state machine. Call once at module load of the root layout. */
export function initBoot() {
  shownAt = Date.now();
  minVisibleMs = MIN_VISIBLE_MS;
  setBootProgress(0.2);
  startTimers();
}

/** Re-show the overlay right after signing in while the app warms up. */
export function showBootSplash() {
  if (useBootStore.getState().visible) return;
  clearTimeout(completeTimer);
  shownAt = Date.now();
  minVisibleMs = REOPEN_MIN_VISIBLE_MS;
  progressTarget = 0;
  useBootStore.setState({ visible: true, leaving: false, reopened: true, progress: 0, phase: 'assets', messageIndex: 0 });
  setBootProgress(0.2);
  startTimers();
  scheduleFinish();
}

export function markAppMounted() {
  appMounted = true;
  scheduleFinish();
}

/**
 * Runs `task` once the first screen is ready (every other hold released) and
 * keeps the overlay up until it settles. Runs right away when it is gone.
 */
export function runBeforeBootReveal(task: () => Promise<unknown>) {
  if (!useBootStore.getState().visible) {
    void task().catch(() => undefined);
    return;
  }
  beforeReveal = task;
  scheduleFinish();
}

/** Keeps the overlay up until the returned release function is called. */
export function holdBoot(): () => void {
  holdCount += 1;
  clearTimeout(finishTimer);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holdCount -= 1;
    scheduleFinish();
  };
}

export function setBootProgress(value: number) {
  if (!useBootStore.getState().visible) return;
  progressTarget = Math.max(progressTarget, Math.min(value, 1));
  const { progress } = useBootStore.getState();
  useBootStore.setState({ progress: Math.max(progress, progressTarget) });
}

export function setBootPhase(phase: BootPhase) {
  const state = useBootStore.getState();
  if (!state.visible || state.phase === phase) return;
  useBootStore.setState({ phase, messageIndex: 0 });
}

export const isBootVisible = () => useBootStore.getState().visible;
export const useBootVisible = () => useBootStore((s) => s.visible);

/**
 * Holds the boot overlay while `active` and the calling screen is focused
 * (NativeTabs mounts every tab eagerly; only the visible one may hold boot).
 */
export function useBootHold(active = true) {
  const focused = useIsFocused();
  const shouldHold = active && focused;
  useEffect(() => {
    if (!shouldHold) return;
    return holdBoot();
  }, [shouldHold]);
}
