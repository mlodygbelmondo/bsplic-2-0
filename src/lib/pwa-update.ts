export const PWA_UPDATE_AVAILABLE_EVENT = 'bsplic:pwa-update-available';
const RELOAD_FALLBACK_DELAY_MS = 2500;

type UpdateServiceWorker = (reloadPage?: boolean) => Promise<void>;

interface PwaUpdateModalOptions {
  reload?: () => void;
  reloadFallbackDelayMs?: number;
}

export interface PwaUpdateAvailableEventDetail {
  refresh: () => void;
}

export const createPwaUpdateRefreshHandler = (
  updateSW: UpdateServiceWorker,
  {
    reload = () => window.location.reload(),
    reloadFallbackDelayMs = RELOAD_FALLBACK_DELAY_MS,
  }: PwaUpdateModalOptions = {},
) => () => {
  window.setTimeout(reload, reloadFallbackDelayMs);
  void updateSW(false);
};

export const showPwaUpdateModal = (
  updateSW: UpdateServiceWorker,
  options: PwaUpdateModalOptions = {},
) => {
  window.dispatchEvent(
    new CustomEvent<PwaUpdateAvailableEventDetail>(PWA_UPDATE_AVAILABLE_EVENT, {
      detail: {
        refresh: createPwaUpdateRefreshHandler(updateSW, options),
      },
    }),
  );
};
