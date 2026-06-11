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
        <BlackjackGame />
      </div>
    </div>
  );
}
