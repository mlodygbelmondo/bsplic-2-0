import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

import { useRouletteTable } from '@/features/casino/hooks/useRouletteTable';
import { validateRouletteBetInput } from '@/features/casino/lib/roulette';
import type { RouletteBetType } from '@/types/database';

import { addLocalCasinoShare } from '@/features/social/casinoShares';
import {
  getRouletteColor,
} from '@/features/casino/lib/roulette';

import { ActiveBetsList } from './ActiveBetsList';
import { BettingPanel } from './BettingPanel';
import { GameStatusBar } from './GameStatusBar';
import { RecentSpinsCarousel } from './RecentSpinsCarousel';
import { RecentWinsFeed } from './RecentWinsFeed';
import { RouletteWheel } from './RouletteWheel';
import { StakeDrawer } from './StakeDrawer';
import { WinBanner } from './WinBanner';

interface RouletteGameProps {
  userId: string;
  balance: number;
  refreshProfile: () => Promise<void>;
}

export function RouletteGame({
  userId,
  balance,
  refreshProfile,
}: RouletteGameProps) {
  const [betType, setBetType] = useState<RouletteBetType | ''>('');
  const [betValue, setBetValue] = useState('');
  const [stake, setStake] = useState('10');

  const table = useRouletteTable({ userId, refreshProfile });
  const submitDisabled = table.phase !== 'waiting' || !table.currentRound;

  const [hasCelebrated, setHasCelebrated] = useState(false);
  const [winBannerDismissed, setWinBannerDismissed] = useState(false);

  const totalWin = table.activeBets.reduce(
    (sum, b) => sum + (b.is_win === true ? b.payout : 0),
    0,
  );

  const showWinBanner =
    table.phase === 'settled' && totalWin > 0 && !winBannerDismissed;

  useEffect(() => {
    if (table.phase !== 'settled') {
      setHasCelebrated(false);
      setWinBannerDismissed(false);
      return;
    }
    const hasWin = table.activeBets.some((b) => b.is_win === true);
    if (hasWin && !hasCelebrated) {
      setHasCelebrated(true);
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#fbbf24', '#f59e0b', '#ef4444', '#22c55e', '#ffffff'],
      });
    }
  }, [table.phase, table.activeBets, hasCelebrated]);

  const handleBetTypeChange = (value: RouletteBetType) => {
    setBetType(value);
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

      await table.placeBet(payload);
      toast.success('Zakład przyjęty do wspólnej rundy!');
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Nie udało się przyjąć zakładu.',
      );
    }
  };

  const handleShareWin = () => {
    const winBet = table.activeBets.find((b) => b.is_win === true);
    if (!winBet || !table.currentRound) return;

    const shareItem = {
      id: `casino-${winBet.id}-${Date.now()}`,
      item_type: 'casino' as const,
      user_id: userId,
      username: 'Ty',
      avatar_url: null,
      content: `Wygrana w ruletce: ${winBet.payout.toFixed(2)} zł`,
      total_odds: null,
      stake: winBet.stake,
      payout: winBet.payout,
      status: 'won',
      legs: null,
      created_at: new Date().toISOString(),
      reactions: null,
      comment_count: 0,
      my_reaction: null,
      casino_bet_type: winBet.bet_type,
      casino_bet_value: winBet.bet_value,
      casino_stake: winBet.stake,
      casino_payout: winBet.payout,
      casino_round_number: table.currentRound.round_number,
      casino_winning_number: table.currentRound.winning_number,
      casino_winning_color: getRouletteColor(
        table.currentRound.winning_number ?? 0,
      ),
    };

    addLocalCasinoShare(shareItem);
    toast.success('Wygrana udostępniona na Socialu!');
    setWinBannerDismissed(true);
  };

  return (
    <div className="space-y-5 overflow-x-hidden pb-16 md:pb-0">
      <GameStatusBar
        round={table.currentRound}
        countdownLabel={table.countdownLabel}
        countdownMs={table.countdownMs}
      />

      <WinBanner
        visible={showWinBanner}
        amount={totalWin}
        onShare={handleShareWin}
        onDismiss={() => setWinBannerDismissed(true)}
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

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* Main column */}
        <div className="order-2 space-y-5 lg:order-1">
          <RouletteWheel
            phase={table.phase}
            winningNumber={table.currentRound?.winning_number ?? null}
            spinStartedAt={table.currentRound?.spin_started_at ?? null}
            roundId={table.currentRound?.id ?? null}
          />

          <ActiveBetsList bets={table.activeBets} />

          <RecentSpinsCarousel spins={table.recentSpins} />
        </div>

        {/* Sidebar */}
        <div className="order-1 space-y-5 lg:order-2">
          <BettingPanel
            betType={betType}
            betValue={betValue}
            onBetTypeChange={handleBetTypeChange}
            onBetValueChange={setBetValue}
          />

          <RecentWinsFeed wins={table.recentWins} />
        </div>
      </div>

      <StakeDrawer
        balance={balance}
        stake={stake}
        loading={table.isPlacingBet}
        submitDisabled={submitDisabled}
        onStakeChange={setStake}
        onSubmit={() => void handleSubmit()}
      />
    </div>
  );
}
