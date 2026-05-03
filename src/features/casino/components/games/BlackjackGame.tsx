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
    status,
    stake,
    isDealing,
    isResolving,
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
  const activeStake = activeHand?.stake ?? stake;
  const dealerValue =
    status === "playing"
      ? calculateHandValue(dealerHand.slice(0, 1))
      : calculateHandValue(dealerHand);

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col justify-between gap-2 px-1 pb-2 sm:gap-3 sm:px-0">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
        {dealerHand.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex min-h-0 flex-col items-center gap-2"
          >
            <span className="bg-black/50 text-white/80 px-3 py-1 rounded-full text-sm font-medium backdrop-blur-md border border-white/10">
              Krupier: {dealerValue}
            </span>
            <div
              data-testid="dealer-hand"
              className="flex max-w-full overflow-x-auto px-2 pb-2 -space-x-10 sm:-space-x-12"
            >
              {dealerHand.map((card, i) => (
                <PlayingCard
                  key={`dealer-${i}`}
                  card={card}
                  hidden={status === "playing" && i === 1}
                />
              ))}
            </div>
          </motion.div>
        )}
      </div>

      <div className="flex min-h-[96px] shrink-0 flex-col items-center justify-center sm:min-h-[108px]">
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
                  Graj
                </Button>
              </div>
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
                  status === "won"
                    ? "text-green-400 drop-shadow-[0_0_15px_rgba(74,222,128,0.5)]"
                    : status === "lost"
                      ? "text-red-400 drop-shadow-[0_0_15px_rgba(248,113,113,0.5)]"
                      : "text-gray-300 drop-shadow-[0_0_15px_rgba(209,213,219,0.5)]"
                }`}
              >
                {status === "won"
                  ? "Wygrana!"
                  : status === "lost"
                    ? "Porażka"
                    : "Remis"}
              </h2>
              {status === "won" && (
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
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-xl px-8"
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
              className="flex w-full max-w-sm flex-wrap justify-center gap-2 sm:max-w-none sm:gap-3"
            >
              <Button
                onClick={hit}
                disabled={isResolving}
                variant="secondary"
                className="h-12 flex-1 rounded-2xl border border-white/20 bg-white/10 px-4 text-base text-white hover:bg-white/20 disabled:opacity-50 sm:h-14 sm:flex-none sm:px-8 sm:text-lg"
              >
                Dobierz (Hit)
              </Button>
              <Button
                onClick={stand}
                disabled={isResolving}
                className="h-12 flex-1 rounded-2xl bg-amber-500 px-4 text-base font-bold text-black hover:bg-amber-600 disabled:opacity-50 sm:h-14 sm:flex-none sm:px-8 sm:text-lg"
              >
                Czekaj (Stand)
              </Button>
              {canSplit && (
                <Button
                  onClick={split}
                  variant="outline"
                  disabled={isResolving || activeStake > balance}
                  className="h-12 rounded-2xl border-emerald-500/50 bg-emerald-500/20 px-5 text-base text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-50 sm:h-14 sm:px-6 sm:text-lg"
                >
                  Split
                </Button>
              )}
              {canDoubleDown && (
                <Button
                  onClick={doubleDown}
                  variant="outline"
                  disabled={isResolving || activeStake > balance}
                  className="h-12 rounded-2xl border-blue-500/50 bg-blue-500/20 px-5 text-base text-blue-300 hover:bg-blue-500/30 disabled:opacity-50 sm:h-14 sm:px-6 sm:text-lg"
                >
                  Double Down
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
        {handsToRender.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex min-h-0 w-full flex-col items-center gap-2"
          >
            <div className="flex w-full max-w-full gap-3 overflow-x-auto px-2 pb-2">
              {handsToRender.map((hand, handIndex) => {
                const value = calculateHandValue(hand.cards);
                const isActive =
                  status === "playing" && handIndex === activeHandIndex;

                return (
                  <div
                    key={hand.id}
                    className={cn(
                      "flex min-w-[210px] flex-col items-center gap-2 rounded-2xl border bg-black/35 p-3 backdrop-blur-md",
                      isActive
                        ? "border-amber-300/60 shadow-[0_0_26px_rgba(251,191,36,0.2)]"
                        : "border-white/10",
                    )}
                  >
                    <div className="flex w-full items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                      <span>Ręka {handIndex + 1}</span>
                      {isActive && (
                        <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] text-amber-100">
                          Aktywna
                        </span>
                      )}
                    </div>
                    <div
                      data-testid={
                        handIndex === activeHandIndex
                          ? "player-hand"
                          : undefined
                      }
                      className="relative z-10 flex max-w-full overflow-x-auto px-2 pb-2 -space-x-10 sm:-space-x-12"
                    >
                      {hand.cards.map((card, i) => (
                        <PlayingCard
                          key={`player-${hand.id}-${i}`}
                          card={card}
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
