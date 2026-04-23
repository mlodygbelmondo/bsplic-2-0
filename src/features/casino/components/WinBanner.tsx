import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, X, Share2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface WinBannerProps {
  visible: boolean;
  amount: number;
  onShare: () => void;
  onDismiss: () => void;
}

export function WinBanner({ visible, amount, onShare, onDismiss }: WinBannerProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (visible) {
      setShow(true);
    }
  }, [visible]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          className={cn(
            'relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-emerald-950/60 p-4 backdrop-blur-xl',
            !visible && 'pointer-events-none opacity-60',
          )}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500/20">
              <Trophy className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-emerald-200">
                Wygrałeś {amount.toFixed(2)} zł!
              </p>
              <p className="text-xs text-emerald-400/70">
                Gratulacje, trafiony zakład.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onShare();
                }}
                className="h-8 rounded-lg bg-emerald-500 px-3 text-xs font-bold text-black hover:bg-emerald-400"
              >
                <Share2 className="mr-1 h-3.5 w-3.5" />
                Udostępnij
              </Button>
              <button
                type="button"
                onClick={onDismiss}
                className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
