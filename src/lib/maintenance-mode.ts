export const MAINTENANCE_CHECK_INTERVAL_MS = 30_000;
export const MAINTENANCE_PAGE_PATH = "/maintenance.html";
export const MAINTENANCE_STATUS_ENDPOINT = "/api/maintenance";

interface MaintenanceStatusResponse {
  maintenanceMode?: unknown;
}

interface MaintenanceLocation {
  pathname: string;
  replace(url: string): void;
}

interface MaintenanceWindow {
  addEventListener: Window["addEventListener"];
  removeEventListener: Window["removeEventListener"];
  setInterval: Window["setInterval"];
  clearInterval: Window["clearInterval"];
  fetch?: Window["fetch"];
  location: MaintenanceLocation;
}

interface MaintenanceDocument {
  visibilityState: DocumentVisibilityState;
  addEventListener: Document["addEventListener"];
  removeEventListener: Document["removeEventListener"];
}

interface FetchMaintenanceModeOptions {
  endpoint?: string;
  fetcher?: typeof fetch;
}

interface MaintenanceModeCheckerOptions extends FetchMaintenanceModeOptions {
  locationRef?: MaintenanceLocation;
  maintenancePagePath?: string;
}

interface BindMaintenanceModeChecksOptions extends MaintenanceModeCheckerOptions {
  documentRef?: MaintenanceDocument;
  intervalMs?: number;
  windowRef?: MaintenanceWindow;
}

function getDefaultWindow() {
  return typeof window === "undefined" ? undefined : window;
}

function getDefaultDocument() {
  return typeof document === "undefined" ? undefined : document;
}

export async function fetchMaintenanceMode({
  endpoint = MAINTENANCE_STATUS_ENDPOINT,
  fetcher,
}: FetchMaintenanceModeOptions = {}) {
  const activeFetcher =
    fetcher ??
    (typeof window !== "undefined" && typeof window.fetch === "function"
      ? window.fetch.bind(window)
      : undefined);

  if (!activeFetcher) {
    return false;
  }

  const response = await activeFetcher(endpoint, {
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    return false;
  }

  const status = (await response.json()) as MaintenanceStatusResponse;
  return status.maintenanceMode === true;
}

export function createMaintenanceModeChecker({
  locationRef,
  maintenancePagePath = MAINTENANCE_PAGE_PATH,
  ...fetchOptions
}: MaintenanceModeCheckerOptions = {}) {
  let checking = false;

  return async () => {
    if (checking) {
      return;
    }

    checking = true;

    try {
      const maintenanceMode = await fetchMaintenanceMode(fetchOptions);
      if (!maintenanceMode) {
        return;
      }

      const activeLocation =
        locationRef ??
        (typeof window !== "undefined" ? window.location : undefined);

      if (activeLocation && activeLocation.pathname !== maintenancePagePath) {
        activeLocation.replace(maintenancePagePath);
      }
    } catch {
      // Maintenance checks fail open so transient network/config errors do not
      // lock users out of the app.
    } finally {
      checking = false;
    }
  };
}

export function bindMaintenanceModeChecks({
  documentRef = getDefaultDocument(),
  intervalMs = MAINTENANCE_CHECK_INTERVAL_MS,
  windowRef = getDefaultWindow(),
  ...checkerOptions
}: BindMaintenanceModeChecksOptions = {}) {
  if (!documentRef || !windowRef) {
    return () => {};
  }

  const fetcher =
    checkerOptions.fetcher ??
    (typeof windowRef.fetch === "function"
      ? windowRef.fetch.bind(windowRef)
      : undefined);
  const locationRef = checkerOptions.locationRef ?? windowRef.location;
  const checkForMaintenance = createMaintenanceModeChecker({
    ...checkerOptions,
    fetcher,
    locationRef,
  });
  const checkWhenVisible = () => {
    if (documentRef.visibilityState !== "hidden") {
      void checkForMaintenance();
    }
  };

  void checkForMaintenance();

  documentRef.addEventListener("visibilitychange", checkWhenVisible);
  windowRef.addEventListener("focus", checkWhenVisible);
  windowRef.addEventListener("online", checkWhenVisible);
  windowRef.addEventListener("pageshow", checkWhenVisible);

  const intervalId = windowRef.setInterval(checkWhenVisible, intervalMs);

  return () => {
    documentRef.removeEventListener("visibilitychange", checkWhenVisible);
    windowRef.removeEventListener("focus", checkWhenVisible);
    windowRef.removeEventListener("online", checkWhenVisible);
    windowRef.removeEventListener("pageshow", checkWhenVisible);
    windowRef.clearInterval(intervalId);
  };
}
