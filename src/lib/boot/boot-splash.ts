// Controls the static boot splash rendered by index.html (#initial-splash).
// The splash stays up until React has mounted, every boot hold has been
// released and a minimum display time has passed, so the app appears once
// instead of flashing through intermediate full-page loaders.

export type BootPhase = "app" | "session" | "assets" | "done";

const SPLASH_ID = "initial-splash";
const MIN_VISIBLE_MS = 1000;
const REOPEN_MIN_VISIBLE_MS = 900;
const MAX_VISIBLE_MS = 9000;
const SETTLE_MS = 160;
const COMPLETE_MS = 260;
const FADE_OUT_MS = 480;
const STATUS_ROTATE_MS = 2100;
const TRICKLE_MS = 450;

const PHASE_MESSAGES: Record<BootPhase, string[]> = {
  app: ["Przygotowujemy wszystko…", "Rozgrzewamy silniki…"],
  session: ["Sprawdzamy, czy to na pewno Ty…", "Łączymy się z bukmacherem…"],
  assets: [
    "Liczymy Twoje saldo…",
    "Układamy kursy…",
    "Odkurzamy Twoje kupony…",
    "Tasujemy karty…",
    "Rozkręcamy ruletkę…",
    "Ładujemy automaty…",
    "Polerujemy żetony…",
  ],
  done: ["Gotowe. Powodzenia!"],
};

let splash: HTMLElement | null = null;
let visible = false;
let shownAt = 0;
let minVisibleMs = MIN_VISIBLE_MS;
let appMounted = false;
let holdCount = 0;
let progress = 0;
let progressTarget = 0;
let phase: BootPhase = "app";
let messageIndex = 0;
let finishTimer: number | undefined;
let completeTimer: number | undefined;
let removeTimer: number | undefined;
let maxTimer: number | undefined;
let trickleTimer: number | undefined;
let rotateTimer: number | undefined;
let beforeReveal: (() => Promise<unknown>) | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function renderProgress() {
  if (!splash) return;
  splash.style.setProperty("--boot-progress", progress.toFixed(3));
}

function renderStatus() {
  const status = splash?.querySelector<HTMLElement>("[data-boot-status]");
  if (!status) return;
  const messages = PHASE_MESSAGES[phase];
  status.textContent = messages[messageIndex % messages.length];
  status.animate?.(
    [
      { opacity: 0, transform: "translateY(4px)" },
      { opacity: 1, transform: "none" },
    ],
    { duration: 260, easing: "ease-out" },
  );
}

function stopTimers() {
  window.clearTimeout(finishTimer);
  window.clearTimeout(maxTimer);
  window.clearInterval(trickleTimer);
  window.clearInterval(rotateTimer);
}

function startTimers() {
  stopTimers();
  maxTimer = window.setTimeout(() => finish(true), MAX_VISIBLE_MS);
  // Creep towards the next milestone so the bar never looks frozen while a
  // network request is in flight.
  trickleTimer = window.setInterval(() => {
    const ceiling = Math.min(0.94, progressTarget + 0.14);
    if (progress >= ceiling) return;
    progress += (ceiling - progress) * 0.12;
    renderProgress();
  }, TRICKLE_MS);
  rotateTimer = window.setInterval(() => {
    if (PHASE_MESSAGES[phase].length < 2) return;
    messageIndex += 1;
    renderStatus();
  }, STATUS_ROTATE_MS);
}

function runBeforeRevealTask() {
  const task = beforeReveal;
  beforeReveal = null;
  if (!task) return;
  const release = holdBoot();
  void task()
    .catch((error: unknown) => {
      console.warn("Boot task failed:", error);
    })
    .finally(release);
}

function scheduleFinish() {
  window.clearTimeout(finishTimer);
  if (!visible || !appMounted || holdCount > 0) return;
  if (beforeReveal) {
    finishTimer = window.setTimeout(runBeforeRevealTask, SETTLE_MS);
    return;
  }
  const remaining = minVisibleMs - (performance.now() - shownAt);
  finishTimer = window.setTimeout(
    () => finish(false),
    Math.max(SETTLE_MS, remaining),
  );
}

function finish(force: boolean) {
  if (!visible || !splash) return;
  if (!force && (holdCount > 0 || !appMounted)) return;

  const element = splash;
  visible = false;
  stopTimers();
  // A forced finish skips the wait, not the work.
  if (beforeReveal) {
    const task = beforeReveal;
    beforeReveal = null;
    void task().catch(() => undefined);
  }
  progress = 1;
  progressTarget = 1;
  renderProgress();
  phase = "done";
  messageIndex = 0;
  renderStatus();
  element.classList.remove("boot-splash-reopen");
  element.classList.add("boot-splash-leaving");
  notify();

  completeTimer = window.setTimeout(() => {
    element.classList.add("boot-splash-done");
    removeTimer = window.setTimeout(() => element.remove(), FADE_OUT_MS);
  }, COMPLETE_MS);
}

/** Call once before the first React render. */
export function initBootSplash() {
  splash = document.getElementById(SPLASH_ID);
  if (!splash) return;

  visible = true;
  // performance.now() counts from navigation start, which is when the
  // splash first appeared.
  shownAt = 0;
  minVisibleMs = MIN_VISIBLE_MS;
  setBootProgress(0.2);
  startTimers();
}

/** Re-show the splash, e.g. right after signing in, while the app warms up. */
export function showBootSplash() {
  if (visible || !splash) return;

  window.clearTimeout(completeTimer);
  window.clearTimeout(removeTimer);
  splash.classList.remove("boot-splash-leaving", "boot-splash-done");
  splash.classList.add("boot-splash-reopen");
  if (!splash.isConnected) document.body.appendChild(splash);

  visible = true;
  shownAt = performance.now();
  minVisibleMs = REOPEN_MIN_VISIBLE_MS;
  progress = 0;
  progressTarget = 0;
  setBootProgress(0.2);
  setBootPhase("assets");
  startTimers();
  notify();
  scheduleFinish();
}

export function markAppMounted() {
  appMounted = true;
  scheduleFinish();
}

/**
 * Runs `task` once the first screen is ready (every other hold released) and
 * keeps the splash up until it settles. For work that must not compete with
 * the first screen's own requests. Runs right away when the splash is gone.
 */
export function runBeforeBootReveal(task: () => Promise<unknown>) {
  if (!visible) {
    void task().catch(() => undefined);
    return;
  }
  beforeReveal = task;
  scheduleFinish();
}

/** Keeps the splash up until the returned release function is called. */
export function holdBoot() {
  holdCount += 1;
  window.clearTimeout(finishTimer);
  let released = false;

  return () => {
    if (released) return;
    released = true;
    holdCount -= 1;
    scheduleFinish();
  };
}

export function setBootProgress(value: number) {
  if (!visible) return;
  progressTarget = Math.max(progressTarget, Math.min(value, 1));
  progress = Math.max(progress, progressTarget);
  renderProgress();
}

export function setBootPhase(nextPhase: BootPhase) {
  if (!visible || phase === nextPhase) return;
  phase = nextPhase;
  messageIndex = 0;
  renderStatus();
}

export function isBootSplashVisible() {
  return visible;
}

export function subscribeBootSplash(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
