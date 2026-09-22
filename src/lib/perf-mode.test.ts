import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function driveFrames(frameGapMs: number) {
  let now = 0;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    now += frameGapMs;
    const time = now;
    window.setTimeout(() => callback(time), 0);
    return 0;
  });
}

async function detect(frameGapMs: number) {
  driveFrames(frameGapMs);
  vi.resetModules();
  const perfMode = await import("@/lib/perf-mode");
  perfMode.startPerfModeDetection();
  await vi.runAllTimersAsync();
  return perfMode;
}

describe("perf mode detection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.documentElement.classList.remove("perf-lite");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.documentElement.classList.remove("perf-lite");
  });

  it("switches to lite mode when frames are capped at 30fps", async () => {
    const perfMode = await detect(33.3);

    expect(perfMode.isPerfLite()).toBe(true);
    expect(document.documentElement.classList.contains("perf-lite")).toBe(true);
  });

  it("keeps full effects at 60fps", async () => {
    const perfMode = await detect(16.7);

    expect(perfMode.isPerfLite()).toBe(false);
    expect(document.documentElement.classList.contains("perf-lite")).toBe(false);
  });
});
