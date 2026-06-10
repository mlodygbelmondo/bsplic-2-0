import { describe, expect, it, vi } from "vitest";

import {
  PWA_UPDATE_CHECK_INTERVAL_MS,
  createServiceWorkerUpdateChecker,
} from "./pwa-registration";

describe("createServiceWorkerUpdateChecker", () => {
  it("checks for a service worker update immediately", async () => {
    const registration = {
      update: vi.fn().mockResolvedValue(undefined),
    } as unknown as ServiceWorkerRegistration;
    const checkForUpdate = createServiceWorkerUpdateChecker(registration);

    await checkForUpdate();

    expect(registration.update).toHaveBeenCalledTimes(1);
  });

  it("throttles repeated foreground update checks", async () => {
    let now = 1_000;
    const registration = {
      update: vi.fn().mockResolvedValue(undefined),
    } as unknown as ServiceWorkerRegistration;
    const checkForUpdate = createServiceWorkerUpdateChecker(registration, {
      now: () => now,
    });

    await checkForUpdate();
    await checkForUpdate();
    now += PWA_UPDATE_CHECK_INTERVAL_MS + 1;
    await checkForUpdate();

    expect(registration.update).toHaveBeenCalledTimes(2);
  });

  it("retries the next visible check after a failed update check", async () => {
    const registration = {
      update: vi
        .fn()
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValue(undefined),
    } as unknown as ServiceWorkerRegistration;
    const checkForUpdate = createServiceWorkerUpdateChecker(registration);

    await checkForUpdate();
    await checkForUpdate();

    expect(registration.update).toHaveBeenCalledTimes(2);
  });
});
