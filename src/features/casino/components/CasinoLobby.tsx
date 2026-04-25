import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';

import { Progress } from '@/components/ui/progress';
import { getRoulettePhaseLabel, ROULETTE_BETTING_WINDOW_MS, ROULETTE_SPIN_REVEAL_MS } from '@/features/casino/lib/roulette';

import { RouletteGame, type RouletteHeaderStatus } from './RouletteGame';

interface CasinoLobbyProps {
  userId: string;
  username?: string;
  avatarUrl?: string | null;
  balance: number;
  refreshProfile: () => Promise<void>;
}

export function CasinoLobby({
  userId,
  username,
  avatarUrl,
  balance,
  refreshProfile,
}: CasinoLobbyProps) {
  const [status, setStatus] = useState<RouletteHeaderStatus>({
    roundNumber: null,
    phase: 'waiting',
    countdownLabel: '--:--',
    countdownMs: ROULETTE_BETTING_WINDOW_MS,
  });
  const progressValue = useMemo(() => {
    const maxMs = status.phase === 'spinning' ? ROULETTE_SPIN_REVEAL_MS : ROULETTE_BETTING_WINDOW_MS;
    return Math.max(0, Math.min(100, (status.countdownMs / maxMs) * 100));
  }, [status.countdownMs, status.phase]);

  return (
    <div className="w-full max-w-full min-w-0 space-y-5 text-white">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl sm:p-8"
      >
        {/* Decorative glow */}
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-red-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-amber-200/80">
              Kasyno premium
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl">
              Ruletka
            </h1>
            {status.phase !== 'waiting' && (
              <p className="mt-1 text-xs font-medium text-white/50">
                {getRoulettePhaseLabel(status.phase)}
              </p>
            )}
          </div>

          <div className="w-full max-w-xs space-y-2 md:w-72">
            <div className="flex items-center justify-between text-xs text-white/60">
              <span>Do spinu</span>
              <span className="font-mono text-sm font-bold text-white">
                {status.countdownLabel}
              </span>
            </div>
            <Progress value={progressValue} className="h-1.5 bg-white/10" />
            <p className="text-right font-mono text-[11px] text-white/45">
              #{status.roundNumber ?? '—'}
            </p>
          </div>
        </div>
      </motion.div>

      <RouletteGame
        userId={userId}
        username={username}
        avatarUrl={avatarUrl}
        balance={balance}
        refreshProfile={refreshProfile}
        onStatusChange={setStatus}
      />
    </div>
  );
}
