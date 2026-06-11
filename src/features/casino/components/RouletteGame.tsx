import { useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

import { useRouletteTable } from '@/features/casino/hooks/useRouletteTable';
import { createCasinoShare } from '@/features/social/api/social';
import { validateRouletteBetInput } from '@/features/casino/lib/roulette';
import {
  getStoredRouletteBetType,
  storeRouletteBetType,
} from '@/features/casino/lib/preferences';
import type { RouletteBetType, RouletteRoundPhase } from '@/types/database';

import { useIsMobile } from '@/hooks/use-mobile';
import { getRouletteColor } from '@/features/casino/lib/roulette';

import { BettingPanel } from './BettingPanel';
import { RecentSpinsCarousel } from './RecentSpinsCarousel';
import { RecentWinsFeed } from './RecentWinsFeed';
import { RoundParticipantsList } from './RoundParticipantsList';
import { RouletteWheel } from './RouletteWheel';
import { StakeDrawer } from './StakeDrawer';
import { WinBanner } from './WinBanner';

export interface RouletteHeaderStatus {
  roundNumber: number | null;
  phase: RouletteRoundPhase;
  countdownLabel: string;
  countdownMs: number;
  isIdle: boolean;
}

interface RouletteGameProps {
  userId: string;
  username?: string;
  avatarUrl?: string | null;
  balance: number;
  refreshProfile: () => Promise<void>;
  onStatusChange?: (status: RouletteHeaderStatus) => void;
}

export function RouletteGame({
  userId,
  username = 'Ty',
  avatarUrl = null,
  balance,
  refreshProfile,
  onStatusChange,
}: RouletteGameProps) {
  const [betType, setBetType] = useState<RouletteBetType | ''>(
    () => getStoredRouletteBetType() ?? 'straight',
  );
  const [betValue, setBetValue] = useState('');
  const [stake, setStake] = useState('10');
  const [isSharingWin, setIsSharingWin] = useState(false);
  const isMobile = useIsMobile();

  const table = useRouletteTable({
    userId,
    username,
    avatarUrl,
    refreshProfile,
  });
  // Betting stays enabled while the wheel spins - the bet queues into the
  // next shared round on the server.
  const submitDisabled = table.isLoading;

  const [dismissedWinKey, setDismissedWinKey] = useState<string | null>(null);
  const announcedWinKeysRef = useRef<Set<string>>(new Set());
  const sharedWinKeysRef = useRef<Set<string>>(new Set());
  const pendingWinRoundIdsRef = useRef<Set<string>>(new Set());

  const settledActiveWins = useMemo(
    () =>
      table.activeBets.filter((bet) => bet.is_win === true && bet.payout > 0),
    [table.activeBets],
  );
  const recentSessionWins = useMemo(
    () =>
      table.recentWins.filter(
        (win) =>
          win.user_id === userId &&
          win.payout > 0 &&
          pendingWinRoundIdsRef.current.has(win.round_id),
      ),
    [table.recentWins, userId],
  );
  const latestUserWin = settledActiveWins[0] ?? recentSessionWins[0] ?? null;
  const totalWin = latestUserWin?.payout ?? 0;
  const latestUserWinKey = latestUserWin
    ? `${latestUserWin.round_id}:${latestUserWin.bet_type}:${latestUserWin.bet_value}:${latestUserWin.stake}:${latestUserWin.payout}`
    : null;

  const showWinBanner =
    totalWin > 0 &&
    latestUserWinKey !== null &&
    latestUserWinKey !== dismissedWinKey &&
    !sharedWinKeysRef.current.has(latestUserWinKey);

  useEffect(() => {
    if (
      latestUserWin &&
      latestUserWinKey &&
      !announcedWinKeysRef.current.has(latestUserWinKey)
    ) {
      announcedWinKeysRef.current.add(latestUserWinKey);
      setDismissedWinKey((current) =>
        current && current !== latestUserWinKey ? null : current,
      );
      toast.success(`Trafiony spin: +${latestUserWin.payout.toFixed(2)} zł`);
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#fbbf24', '#f59e0b', '#ef4444', '#22c55e', '#ffffff'],
      });
    }
  }, [latestUserWin, latestUserWinKey]);

  const handleBetTypeChange = (value: RouletteBetType) => {
    setBetType(value);
    storeRouletteBetType(value);
    setBetValue('');
  };

  const handleSubmit = async () => {
    try {
      const payload = validateRouletteBetInput({
        betType,
        betValue,
        stake,
        balance,
      });

      const roundIdAtSubmit = table.currentRound?.id ?? null;
      const acceptedBet = await table.placeBet(payload);
      if (acceptedBet?.round_id) {
        pendingWinRoundIdsRef.current.add(acceptedBet.round_id);
      }
      const queuedForNextRound =
        roundIdAtSubmit !== null &&
        typeof acceptedBet?.round_id === 'string' &&
        acceptedBet.round_id !== roundIdAtSubmit;
      toast.success(
        queuedForNextRound
          ? 'Zakład czeka na następną rundę!'
          : 'Zakład przyjęty do wspólnej rundy!',
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Nie udało się przyjąć zakładu.',
      );
    }
  };

  const handleShareWin = async () => {
    const winBet = latestUserWin;
    if (!winBet || !table.currentRound || !latestUserWinKey || isSharingWin)
      return;

    setIsSharingWin(true);
    try {
      const settledRound =
        table.recentSpins.find((round) => round.id === winBet.round_id) ??
        (table.currentRound.id === winBet.round_id ? table.currentRound : null);
      const winningNumber = settledRound?.winning_number ?? null;
      const winningColor =
        settledRound?.winning_color ??
        (winningNumber === null ? null : getRouletteColor(winningNumber));
      const winRoundNumber =
        settledRound?.round_number ?? table.currentRound.round_number;
      const content =
        winningNumber === null
          ? `Wygrana w ruletce: ${winBet.payout.toFixed(2)} zł`
          : `Wygrana w ruletce: ${winBet.payout.toFixed(2)} zł. Numer ${winningNumber}.`;

      await createCasinoShare({
        userId,
        betId: winBet.id,
        content,
        betType: winBet.bet_type,
        betValue: winBet.bet_value,
        stake: winBet.stake,
        payout: winBet.payout,
        roundNumber: winRoundNumber,
        winningNumber,
        winningColor,
      });

      pendingWinRoundIdsRef.current.delete(winBet.round_id);
      sharedWinKeysRef.current.add(latestUserWinKey);
      setDismissedWinKey(latestUserWinKey);
      toast.success('Wygrana udostępniona na Socialu!');
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Nie udało się udostępnić wygranej.',
      );
    } finally {
      setIsSharingWin(false);
    }
  };

  const handleDismissWin = () => {
    if (latestUserWinKey) {
      setDismissedWinKey(latestUserWinKey);
    }
  };

  const bettingPanel = (
    <BettingPanel
      betType={betType}
      betValue={betValue}
      onBetTypeChange={handleBetTypeChange}
      onBetValueChange={setBetValue}
    />
  );

  const leftRailContent = (
    <>
      <RoundParticipantsList participants={table.roundParticipants} />
      <RecentSpinsCarousel spins={table.recentSpins} />
      <RecentWinsFeed wins={table.recentWins} />
    </>
  );

  const rightRailContent = <>{!isMobile && bettingPanel}</>;

  useEffect(() => {
    onStatusChange?.({
      roundNumber: table.currentRound?.round_number ?? null,
      phase: table.currentRound?.phase ?? 'waiting',
      countdownLabel: table.countdownLabel,
      countdownMs: table.countdownMs,
      isIdle: table.isIdle,
    });
  }, [
    onStatusChange,
    table.currentRound?.round_number,
    table.currentRound?.phase,
    table.countdownLabel,
    table.countdownMs,
    table.isIdle,
  ]);

  return (
    <div className="w-full max-w-full min-w-0 space-y-5 pb-16 md:pb-0">
      <WinBanner
        visible={showWinBanner}
        amount={totalWin}
        onShare={() => void handleShareWin()}
        onDismiss={handleDismissWin}
      />

      {table.tableMessage && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
        >
          {table.tableMessage}
        </motion.div>
      )}

      <div
        data-testid="roulette-table-layout"
        className="grid min-w-0 gap-5 xl:grid-cols-[360px_minmax(520px,1fr)_360px]"
      >
        <div
          data-testid="roulette-left-rail"
          className="order-2 min-w-0 space-y-5 xl:order-1"
        >
          {leftRailContent}
        </div>

        <div
          data-testid="roulette-center-stage"
          className="order-1 min-w-0 space-y-5 xl:order-2"
        >
          <RouletteWheel
            phase={table.phase}
            winningNumber={table.currentRound?.winning_number ?? null}
            spinStartedAt={table.currentRound?.spin_started_at ?? null}
            roundId={table.currentRound?.id ?? null}
          />
        </div>

        <div
          data-testid="roulette-right-rail"
          className="order-3 min-w-0 space-y-5"
        >
          {rightRailContent}
        </div>
      </div>

      <StakeDrawer
        balance={balance}
        stake={stake}
        loading={table.isPlacingBet}
        submitDisabled={submitDisabled}
        betControls={isMobile ? bettingPanel : undefined}
        onStakeChange={setStake}
        onSubmit={() => void handleSubmit()}
      />
    </div>
  );
}
