import { useCallback, useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { AnimatePresence, motion } from 'framer-motion';
import { Gift, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import {
  claimBonusCampaign,
  fetchAvailableBonusCampaigns,
} from '../bonus-campaign-api';
import {
  formatBonusAmount,
  pickFirstAvailableBonusCampaign,
} from '../campaign-availability';
import type { AvailableBonusCampaign } from '../types';

const fireBonusConfetti = () => {
  confetti({
    particleCount: 120,
    spread: 80,
    origin: { y: 0.55 },
  });
  confetti({
    particleCount: 60,
    spread: 120,
    startVelocity: 35,
    origin: { x: 0.2, y: 0.6 },
  });
  confetti({
    particleCount: 60,
    spread: 120,
    startVelocity: 35,
    origin: { x: 0.8, y: 0.6 },
  });
};

export function BonusCampaignSurface() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const [campaigns, setCampaigns] = useState<AvailableBonusCampaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [dismissedModal, setDismissedModal] = useState(false);

  const activeCampaign = pickFirstAvailableBonusCampaign(campaigns);
  const isBonusCtaVisible = Boolean(
    activeCampaign && !modalOpen && dismissedModal,
  );

  const loadCampaigns = useCallback(async () => {
    if (!user || !profile) {
      setCampaigns([]);
      return;
    }

    setLoadingCampaigns(true);
    try {
      const availableCampaigns = await fetchAvailableBonusCampaigns();
      setCampaigns(availableCampaigns);
    } catch (error: unknown) {
      toast.error(
        getErrorMessage(error, 'Nie udało się sprawdzić dostępnych bonusów'),
      );
      setCampaigns([]);
    } finally {
      setLoadingCampaigns(false);
    }
  }, [profile, user]);

  useEffect(() => {
    if (loading || !user || !profile) {
      return;
    }

    void loadCampaigns();
  }, [loadCampaigns, loading, profile, user]);

  useEffect(() => {
    if (!activeCampaign || dismissedModal) {
      return;
    }

    setModalOpen(true);
  }, [activeCampaign, dismissedModal]);

  useEffect(() => {
    document.body.classList.toggle(
      'bonus-campaign-cta-visible',
      isBonusCtaVisible,
    );

    return () => {
      document.body.classList.remove('bonus-campaign-cta-visible');
    };
  }, [isBonusCtaVisible]);

  const handleCloseModal = () => {
    setModalOpen(false);
    setDismissedModal(true);
  };

  const handleClaim = async () => {
    if (!activeCampaign || claiming) {
      return;
    }

    setClaiming(true);
    try {
      const result = await claimBonusCampaign(activeCampaign.id);
      await refreshProfile();
      setCampaigns((previous) =>
        previous.filter((campaign) => campaign.id !== activeCampaign.id),
      );
      setModalOpen(false);
      setDismissedModal(false);
      fireBonusConfetti();
      toast.success(
        `Odebrano ${formatBonusAmount(result.amount)}! Nowe saldo: ${formatBonusAmount(result.balance_after)}`,
      );
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Nie udało się odebrać bonusu'));
      await loadCampaigns();
    } finally {
      setClaiming(false);
    }
  };

  if (!user || !profile || !activeCampaign) {
    return null;
  }

  return (
    <>
      <AnimatePresence>
        {isBonusCtaVisible ? (
          <motion.button
            key="bonus-cta"
            type="button"
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            onClick={() => {
              setDismissedModal(false);
              setModalOpen(true);
            }}
            className={cn(
              'fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-[70] md:bottom-6 md:right-6',
              'flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-lg',
              'hover:brightness-110 transition',
            )}
            aria-label="Odbierz bonus"
          >
            <Gift className="h-5 w-5 shrink-0" />
            <span className="text-sm font-bold">Odbierz bonus</span>
          </motion.button>
        ) : null}
      </AnimatePresence>

      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleCloseModal();
            return;
          }
          setModalOpen(true);
        }}
      >
        <DialogContent
          className={cn(
            'max-w-[28rem] gap-0 overflow-hidden border-white/20 bg-background p-0 shadow-2xl shadow-red-950/30',
            '[&>button]:right-4 [&>button]:top-4 [&>button]:rounded-full [&>button]:p-1.5',
            '[&>button]:text-white/80 [&>button]:opacity-100 [&>button]:ring-offset-0',
            '[&>button]:transition [&>button]:duration-200',
            '[&>button]:data-[state=open]:bg-transparent [&>button]:data-[state=open]:text-white/80',
            '[&>button]:hover:bg-white/15 [&>button]:hover:text-white',
            '[&>button]:focus:ring-white/60',
          )}
        >
          <div className="relative overflow-hidden bg-[linear-gradient(145deg,#d30019_0%,#f0001d_44%,#f43243_100%)] px-6 pb-5 pt-7 text-primary-foreground">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0)_8%,rgba(255,255,255,0.18)_34%,rgba(255,255,255,0.04)_48%,rgba(255,255,255,0)_70%)]"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/45"
            />
            <motion.div
              initial={{ rotate: -8, scale: 0.9, opacity: 0 }}
              animate={{ rotate: [0, -6, 6, 0], scale: 1, opacity: 1 }}
              transition={{ duration: 0.7 }}
              className="relative mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/14 shadow-[0_8px_22px_rgba(94,0,16,0.18),inset_0_1px_0_rgba(255,255,255,0.26)] ring-1 ring-white/25 backdrop-blur-sm"
            >
              <span
                aria-hidden="true"
                className="absolute inset-2 rounded-full bg-white/7"
              />
              <Sparkles className="relative h-7 w-7 drop-shadow-[0_1px_4px_rgba(78,0,14,0.32)]" />
            </motion.div>
            <DialogHeader className="relative space-y-0.5 text-center text-primary-foreground">
              <DialogTitle className="text-[1.45rem] font-black leading-tight tracking-tight sm:text-2xl">
                {activeCampaign.title}
              </DialogTitle>
              <DialogDescription className="text-sm font-medium text-primary-foreground/86">
                {activeCampaign.description}
              </DialogDescription>
            </DialogHeader>
            <motion.p
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="relative mt-4 text-center text-[2.55rem] font-black leading-none tracking-tight sm:text-5xl"
            >
              {formatBonusAmount(activeCampaign.amount)}
            </motion.p>
          </div>

          <div className="space-y-2.5 px-6 py-4">
            <Button
              type="button"
              className="h-12 w-full bg-[#e6001a] text-base font-bold transition-colors hover:bg-[#c90018]"
              onClick={() => void handleClaim()}
              disabled={claiming || loadingCampaigns}
            >
              {claiming ? 'Odbieranie...' : 'Odbierz bonus'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-muted-foreground transition-colors hover:bg-muted"
              onClick={handleCloseModal}
              disabled={claiming}
            >
              Później
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
