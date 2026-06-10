import { BlackjackGame } from "@/features/casino/components/games/BlackjackGame";
import { motion } from "framer-motion";
import type { CSSProperties } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";

type CasinoBackgroundStyle = CSSProperties & {
  "--casino-bg-desktop": string;
  "--casino-bg-mobile": string;
};

export default function CasinoBlackjackPage() {
  usePageTitle("Blackjack");
  return (
    <div
      data-testid="casino-blackjack-shell"
      className="casino-responsive-bg relative h-full w-full overflow-hidden bg-cover bg-center bg-no-repeat"
      style={
        {
          "--casino-bg-desktop": "url('/casino/blackjack-background.webp')",
          "--casino-bg-mobile":
            "url('/casino/blackjack-mobile-background.webp')",
        } as CasinoBackgroundStyle
      }
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.14),transparent_35%),linear-gradient(180deg,rgba(6,8,14,0.5),rgba(5,6,10,0.84)_58%,rgba(4,5,9,0.96))]" />
      <div className="relative z-10 mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col gap-3 p-3 sm:gap-4 sm:p-4 md:p-5">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative shrink-0 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-3 backdrop-blur-xl sm:p-4 md:p-5"
        >
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-blue-200/80">
                Kasyno premium
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl lg:text-4xl">
                Blackjack
              </h1>
            </div>
            <div className="max-w-xl text-xs leading-relaxed text-white/70 sm:text-sm">
              Krupier dobiera do 16 i czeka na 17. Blackjack płaci 3:2.
            </div>
          </div>
        </motion.div>

        <BlackjackGame />
      </div>
    </div>
  );
}
