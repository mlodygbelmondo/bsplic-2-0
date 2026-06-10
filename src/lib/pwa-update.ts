import { toast } from 'sonner';

export const PWA_UPDATE_TOAST_ID = 'pwa-update';
const RELOAD_FALLBACK_DELAY_MS = 2500;

type UpdateServiceWorker = (reloadPage?: boolean) => Promise<void>;

interface PwaUpdateToastOptions {
  reload?: () => void;
  reloadFallbackDelayMs?: number;
}

export const showPwaUpdateToast = (
  updateSW: UpdateServiceWorker,
  {
    reload = () => window.location.reload(),
    reloadFallbackDelayMs = RELOAD_FALLBACK_DELAY_MS,
  }: PwaUpdateToastOptions = {},
) => {
  toast('Nowa wersja jest gotowa', {
    id: PWA_UPDATE_TOAST_ID,
    duration: Infinity,
    action: {
      label: 'Odśwież',
      onClick: () => {
        window.setTimeout(reload, reloadFallbackDelayMs);
        void updateSW(false);
      },
    },
  });
};
