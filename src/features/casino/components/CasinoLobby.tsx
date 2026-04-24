import { motion } from 'framer-motion';

import { RouletteGame } from './RouletteGame';

interface CasinoLobbyProps {
  userId: string;
  balance: number;
  refreshProfile: () => Promise<void>;
}

export function CasinoLobby({
  userId,
  balance,
  refreshProfile,
}: CasinoLobbyProps) {
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

        <div className="relative z-10">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-200/80">
            Kasyno premium
          </p>
          <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl">
            Ruletka
          </h1>
        </div>
      </motion.div>

      <RouletteGame
        userId={userId}
        balance={balance}
        refreshProfile={refreshProfile}
      />
    </div>
  );
}
