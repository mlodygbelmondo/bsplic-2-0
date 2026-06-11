import { memo } from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import type { Card } from "@/features/casino/api/blackjack";

interface PlayingCardProps {
  card: Card;
  hidden?: boolean;
  dealTarget?: "dealer" | "player";
  index?: number;
  testId?: string;
}

const suitSymbols = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

const suitColors = {
  hearts: "text-red-500",
  diamonds: "text-red-500",
  clubs: "text-zinc-800",
  spades: "text-zinc-800",
};

const cardReverseSrc = "/casino/blackjack-card-reverse.png?v=20260503";

export const PlayingCard = memo(function PlayingCard({
  card,
  hidden = false,
  dealTarget = "player",
  index = 0,
  testId,
}: PlayingCardProps) {
  const isDealerHiddenCard = hidden && dealTarget === "dealer";
  const initialOffset =
    dealTarget === "dealer" ? { x: 28, y: 14 } : { x: 34, y: -18 };
  const transition = {
    type: "tween" as const,
    duration: 0.18,
    ease: "easeOut" as const,
    delay: isDealerHiddenCard ? 0.12 : Math.min(index * 0.025, 0.075),
  };
  const symbol = suitSymbols[card.suit];
  const colorClass = suitColors[card.suit];

  return (
    <motion.div
      data-card-animation="quick"
      data-card-delay={transition.delay}
      data-card-hidden={hidden ? "true" : undefined}
      data-card-id={card.id}
      data-testid={testId}
      initial={{ opacity: 0, scale: 0.82, ...initialOffset }}
      animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
      transition={transition}
      className="relative h-28 w-20 flex-shrink-0 bg-transparent [perspective:600px] sm:h-32 sm:w-24 2xl:h-40 2xl:w-28"
      style={{ zIndex: hidden ? 0 : index + 1 }}
    >
      <motion.div
        className="relative h-full w-full [transform-style:preserve-3d]"
        initial={false}
        animate={{ rotateY: hidden ? 180 : 0 }}
        transition={{ type: "tween", duration: 0.45, ease: "easeInOut" }}
      >
        {/* Face */}
        <div
          className={cn(
            "absolute inset-0 flex flex-col justify-between rounded-xl border border-black/10 bg-gradient-to-br from-white via-white to-slate-200 p-2 shadow-[0_6px_18px_rgba(0,0,0,0.45)] [backface-visibility:hidden] 2xl:p-3",
          )}
        >
          {/* Top left */}
          <div className={cn("flex flex-col items-center self-start", colorClass)}>
            <span className="text-base font-bold leading-none sm:text-lg 2xl:text-xl">
              {card.rank}
            </span>
            <span className="text-sm leading-none sm:text-base">{symbol}</span>
          </div>

          {/* Center large suit */}
          <div
            className={cn(
              "pointer-events-none absolute inset-0 flex items-center justify-center text-5xl opacity-15 sm:text-6xl 2xl:text-7xl",
              colorClass,
            )}
          >
            {symbol}
          </div>

          {/* Bottom right */}
          <div
            className={cn(
              "flex rotate-180 flex-col items-center self-end",
              colorClass,
            )}
          >
            <span className="text-base font-bold leading-none sm:text-lg 2xl:text-xl">
              {card.rank}
            </span>
            <span className="text-sm leading-none sm:text-base">{symbol}</span>
          </div>
        </div>

        {/* Back */}
        <div className="absolute inset-0 overflow-hidden rounded-xl shadow-[0_6px_18px_rgba(0,0,0,0.45)] [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <img
            src={cardReverseSrc}
            alt="Rewers karty"
            className="block h-full w-full rounded-xl object-fill"
            draggable={false}
          />
        </div>
      </motion.div>
    </motion.div>
  );
});
