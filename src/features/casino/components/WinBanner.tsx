import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, X, Share2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface WinBannerProps {
  visible: boolean;
  amount: number;
  onShare: () => void;
  onDismiss: () => void;
}

const COUNT_UP_DURATION_MS = 900;

export function WinBanner({ visible, amount, onShare, onDismiss }: WinBannerProps) {
  const [show, setShow] = useState(false);
  const [displayedAmount, setDisplayedAmount] = useState(0);
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    setShow(visible);
  }, [visible]);

  useEffect(() => {
    if (!show) return undefined;

    let rafId: number;
    const startedAt = performance.now();

    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / COUNT_UP_DURATION_MS);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayedAmount(amount * eased);
      if (progress < 1) {
        rafId = window.requestAnimationFrame(step);
      }
    };

    setDisplayedAmount(0);
    rafId = window.requestAnimationFrame(step);

    return () => window.cancelAnimationFrame(rafId);
  }, [show, amount]);

  useEffect(() => {
    if (!show) return undefined;

    const timeoutId = window.setTimeout(() => {
      setShow(false);
      onDismissRef.current();
    }, 6500);

    return () => window.clearTimeout(timeoutId);
  }, [show]);

  const handleDismiss = () => {
    setShow(false);
    onDismiss();
  };

  if (!show) {
    return null;
  }

  return (
    <div
      data-testid="win-toast"
      className="pointer-events-none fixed left-3 right-3 top-20 z-50 flex justify-end sm:left-auto sm:right-5 sm:top-24 sm:w-[440px]"
    >
      <motion.div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        initial={{ opacity: 0, y: -16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="pointer-events-auto relative w-full overflow-hidden rounded-2xl border border-emerald-400/30 bg-emerald-950/90 p-3.5 shadow-2xl shadow-emerald-950/40 backdrop-blur-xl sm:p-4"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/70 to-transparent" />
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-400/20 ring-1 ring-emerald-300/20">
            <Trophy className="h-5 w-5 text-emerald-300" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold tabular-nums text-emerald-100">
              {`Wygrałeś ${displayedAmount.toFixed(2)} zł!`}
            </p>
            <p className="text-xs text-emerald-300/75">
              Gratulacje, trafiony zakład.
            </p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={onShare}
              className="h-9 rounded-lg bg-emerald-400 px-3 text-xs font-bold text-black hover:bg-emerald-300"
            >
              <Share2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Udostępnij
            </Button>
            <button
              type="button"
              aria-label="Zamknij powiadomienie o wygranej"
              onClick={handleDismiss}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-white/55 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/80"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
