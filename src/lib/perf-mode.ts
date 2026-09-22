import { isBootSplashVisible, subscribeBootSplash } from "@/lib/boot/boot-splash";

// iOS Low Power Mode and Chrome's battery saver cap animation frames at 30fps
// and throttle the GPU, and no web API reports either. Frame pacing gives it
// away: at 60Hz most frame gaps are ~16.7ms even when the main thread janks,
// while a capped device never goes below ~33ms. When capped, the `perf-lite`
// class on <html> switches off decorative infinite animations and glass
// effects that would otherwise be redrawn every frame.

const LITE_CLASS = "perf-lite";
const SAMPLE_MS = 1000;
const LITE_FRAME_GAP_MS = 26;
const MIN_SAMPLES = 12;
const RESUME_DELAY_MS = 400;

let lite = false;
let measuring = false;
const listeners = new Set<() => void>();

function setLite(nextLite: boolean) {
  if (lite === nextLite) return;
  lite = nextLite;
  document.documentElement.classList.toggle(LITE_CLASS, lite);
  listeners.forEach((listener) => listener());
}

function measureFramePacing() {
  if (measuring || document.hidden) return;
  measuring = true;

  const gaps: number[] = [];
  let startedAt = 0;
  let last = 0;

  const tick = (time: number) => {
    if (document.hidden) {
      measuring = false;
      return;
    }
    if (!startedAt) startedAt = time;
    if (last) gaps.push(time - last);
    last = time;

    if (time - startedAt < SAMPLE_MS) {
      window.requestAnimationFrame(tick);
      return;
    }

    measuring = false;
    if (gaps.length < MIN_SAMPLES) {
      setLite(true);
      return;
    }
    gaps.sort((a, b) => a - b);
    setLite(gaps[Math.floor(gaps.length * 0.25)] > LITE_FRAME_GAP_MS);
  };

  window.requestAnimationFrame(tick);
}

/** Measures after the boot splash is gone and again whenever the app resumes. */
export function startPerfModeDetection() {
  const measureAfterBoot = () => {
    if (isBootSplashVisible()) return;
    unsubscribe();
    window.setTimeout(measureFramePacing, RESUME_DELAY_MS);
  };
  const unsubscribe = subscribeBootSplash(measureAfterBoot);
  measureAfterBoot();

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      window.setTimeout(measureFramePacing, RESUME_DELAY_MS);
    }
  });
}

export function isPerfLite() {
  return lite;
}

export function subscribePerfMode(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
