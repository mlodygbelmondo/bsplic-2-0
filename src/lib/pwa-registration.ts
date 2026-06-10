export const PWA_UPDATE_CHECK_INTERVAL_MS = 60_000;

interface UpdateCheckerOptions {
  minIntervalMs?: number;
  now?: () => number;
}

export function createServiceWorkerUpdateChecker(
  registration: ServiceWorkerRegistration,
  {
    minIntervalMs = PWA_UPDATE_CHECK_INTERVAL_MS,
    now = () => Date.now(),
  }: UpdateCheckerOptions = {},
) {
  let lastCheckAt = Number.NEGATIVE_INFINITY;
  let checking = false;

  return async () => {
    const currentTime = now();
    if (checking || currentTime - lastCheckAt < minIntervalMs) {
      return;
    }

    checking = true;

    try {
      await registration.update();
      lastCheckAt = currentTime;
    } catch {
      // Update checks are opportunistic; offline/error state is handled by
      // the app's connection toasts and the next foreground check will retry.
    } finally {
      checking = false;
    }
  };
}

export function bindServiceWorkerUpdateChecks(
  registration: ServiceWorkerRegistration,
) {
  const checkForUpdate = createServiceWorkerUpdateChecker(registration);
  const checkWhenVisible = () => {
    if (document.visibilityState !== "hidden") {
      void checkForUpdate();
    }
  };

  void checkForUpdate();

  document.addEventListener("visibilitychange", checkWhenVisible);
  window.addEventListener("focus", checkWhenVisible);
  window.addEventListener("online", checkWhenVisible);
  window.addEventListener("pageshow", checkWhenVisible);

  const intervalId = window.setInterval(
    checkWhenVisible,
    PWA_UPDATE_CHECK_INTERVAL_MS,
  );

  return () => {
    document.removeEventListener("visibilitychange", checkWhenVisible);
    window.removeEventListener("focus", checkWhenVisible);
    window.removeEventListener("online", checkWhenVisible);
    window.removeEventListener("pageshow", checkWhenVisible);
    window.clearInterval(intervalId);
  };
}
