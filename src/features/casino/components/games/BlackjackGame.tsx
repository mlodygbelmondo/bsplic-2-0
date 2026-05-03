import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import {
  useBlackjack,
  calculateHandValue,
} from "@/features/casino/hooks/useBlackjack";
import { cn } from "@/lib/utils";

import { PlayingCard } from "./PlayingCard";

export function BlackjackGame() {
  const { user, profile, refreshProfile } = useAuth();
  const [betInput, setBetInput] = useState("10");
  const hasCelebratedWinRef = useRef(false);

  const {
    playerHand,
    playerHands,
    activeHandIndex,
    activeHand,
    dealerHand,
    dealerHiddenCount,
    status,
    stake,
    gameId,
    tableInfo,
    isLoading,
    isDealing,
    isResolving,
    actionMessage,
    startGame,
    hit,
    stand,
    split,
    doubleDown,
    resetGame,
    canSplit,
    canDoubleDown,
  } = useBlackjack({
    userId: user?.id ?? "",
    refreshProfile,
  });

  useEffect(() => {
    if (status !== "won") {
      hasCelebratedWinRef.current = false;
      return;
    }

    if (hasCelebratedWinRef.current) return;
    hasCelebratedWinRef.current = true;
    toast.success("Blackjack: wygrana!");
    confetti({
      particleCount: 110,
      spread: 64,
      origin: { y: 0.62 },
      colors: ["#22c55e", "#fbbf24", "#ffffff"],
    });
  }, [status]);

  if (!user || !profile) return null;

  if (isLoading) {
    return (
      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col items-center justify-center px-1 pb-2 sm:px-0">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/10 bg-black/35 px-5 py-4 text-sm font-semibold text-white/80 shadow-[0_0_30px_rgba(255,255,255,0.08)] backdrop-blur-md"
        >
          Wczytywanie stołu...
        </motion.div>
      </div>
    );
  }

  const parsedBet = Number(betInput);
  const balance = Number(profile.balance);
  const isBetValid =
    Number.isFinite(parsedBet) && parsedBet > 0 && parsedBet <= balance;

  const handsToRender =
    playerHands.length > 0
      ? playerHands
      : playerHand.length > 0
        ? [
            {
              id: "hand-1",
              cards: playerHand,
              stake,
              payout: 0,
              status: status === "playing" ? "playing" : status,
              doubleDownUsed: false,
              isSplitAces: false,
            },
          ]
        : [];
  const hasSplitHands = handsToRender.length > 1;
  const activeStake = activeHand?.stake ?? stake;
  const dealerValue = calculateHandValue(dealerHand);
  const shoeTotalCards = (tableInfo?.deckCount ?? 2) * 52;
  const isSettled = ["won", "lost", "push"].includes(status);
  const showSplitResult = hasSplitHands && isSettled;
  const splitWins = handsToRender.filter(
    (hand) => hand.status === "won",
  ).length;
  const splitLosses = handsToRender.filter(
    (hand) => hand.status === "lost",
  ).length;
  const splitPushes = handsToRender.filter(
    (hand) => hand.status === "push",
  ).length;
  const resultTitle = showSplitResult
    ? "Wynik splitu"
    : status === "won"
      ? "Wygrana!"
      : status === "lost"
        ? "Porażka"
        : "Remis";
  const dealerSlotKeyPrefix = gameId ?? "pending";
  const dealerSlots = [
    ...dealerHand.map((card, index) => ({
      card,
      hidden: false,
      index,
      key: `dealer-slot-${dealerSlotKeyPrefix}-${index}`,
      testId: undefined,
    })),
    ...(status === "playing"
      ? Array.from({ length: dealerHiddenCount }).map((_, hiddenIndex) => {
          const index = dealerHand.length + hiddenIndex;

          return {
            card: {
              id: `dealer-hidden-${hiddenIndex}`,
              suit: "spades" as const,
              rank: "A" as const,
              value: 11,
            },
            hidden: true,
            index,
            key: `dealer-slot-${dealerSlotKeyPrefix}-${index}`,
            testId: "dealer-hidden-card",
          };
        })
      : []),
  ];

  return (
    <div className="mx-auto grid min-h-0 w-full max-w-7xl flex-1 grid-rows-[minmax(12rem,1fr)_minmax(7rem,auto)_minmax(13rem,1fr)] gap-2 px-1 pb-2 sm:grid-rows-[minmax(13rem,1fr)_minmax(7.5rem,auto)_minmax(14rem,1fr)] sm:gap-3 sm:px-0">
      <div className="flex min-h-0 min-w-0 flex-col items-center justify-center gap-2 overflow-hidden">
        {tableInfo && (
          <div
            data-testid="blackjack-shoe-info"
            className="flex max-w-full flex-wrap items-center justify-center gap-2 px-2 text-xs font-semibold text-white/70"
          >
            <span className="rounded-full border border-white/10 bg-black/35 px-3 py-1 backdrop-blur-md">
              {tableInfo.deckCount} talie
            </span>
            <span className="rounded-full border border-white/10 bg-black/35 px-3 py-1 backdrop-blur-md">
              Pozostało {tableInfo.cardsRemaining}/{shoeTotalCards} kart
            </span>
            <span className="rounded-full border border-white/10 bg-black/35 px-3 py-1 backdrop-blur-md">
              Shoe #{tableInfo.shoeNumber}
            </span>
          </div>
        )}
        {dealerHand.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex min-h-[10.25rem] w-full max-w-full flex-col items-center justify-center gap-2 sm:min-h-[11.75rem] 2xl:min-h-[14.75rem]"
          >
            <span className="bg-black/50 text-white/80 px-3 py-1 rounded-full text-sm font-medium backdrop-blur-md border border-white/10">
              Krupier: {dealerValue}
            </span>
            <div
              data-testid="dealer-hand"
              className="isolate mx-auto flex w-fit max-w-full justify-start overflow-x-auto px-2 pb-2 -space-x-7 [scrollbar-width:none] sm:-space-x-8 [&::-webkit-scrollbar]:hidden"
            >
              {dealerSlots.map(({ card, hidden, index, key, testId }) => (
                <PlayingCard
                  key={key}
                  card={card}
                  hidden={hidden}
                  dealTarget="dealer"
                  index={index}
                  testId={testId}
                />
              ))}
            </div>
          </motion.div>
        )}
      </div>

      <div className="flex min-h-0 min-w-0 flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          {status === "betting" && (
            <motion.div
              key="betting"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex w-full max-w-sm flex-col items-center gap-3 rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-md sm:p-5"
            >
              <h2 className="text-xl font-bold text-white">
                Rozpocznij rozdanie
              </h2>
              <div className="flex w-full flex-col items-stretch gap-3 min-[380px]:flex-row justify-center min-[380px]:items-center">
                <Input
                  type="number"
                  value={betInput}
                  onChange={(e) => setBetInput(e.target.value)}
                  className="h-12 w-full rounded-xl border-white/20 bg-black/40 text-center text-lg text-white min-[380px]:w-32"
                  min="1"
                  step="1"
                />
                <Button
                  onClick={() => {
                    if (!isBetValid) return;
                    startGame(parsedBet);
                  }}
                  disabled={isDealing || !isBetValid}
                  className="h-12 rounded-xl bg-amber-500 px-8 min-[380px]:w-32 font-bold text-black hover:bg-amber-600"
                >
                  {isDealing ? "Rozdawanie..." : "Graj"}
                </Button>
              </div>
              {actionMessage && (
                <p className="rounded-full border border-white/10 bg-black/35 px-3 py-1 text-xs font-semibold text-white/70">
                  {actionMessage}
                </p>
              )}
              <p className="text-sm text-white/50">
                Saldo: {balance.toFixed(2)} zł
              </p>
            </motion.div>
          )}

          {["won", "lost", "push"].includes(status) && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-3 text-center"
            >
              <h2
                className={`text-3xl sm:text-4xl font-black uppercase tracking-wider ${
                  showSplitResult
                    ? "text-amber-200 drop-shadow-[0_0_15px_rgba(251,191,36,0.28)]"
                    : status === "won"
                      ? "text-green-400 drop-shadow-[0_0_15px_rgba(74,222,128,0.5)]"
                      : status === "lost"
                        ? "text-red-400 drop-shadow-[0_0_15px_rgba(248,113,113,0.5)]"
                        : "text-gray-300 drop-shadow-[0_0_15px_rgba(209,213,219,0.5)]"
                }`}
              >
                {resultTitle}
              </h2>
              {showSplitResult && (
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-full border border-amber-300/25 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-50 shadow-[0_0_28px_rgba(251,191,36,0.12)]"
                >
                  Wygrane: {splitWins} • Przegrane: {splitLosses} • Remisy:{" "}
                  {splitPushes}
                </motion.p>
              )}
              {status === "won" && !showSplitResult && (
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 shadow-[0_0_28px_rgba(34,197,94,0.16)]"
                >
                  Blackjack wypłaca nagrodę na saldo.
                </motion.p>
              )}
              <Button
                onClick={resetGame}
                variant="outline"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white focus-visible:text-white rounded-xl px-8"
              >
                Graj ponownie
              </Button>
            </motion.div>
          )}

          {status === "playing" && (
            <motion.div
              key="playing-actions"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex w-full max-w-sm flex-col items-center gap-2 sm:max-w-none sm:gap-3"
            >
              <span
                data-testid="blackjack-action-message-slot"
                className={cn(
                  "min-h-6 rounded-full border border-white/10 bg-black/45 px-3 py-1 text-xs font-semibold text-white/75 backdrop-blur-md",
                  !actionMessage && "invisible",
                )}
              >
                {actionMessage ?? "Status akcji"}
              </span>
              <div className="flex w-full flex-wrap justify-center gap-2 sm:gap-3">
                <Button
                  onClick={hit}
                  disabled={isResolving}
                  variant="secondary"
                  className="h-12 flex-1 rounded-2xl border border-white/20 bg-white/10 px-4 text-base text-white hover:bg-white/20 disabled:opacity-50 sm:h-14 sm:flex-none sm:px-8 sm:text-lg"
                >
                  Hit
                </Button>
                <Button
                  onClick={stand}
                  disabled={isResolving}
                  className="h-12 flex-1 rounded-2xl bg-amber-500 px-4 text-base font-bold text-black hover:bg-amber-600 disabled:opacity-50 sm:h-14 sm:flex-none sm:px-8 sm:text-lg"
                >
                  Stand
                </Button>
                {canSplit && (
                  <Button
                    onClick={split}
                    variant="outline"
                    disabled={isResolving || activeStake > balance}
                    className="h-12 rounded-2xl border-emerald-500/50 bg-emerald-500/20 px-5 text-base text-emerald-100 hover:bg-emerald-500/30 hover:text-white focus-visible:text-white disabled:opacity-50 sm:h-14 sm:px-6 sm:text-lg"
                  >
                    Split
                  </Button>
                )}
                {canDoubleDown && (
                  <Button
                    onClick={doubleDown}
                    variant="outline"
                    disabled={isResolving || activeStake > balance}
                    className="h-12 rounded-2xl border-blue-500/50 bg-blue-500/20 px-5 text-base text-blue-100 hover:bg-blue-500/30 hover:text-white focus-visible:text-white disabled:opacity-50 sm:h-14 sm:px-6 sm:text-lg"
                  >
                    Double Down
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex min-h-0 min-w-0 flex-col items-center justify-center overflow-hidden">
        {handsToRender.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex min-h-0 w-full flex-col items-center gap-2"
          >
            <div
              className={cn(
                "mx-auto flex w-full max-w-full gap-3 overflow-x-auto px-2 pb-2",
                hasSplitHands
                  ? "justify-start xl:justify-center"
                  : "justify-center",
              )}
            >
              {handsToRender.map((hand, handIndex) => {
                const value = calculateHandValue(hand.cards);
                const isActive =
                  status === "playing" && handIndex === activeHandIndex;

                return (
                  <div
                    key={hand.id}
                    className={cn(
                      "flex flex-col items-center gap-2",
                      hasSplitHands &&
                        "w-[17rem] max-w-[calc(100vw-2rem)] shrink-0 rounded-2xl border bg-black/35 p-3 backdrop-blur-md lg:w-[18rem]",
                      hasSplitHands &&
                        (isActive
                          ? "border-amber-300/60 shadow-[0_0_26px_rgba(251,191,36,0.2)]"
                          : "border-white/10"),
                    )}
                  >
                    {hasSplitHands && (
                      <div className="flex w-full items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                        <span>Ręka {handIndex + 1}</span>
                        {isActive && (
                          <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] text-amber-100">
                            Aktywna
                          </span>
                        )}
                      </div>
                    )}
                    <div
                      data-testid={
                        handIndex === activeHandIndex
                          ? "player-hand"
                          : undefined
                      }
                      className="relative z-10 flex max-w-full justify-center overflow-visible px-2 pb-2 -space-x-10 sm:-space-x-12"
                    >
                      {hand.cards.map((card, i) => (
                        <PlayingCard
                          key={card.id ?? `player-${hand.id}-${i}`}
                          card={card}
                          dealTarget="player"
                          index={i}
                        />
                      ))}
                    </div>
                    <span
                      className={cn(
                        "rounded-full border border-white/10 px-4 py-1.5 text-base font-bold backdrop-blur-md",
                        value > 21
                          ? "bg-red-500/80 text-white"
                          : value === 21
                            ? "bg-green-500/80 text-white"
                            : "bg-black/50 text-white/90",
                      )}
                    >
                      Ty: {value}
                    </span>
                    <span className="text-sm text-white/40">
                      Stawka: {hand.stake.toFixed(2)} zł
                    </span>
                  </div>
                );
              })}
            </div>
            {handsToRender.length === 1 && (
              <span className="text-white/40 text-sm mt-1">
                Łączna stawka: {stake.toFixed(2)} zł
              </span>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
