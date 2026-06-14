import { useEffect, useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  PWA_UPDATE_AVAILABLE_EVENT,
  type PwaUpdateAvailableEventDetail,
} from '@/lib/pwa-update';
import { cn } from '@/lib/utils';

export function PwaUpdateModal() {
  const [refreshHandler, setRefreshHandler] = useState<(() => void) | null>(
    null,
  );
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const handleUpdateAvailable = (event: Event) => {
      const { detail } = event as CustomEvent<PwaUpdateAvailableEventDetail>;

      if (typeof detail?.refresh !== 'function') {
        return;
      }

      setRefreshing(false);
      setRefreshHandler(() => detail.refresh);
    };

    window.addEventListener(
      PWA_UPDATE_AVAILABLE_EVENT,
      handleUpdateAvailable,
    );

    return () => {
      window.removeEventListener(
        PWA_UPDATE_AVAILABLE_EVENT,
        handleUpdateAvailable,
      );
    };
  }, []);

  const handleRefresh = () => {
    if (!refreshHandler || refreshing) {
      return;
    }

    setRefreshing(true);
    refreshHandler();
  };

  return (
    <Dialog open={Boolean(refreshHandler)}>
      <DialogContent
        className={cn(
          'max-w-[28rem] gap-0 overflow-hidden border-white/20 bg-background p-0 shadow-2xl shadow-red-950/30',
        )}
        hideCloseButton
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <div className="relative overflow-hidden bg-[linear-gradient(145deg,#d30019_0%,#f0001d_44%,#f43243_100%)] px-6 pb-6 pt-7 text-primary-foreground">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0)_8%,rgba(255,255,255,0.18)_34%,rgba(255,255,255,0.04)_48%,rgba(255,255,255,0)_70%)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/45"
          />
          <div className="relative mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/14 shadow-[0_8px_22px_rgba(94,0,16,0.18),inset_0_1px_0_rgba(255,255,255,0.26)] ring-1 ring-white/25 backdrop-blur-sm">
            <span
              aria-hidden="true"
              className="absolute inset-2 rounded-full bg-white/7"
            />
            <Sparkles className="relative h-7 w-7 drop-shadow-[0_1px_4px_rgba(78,0,14,0.32)]" />
          </div>
          <DialogHeader className="relative space-y-1 text-center text-primary-foreground">
            <DialogTitle className="text-[1.45rem] font-black leading-tight tracking-tight sm:text-2xl">
              Nowa wersja aplikacji
            </DialogTitle>
            <DialogDescription className="text-sm font-medium text-primary-foreground/86">
              Jest dostępna aktualizacja. Odśwież aplikację, żeby korzystać z
              najnowszej wersji.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 py-4">
          <Button
            type="button"
            className="h-12 w-full bg-[#e6001a] text-base font-bold transition-colors hover:bg-[#c90018]"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className="mr-2 h-5 w-5" />
            {refreshing ? 'Odświeżanie...' : 'Odśwież'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
