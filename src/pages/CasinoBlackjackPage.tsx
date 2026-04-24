import { BlackjackGame } from '@/features/casino/components/games/BlackjackGame';
import { motion } from 'framer-motion';

export default function CasinoBlackjackPage() {
  return (
    <div className="mx-auto w-full max-w-7xl p-4 pb-10 pt-6 md:p-6 md:pb-14 space-y-6">

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl sm:p-8"
      >
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-blue-200/80">
              Kasyno premium
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl lg:text-4xl">
              Blackjack
            </h1>
          </div>
          <div className="text-sm text-white/60 max-w-sm">
            Krupier musi dobierać do 16 i czekać na 17. Blackjack płaci 3:2. Podwojenie stawki dostępne dla dowolnych dwóch początkowych kart.
          </div>
        </div>
      </motion.div>

      <BlackjackGame />
    </div>
  );
}
