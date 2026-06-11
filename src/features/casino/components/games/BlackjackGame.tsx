import { useCallback, useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import {
  useBlackjack,
  calculateHandValue,
} from "@/features/casino/hooks/useBlackjack";
import { isSfxMuted, setSfxMuted } from "@/features/casino/lib/blackjackSfx";
import { cn } from "@/lib/utils";

import { PlayingCard } from "./PlayingCard";

const LAST_STAKE_STORAGE_KEY = "bsplic.blackjack.lastStake";
const QUICK_STAKES = [10, 25, 50, 100, 250, 1000];

function readLastStake(): string {
  try {
    const raw = window.localStorage.getItem(LAST_STAKE_STORAGE_KEY);
    const value = Number(raw);
    if (Number.isFinite(value) && value > 0) return String(value);
  } catch {
    // localStorage unavailable — fall back to the default stake.
  }
  return "10";
}

function storeLastStake(stake: number): void {
  try {
    window.localStorage.setItem(LAST_STAKE_STORAGE_KEY, String(stake));
  } catch {
    // Best effort only.
  }
}

/** Animated payout counter for the result screen. */
function CountUpAmount({ value, prefix = "" }: { value: number; prefix?: string }) {
  const reducedMotion = useReducedMotion();
  const [display, setDisplay] = useState(reducedMotion ? value : 0);

  useEffect(() => {
    if (reducedMotion) {
      setDisplay(value);
      return;
    }

    let raf = 0;
    const start = performance.now();
    const duration = 900;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(value * eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reducedMotion]);

  return (
    <span data-testid="blackjack-payout-countup">
      {prefix}
      {display.toFixed(2)} zł
    </span>
  );
}

export function BlackjackGame() {
  const { user, profile, refreshProfile } = useAuth();
  const [betInput, setBetInput] = useState(readLastStake);
  const [muted, setMuted] = useState(isSfxMuted);
  const hasCelebratedWinRef = useRef(false);
  const handsRailRef = useRef<HTMLDivElement | null>(null);
  const handRefs = useRef(new Map<number, HTMLDivElement>());

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
    isRevealing,
    actionMessage,
    insuranceStake,
    insurancePayout,
    startGame,
    hit,
    stand,
    split,
    doubleDown,
    takeInsurance,
    declineInsurance,
    resetGame,
    canSplit,
    canDoubleDown,
    canTakeInsurance,
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

  const isDecisionState = status === "playing" || status === "insurance";

  // Keep the active split hand centered in the carousel.
  useEffect(() => {
    if (!isDecisionState || playerHands.length < 2) return;
    const rail = handsRailRef.current;
    const target = handRefs.current.get(activeHandIndex);
    if (!rail || !target) return;
    const offset = Math.max(
      target.offsetLeft - (rail.clientWidth - target.clientWidth) / 2,
      0,
    );
    if (typeof rail.scrollTo === "function") {
      rail.scrollTo({ left: offset, behavior: "smooth" });
    } else {
      rail.scrollLeft = offset;
    }
  }, [activeHandIndex, playerHands.length, isDecisionState]);

  const toggleMute = useCallback(() => {
    setMuted((current) => {
      setSfxMuted(!current);
      return !current;
    });
  }, []);

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
  const maxStake = Math.max(0, Math.floor(balance));
  const isBetValid =
    Number.isFinite(parsedBet) && parsedBet > 0 && parsedBet <= balance;
  const lastStake = Number(readLastStake());
  const canRepeatStake =
    Number.isFinite(lastStake) && lastStake > 0 && lastStake <= balance;
  const fallbackHandStatus =
    status === "won" || status === "lost" || status === "push"
      ? status
      : "playing";

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
              status: fallbackHandStatus,
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
  const totalPayout =
    handsToRender.reduce((sum, hand) => sum + hand.payout, 0) + insurancePayout;
  const netResult = totalPayout - stake;
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
    ...(isDecisionState
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

  const handleStartGame = (amount: number) => {
    if (isDealing || isResolving || isRevealing) return;
    storeLastStake(amount);
    setBetInput(String(amount));
    void startGame(amount);
  };

  const handlePlayAgain = () => {
    if (!canRepeatStake) {
      resetGame();
      return;
    }
    handleStartGame(lastStake);
  };

  return (
    <div className="mx-auto grid min-h-0 w-full max-w-7xl flex-1 grid-rows-[minmax(12rem,1fr)_minmax(7rem,auto)_minmax(13rem,1fr)] gap-2 px-1 pb-2 sm:grid-rows-[minmax(13rem,1fr)_minmax(7.5rem,auto)_minmax(14rem,1fr)] sm:gap-3 sm:px-0">
      <div className="flex min-h-0 min-w-0 flex-col items-center justify-center gap-2 overflow-hidden">
        {tableInfo && (
          <div
            data-testid="blackjack-shoe-info"
            className="flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 px-2 text-[11px] font-semibold text-white/45"
          >
            <span>{tableInfo.deckCount} talie</span>
            <span aria-hidden className="text-white/25">
              •
            </span>
            <span>
              Pozostało {tableInfo.cardsRemaining}/{shoeTotalCards} kart
            </span>
            <span aria-hidden className="text-white/25">
              •
            </span>
            <span>Shoe #{tableInfo.shoeNumber}</span>
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? "Włącz dźwięki" : "Wycisz dźwięki"}
              className="ml-1 rounded-full border border-white/10 bg-black/35 p-1.5 text-white/55 backdrop-blur-md transition-colors hover:text-white"
            >
              {muted ? (
                <VolumeX className="h-3.5 w-3.5" />
              ) : (
                <Volume2 className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        )}
        {dealerHand.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex min-h-[10.25rem] w-full max-w-full flex-col items-center justify-center gap-2 sm:min-h-[11.75rem] 2xl:min-h-[14.75rem]"
          >
            <span className="rounded-full border border-white/10 bg-black/50 px-3 py-1 text-sm font-medium text-white/80 backdrop-blur-md">
              Krupier: {dealerValue}
              {dealerHiddenCount > 0 && isDecisionState ? " + ?" : ""}
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
              <div className="flex w-full flex-col gap-1.5">
                <div className="flex w-full gap-1.5">
                  {QUICK_STAKES.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setBetInput(String(amount))}
                      disabled={amount > balance}
                      className={cn(
                        "h-9 min-w-0 flex-1 basis-0 rounded-full border px-2 text-sm font-bold backdrop-blur-md transition-colors",
                        Number(betInput) === amount
                          ? "border-amber-300/70 bg-amber-400/20 text-amber-100"
                          : "border-white/15 bg-black/35 text-white/75 hover:border-white/30 hover:text-white",
                        amount > balance && "opacity-35",
                      )}
                    >
                      {amount}
                    </button>
                  ))}
                </div>
                <div className="flex w-full gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBetInput("1")}
                    disabled={balance < 1}
                    className="h-9 min-w-0 flex-1 basis-0 rounded-full border border-white/15 bg-black/35 px-2 text-sm font-bold text-white/75 backdrop-blur-md transition-colors hover:border-white/30 hover:text-white disabled:opacity-35"
                  >
                    MIN
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setBetInput(String(Math.max(1, Math.floor(balance / 4))))
                    }
                    disabled={balance < 1}
                    className="h-9 min-w-0 flex-1 basis-0 rounded-full border border-white/15 bg-black/35 px-2 text-sm font-bold text-white/75 backdrop-blur-md transition-colors hover:border-white/30 hover:text-white disabled:opacity-35"
                  >
                    1/4
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setBetInput(String(Math.max(1, Math.floor(balance / 2))))
                    }
                    disabled={balance < 1}
                    className="h-9 min-w-0 flex-1 basis-0 rounded-full border border-white/15 bg-black/35 px-2 text-sm font-bold text-white/75 backdrop-blur-md transition-colors hover:border-white/30 hover:text-white disabled:opacity-35"
                  >
                    1/2
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setBetInput((current) => {
                        const value = Number(current);
                        if (!Number.isFinite(value) || value <= 0) {
                          return current;
                        }
                        if (maxStake < 1) return current;
                        return String(Math.min(value * 2, maxStake));
                      })
                    }
                    disabled={balance < 1}
                    className="h-9 min-w-0 flex-1 basis-0 rounded-full border border-white/15 bg-black/35 px-2 text-sm font-bold text-white/75 backdrop-blur-md transition-colors hover:border-white/30 hover:text-white disabled:opacity-35"
                  >
                    x2
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setBetInput((current) => {
                        const value = Number(current);
                        if (!Number.isFinite(value) || value <= 0) {
                          return current;
                        }
                        if (maxStake < 1) return current;
                        return String(Math.min(value * 4, maxStake));
                      })
                    }
                    disabled={balance < 1}
                    className="h-9 min-w-0 flex-1 basis-0 rounded-full border border-white/15 bg-black/35 px-2 text-sm font-bold text-white/75 backdrop-blur-md transition-colors hover:border-white/30 hover:text-white disabled:opacity-35"
                  >
                    x4
                  </button>
                  <button
                    type="button"
                    onClick={() => setBetInput(String(maxStake))}
                    disabled={balance < 1}
                    className="h-9 min-w-0 flex-1 basis-0 rounded-full border border-white/15 bg-black/35 px-2 text-sm font-bold text-white/75 backdrop-blur-md transition-colors hover:border-white/30 hover:text-white disabled:opacity-35"
                  >
                    MAX
                  </button>
                </div>
              </div>
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
                    handleStartGame(parsedBet);
                  }}
                  disabled={isDealing || !isBetValid}
                  className="h-12 rounded-xl bg-gradient-to-b from-amber-400 to-amber-600 px-8 min-[380px]:w-32 font-bold text-black shadow-[0_4px_18px_rgba(251,191,36,0.3)] hover:from-amber-500 hover:to-amber-600"
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

          {isSettled && (
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
              {status === "won" && netResult > 0 && (
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-2xl font-black text-green-300 drop-shadow-[0_0_18px_rgba(74,222,128,0.4)]"
                >
                  <CountUpAmount value={netResult} prefix="+" />
                </motion.p>
              )}
              {status === "push" && totalPayout > 0 && (
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-lg font-bold text-white/75"
                >
                  Zwrot: <CountUpAmount value={totalPayout} />
                </motion.p>
              )}
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
              {insurancePayout > 0 && (
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-full border border-sky-300/25 bg-sky-400/10 px-4 py-2 text-sm font-semibold text-sky-50 shadow-[0_0_28px_rgba(56,189,248,0.12)]"
                >
                  Insurance wypłaciło {insurancePayout.toFixed(2)} zł.
                </motion.p>
              )}
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  onClick={handlePlayAgain}
                  disabled={isDealing}
                  className="rounded-xl bg-gradient-to-b from-amber-400 to-amber-600 px-7 font-bold text-black shadow-[0_4px_18px_rgba(251,191,36,0.3)] hover:from-amber-500 hover:to-amber-600 hover:text-black focus-visible:text-black"
                >
                  {canRepeatStake
                    ? `Graj ponownie (${lastStake.toFixed(0)} zł)`
                    : "Graj ponownie"}
                </Button>
                <Button
                  onClick={resetGame}
                  variant="outline"
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white focus-visible:text-white rounded-xl px-5"
                >
                  Zmień stawkę
                </Button>
              </div>
            </motion.div>
          )}

          {status === "insurance" && (
            <motion.div
              key="insurance-actions"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex w-full max-w-sm flex-col items-center gap-2 rounded-2xl border border-sky-300/20 bg-black/35 px-4 py-3 text-center backdrop-blur-md sm:max-w-md"
            >
              <span className="text-lg font-black text-white">Insurance?</span>
              <span className="text-sm font-semibold text-white/65">
                Stawka insurance: {insuranceStake.toFixed(2)} zł
              </span>
              {actionMessage && (
                <span className="rounded-full border border-white/10 bg-black/45 px-3 py-1 text-xs font-semibold text-white/75 backdrop-blur-md">
                  {actionMessage}
                </span>
              )}
              <div className="flex w-full flex-wrap justify-center gap-2 sm:gap-3">
                <Button
                  onClick={takeInsurance}
                  disabled={
                    !canTakeInsurance || isResolving || insuranceStake > balance
                  }
                  variant="outline"
                  className="h-12 flex-1 rounded-2xl border-sky-400/50 bg-sky-500/20 px-4 text-base font-bold text-sky-50 hover:bg-sky-500/30 hover:text-white focus-visible:text-white disabled:opacity-50 sm:flex-none sm:px-7"
                >
                  Insurance
                </Button>
                <Button
                  onClick={declineInsurance}
                  disabled={isResolving}
                  variant="secondary"
                  className="h-12 flex-1 rounded-2xl border border-white/20 bg-white/10 px-4 text-base text-white hover:bg-white/20 disabled:opacity-50 sm:flex-none sm:px-7"
                >
                  No Insurance
                </Button>
              </div>
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
                  disabled={isResolving || isRevealing}
                  variant="secondary"
                  className="h-12 flex-1 rounded-2xl border border-white/20 bg-white/10 px-4 text-base text-white hover:bg-white/20 disabled:opacity-50 sm:h-14 sm:flex-none sm:px-8 sm:text-lg"
                >
                  Hit
                </Button>
                <Button
                  onClick={stand}
                  disabled={isResolving || isRevealing}
                  className="h-12 flex-1 rounded-2xl bg-gradient-to-b from-amber-400 to-amber-600 px-4 text-base font-bold text-black shadow-[0_4px_18px_rgba(251,191,36,0.3)] hover:from-amber-500 hover:to-amber-600 disabled:opacity-50 sm:h-14 sm:flex-none sm:px-8 sm:text-lg"
                >
                  Stand
                </Button>
                {canSplit && (
                  <Button
                    onClick={split}
                    variant="outline"
                    disabled={isResolving || isRevealing || activeStake > balance}
                    className="h-12 rounded-2xl border-white/20 bg-white/10 px-5 text-base text-white hover:bg-white/20 hover:text-white focus-visible:text-white disabled:opacity-50 sm:h-14 sm:px-6 sm:text-lg"
                  >
                    Split
                  </Button>
                )}
                {canDoubleDown && (
                  <Button
                    onClick={doubleDown}
                    variant="outline"
                    disabled={isResolving || isRevealing || activeStake > balance}
                    className="h-12 rounded-2xl border-white/20 bg-white/10 px-5 text-base text-white hover:bg-white/20 hover:text-white focus-visible:text-white disabled:opacity-50 sm:h-14 sm:px-6 sm:text-lg"
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
              ref={handsRailRef}
              className={cn(
                "mx-auto flex w-full max-w-full gap-3 overflow-x-auto px-2 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                hasSplitHands
                  ? "snap-x snap-mandatory justify-start xl:justify-center"
                  : "justify-center",
              )}
            >
              {handsToRender.map((hand, handIndex) => {
                const value = calculateHandValue(hand.cards);
                const isActive =
                  isDecisionState && handIndex === activeHandIndex;
                const isDimmed =
                  hasSplitHands && isDecisionState && !isActive;

                return (
                  <div
                    key={hand.id}
                    ref={(node) => {
                      if (node) {
                        handRefs.current.set(handIndex, node);
                      } else {
                        handRefs.current.delete(handIndex);
                      }
                    }}
                    className={cn(
                      "flex flex-col items-center gap-2 transition-[opacity,transform] duration-300",
                      hasSplitHands &&
                        "w-[17rem] max-w-[calc(100vw-2rem)] shrink-0 snap-center rounded-2xl border bg-black/35 p-3 backdrop-blur-md lg:w-[18rem]",
                      hasSplitHands &&
                        (isActive
                          ? "border-amber-300/60 shadow-[0_0_26px_rgba(251,191,36,0.2)]"
                          : isSettled
                            ? hand.status === "won"
                              ? "border-emerald-300/45 shadow-[0_0_22px_rgba(16,185,129,0.14)]"
                              : hand.status === "push"
                                ? "border-white/20"
                                : "border-red-400/30"
                            : "border-white/10"),
                      isDimmed && "scale-[0.96] opacity-55",
                    )}
                  >
                    {hasSplitHands && (
                      <div className="flex w-full items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                        <span className="flex items-center gap-1.5">
                          Ręka {handIndex + 1}
                          {hand.isSplitAces && (
                            <span className="rounded-full border border-amber-300/40 bg-amber-400/15 px-1.5 py-0.5 text-[9px] tracking-normal text-amber-100">
                              ASY
                            </span>
                          )}
                        </span>
                        {isActive && (
                          <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] text-amber-100">
                            Aktywna
                          </span>
                        )}
                        {isSettled && hand.status !== "playing" && (
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-bold tracking-normal",
                              hand.status === "won"
                                ? "bg-emerald-400/20 text-emerald-100"
                                : hand.status === "push"
                                  ? "bg-white/15 text-white/80"
                                  : "bg-red-500/20 text-red-200",
                            )}
                          >
                            {hand.status === "won"
                              ? `✓ +${hand.payout.toFixed(2)} zł`
                              : hand.status === "push"
                                ? `= ${hand.payout.toFixed(2)} zł`
                                : "✗ przegrana"}
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
