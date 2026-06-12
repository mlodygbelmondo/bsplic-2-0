import { describe, expect, it, vi } from "vitest";

import {
  MAINTENANCE_PAGE_PATH,
  MAINTENANCE_STATUS_ENDPOINT,
  bindMaintenanceModeChecks,
  createMaintenanceModeChecker,
  fetchMaintenanceMode,
} from "./maintenance-mode";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
    },
  });
}

describe("fetchMaintenanceMode", () => {
  it("reads the uncached maintenance status endpoint", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(jsonResponse({ maintenanceMode: true }));

    await expect(
      fetchMaintenanceMode({ fetcher: fetcher as unknown as typeof fetch }),
    ).resolves.toBe(true);

    expect(fetcher).toHaveBeenCalledWith(
      MAINTENANCE_STATUS_ENDPOINT,
      expect.objectContaining({
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
        },
      }),
    );
  });

  it("surfaces status endpoint failures to the caller", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("offline"));

    await expect(
      fetchMaintenanceMode({ fetcher: fetcher as unknown as typeof fetch }),
    ).rejects.toThrow("offline");
  });
});

describe("createMaintenanceModeChecker", () => {
  it("redirects to the maintenance page when the flag is enabled", async () => {
    const replace = vi.fn();
    const fetcher = vi
      .fn()
      .mockResolvedValue(jsonResponse({ maintenanceMode: true }));
    const checkForMaintenance = createMaintenanceModeChecker({
      fetcher: fetcher as unknown as typeof fetch,
      locationRef: {
        pathname: "/",
        replace,
      },
    });

    await checkForMaintenance();

    expect(replace).toHaveBeenCalledWith(MAINTENANCE_PAGE_PATH);
  });

  it("does not redirect again from the maintenance page", async () => {
    const replace = vi.fn();
    const fetcher = vi
      .fn()
      .mockResolvedValue(jsonResponse({ maintenanceMode: true }));
    const checkForMaintenance = createMaintenanceModeChecker({
      fetcher: fetcher as unknown as typeof fetch,
      locationRef: {
        pathname: MAINTENANCE_PAGE_PATH,
        replace,
      },
    });

    await checkForMaintenance();

    expect(replace).not.toHaveBeenCalled();
  });

  it("keeps the current page when the check itself fails", async () => {
    const replace = vi.fn();
    const fetcher = vi.fn().mockRejectedValue(new Error("network"));
    const checkForMaintenance = createMaintenanceModeChecker({
      fetcher: fetcher as unknown as typeof fetch,
      locationRef: {
        pathname: "/social",
        replace,
      },
    });

    await checkForMaintenance();

    expect(replace).not.toHaveBeenCalled();
  });
});

describe("bindMaintenanceModeChecks", () => {
  it("checks already open app sessions immediately", async () => {
    const replace = vi.fn();
    const fetcher = vi
      .fn()
      .mockResolvedValue(jsonResponse({ maintenanceMode: true }));

    const cleanup = bindMaintenanceModeChecks({
      fetcher: fetcher as unknown as typeof fetch,
      locationRef: {
        pathname: "/rankings",
        replace,
      },
    });

    await vi.waitFor(() => {
      expect(replace).toHaveBeenCalledWith(MAINTENANCE_PAGE_PATH);
    });

    cleanup();
  });
});
