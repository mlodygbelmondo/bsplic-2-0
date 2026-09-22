import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type BootSplashModule = typeof import("@/lib/boot/boot-splash");

async function loadWithSplash(): Promise<BootSplashModule> {
  document.body.innerHTML = `
    <div id="initial-splash">
      <p data-boot-status></p>
    </div>`;
  vi.resetModules();
  const bootSplash = await import("@/lib/boot/boot-splash");
  bootSplash.initBootSplash();
  return bootSplash;
}

const splashElement = () => document.getElementById("initial-splash");

describe("boot splash", () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "performance"],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("stays up until the app mounts and every hold is released", async () => {
    const bootSplash = await loadWithSplash();
    const release = bootSplash.holdBoot();
    bootSplash.markAppMounted();

    await vi.advanceTimersByTimeAsync(3000);
    expect(bootSplash.isBootSplashVisible()).toBe(true);

    release();
    await vi.advanceTimersByTimeAsync(200);
    expect(bootSplash.isBootSplashVisible()).toBe(false);
    expect(splashElement()?.style.getPropertyValue("--boot-progress")).toBe("1.000");

    await vi.advanceTimersByTimeAsync(1000);
    expect(splashElement()).toBeNull();
  });

  it("keeps the splash for the minimum display time", async () => {
    const bootSplash = await loadWithSplash();
    bootSplash.markAppMounted();

    await vi.advanceTimersByTimeAsync(500);
    expect(bootSplash.isBootSplashVisible()).toBe(true);

    await vi.advanceTimersByTimeAsync(600);
    expect(bootSplash.isBootSplashVisible()).toBe(false);
  });

  it("gives up waiting on a stuck hold", async () => {
    const bootSplash = await loadWithSplash();
    bootSplash.holdBoot();
    bootSplash.markAppMounted();

    await vi.advanceTimersByTimeAsync(9100);
    expect(bootSplash.isBootSplashVisible()).toBe(false);
  });

  it("re-opens for a sign-in after boot and notifies subscribers", async () => {
    const bootSplash = await loadWithSplash();
    const listener = vi.fn();
    bootSplash.subscribeBootSplash(listener);
    bootSplash.markAppMounted();
    await vi.advanceTimersByTimeAsync(2000);
    expect(splashElement()).toBeNull();

    const release = bootSplash.holdBoot();
    bootSplash.showBootSplash();
    expect(bootSplash.isBootSplashVisible()).toBe(true);
    expect(splashElement()).not.toBeNull();

    release();
    await vi.advanceTimersByTimeAsync(1000);
    expect(bootSplash.isBootSplashVisible()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("runs deferred work after the first screen and waits for it", async () => {
    const bootSplash = await loadWithSplash();
    const release = bootSplash.holdBoot();
    let finishTask: () => void = () => undefined;
    const task = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishTask = resolve;
        }),
    );
    bootSplash.runBeforeBootReveal(task);
    bootSplash.markAppMounted();

    await vi.advanceTimersByTimeAsync(500);
    expect(task).not.toHaveBeenCalled();

    release();
    await vi.advanceTimersByTimeAsync(200);
    expect(task).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(2000);
    expect(bootSplash.isBootSplashVisible()).toBe(true);

    finishTask();
    await vi.advanceTimersByTimeAsync(200);
    expect(bootSplash.isBootSplashVisible()).toBe(false);
  });

  it("never moves the progress bar backwards", async () => {
    const bootSplash = await loadWithSplash();
    bootSplash.setBootProgress(0.6);
    bootSplash.setBootProgress(0.3);

    expect(Number(splashElement()?.style.getPropertyValue("--boot-progress"))).toBeCloseTo(0.6);
  });

  it("does nothing when the page has no splash", async () => {
    document.body.innerHTML = "";
    vi.resetModules();
    const bootSplash = await import("@/lib/boot/boot-splash");
    bootSplash.initBootSplash();

    expect(bootSplash.isBootSplashVisible()).toBe(false);
    expect(() => bootSplash.holdBoot()()).not.toThrow();
  });
});
