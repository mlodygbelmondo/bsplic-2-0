import { BlackjackGame } from "@/features/casino/components/games/BlackjackGame";
import type { CSSProperties } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import "@/features/casino/blackjack-mobile.css";

type CasinoBackgroundStyle = CSSProperties & {
  "--casino-bg-desktop": string;
  "--casino-bg-mobile": string;
};

export default function CasinoBlackjackPage() {
  usePageTitle("Blackjack");
  return (
    <div
      data-testid="casino-blackjack-shell"
      className="casino-responsive-bg relative min-h-full w-full overflow-visible bg-cover bg-center bg-no-repeat"
      style={
        {
          "--casino-bg-desktop": "url('/casino/blackjack-table.webp')",
          "--casino-bg-mobile":
            "url('/casino/blackjack-table.webp')",
        } as CasinoBackgroundStyle
      }
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.08),transparent_35%),linear-gradient(180deg,rgba(22,5,9,0.18),rgba(22,5,9,0.35)_58%,rgba(22,5,9,0.60))]" />
      <div
        data-testid="casino-blackjack-content"
        className="relative z-10 mx-auto flex min-h-full w-full max-w-7xl flex-col gap-3 px-3 pb-[var(--mobile-bottom-nav-scroll-padding)] pt-3 sm:gap-4 sm:px-4 sm:pt-4 md:px-5 md:pt-5"
      >
        <BlackjackGame />
      </div>
    </div>
  );
}
