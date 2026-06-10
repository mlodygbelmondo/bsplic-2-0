import { toast } from 'sonner';

export const PWA_UPDATE_TOAST_ID = 'pwa-update';

type UpdateServiceWorker = (reloadPage?: boolean) => Promise<void>;

export const showPwaUpdateToast = (updateSW: UpdateServiceWorker) => {
  toast('Update available', {
    id: PWA_UPDATE_TOAST_ID,
    duration: Infinity,
    action: {
      label: 'Reload',
      onClick: () => {
        void updateSW(true);
      },
    },
  });
};
