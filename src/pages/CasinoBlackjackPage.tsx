import { BlackjackGame } from "@/features/casino/components/games/BlackjackGame";
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
      className="casino-responsive-bg relative min-h-full w-full overflow-visible bg-cover bg-center bg-no-repeat"
      style={
        {
          "--casino-bg-desktop": "url('/casino/blackjack-background.webp')",
          "--casino-bg-mobile":
            "url('/casino/blackjack-mobile-background.webp')",
        } as CasinoBackgroundStyle
      }
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.14),transparent_35%),linear-gradient(180deg,rgba(6,8,14,0.5),rgba(5,6,10,0.84)_58%,rgba(4,5,9,0.96))]" />
      <div
        data-testid="casino-blackjack-content"
        className="relative z-10 mx-auto flex min-h-full w-full max-w-7xl flex-col gap-3 px-3 pb-[var(--mobile-bottom-nav-scroll-padding)] pt-3 sm:gap-4 sm:px-4 sm:pt-4 md:px-5 md:pt-5"
      >
        <BlackjackGame />
      </div>
    </div>
  );
}
