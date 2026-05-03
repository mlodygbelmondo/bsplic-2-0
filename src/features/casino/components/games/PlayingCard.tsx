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
  const cardSizeClass =
    "relative flex h-28 w-20 flex-shrink-0 flex-col justify-between rounded-xl sm:h-32 sm:w-24 2xl:h-40 2xl:w-28";
  const cardFrameClass = cn(cardSizeClass, "border border-white/10");

  if (hidden) {
    return (
      <motion.div
        data-card-animation="quick"
        data-card-delay={transition.delay}
        data-card-hidden="true"
        data-card-id={card.id}
        data-testid={testId}
        initial={{ opacity: 0, scale: 0.82, ...initialOffset }}
        animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
        transition={transition}
        className={cn(cardSizeClass, "overflow-hidden bg-transparent p-0")}
        style={{ zIndex: 0 }}
      >
        <img
          src={cardReverseSrc}
          alt="Rewers karty"
          className="block h-full w-full rounded-xl object-fill"
          draggable={false}
        />
      </motion.div>
    );
  }

  const symbol = suitSymbols[card.suit];
  const colorClass = suitColors[card.suit];

  return (
    <motion.div
      data-card-animation="quick"
      data-card-delay={transition.delay}
      data-card-id={card.id}
      data-testid={testId}
      initial={{ opacity: 0, scale: 0.82, ...initialOffset }}
      animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
      transition={transition}
      className={cn(cardFrameClass, "bg-white p-2 2xl:p-3")}
      style={{ zIndex: hidden ? 0 : index + 1 }}
    >
      {/* Top left */}
      <div className={cn("flex flex-col items-center", colorClass)}>
        <span className="text-base font-bold leading-none sm:text-lg 2xl:text-xl">
          {card.rank}
        </span>
        <span className="text-sm leading-none sm:text-base">{symbol}</span>
      </div>

      {/* Center large suit */}
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center opacity-20 text-5xl sm:text-6xl 2xl:text-7xl",
          colorClass,
        )}
      >
        {symbol}
      </div>

      {/* Bottom right */}
      <div className={cn("flex flex-col items-center rotate-180", colorClass)}>
        <span className="text-base font-bold leading-none sm:text-lg 2xl:text-xl">
          {card.rank}
        </span>
        <span className="text-sm leading-none sm:text-base">{symbol}</span>
      </div>
    </motion.div>
  );
});
