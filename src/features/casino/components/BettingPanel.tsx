import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  Hash,
  Palette,
  ArrowUpDown,
  ArrowDownUp,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  getRouletteBetTypeLabel,
  getRouletteBetValueOptions,
  getRouletteColor,
} from "@/features/casino/lib/roulette";
import type { RouletteBetType } from "@/types/database";

interface BettingPanelProps {
  betType: RouletteBetType | "";
  betValue: string;
  winningNumber?: number | null;
  onBetTypeChange: (value: RouletteBetType) => void;
  onBetValueChange: (value: string) => void;
}

const BET_TYPE_CONFIG: {
  type: RouletteBetType;
  icon: React.ReactNode;
  desc: string;
}[] = [
  { type: "straight", icon: <Hash className="h-4 w-4" />, desc: "x36" },
  { type: "color", icon: <Palette className="h-4 w-4" />, desc: "x2" },
  {
    type: "parity",
    icon: <ArrowUpDown className="h-4 w-4" />,
    desc: "x2",
  },
  {
    type: "range",
    icon: <ArrowDownUp className="h-4 w-4" />,
    desc: "x2",
  },
];

// Maps a settled winning number onto the option value it satisfies for the
// given bet type, so the matching field can light up after the spin.
function getWinningOptionValue(
  betType: RouletteBetType,
  winningNumber: number,
): string | null {
  switch (betType) {
    case "straight":
      return String(winningNumber);
    case "color":
      return getRouletteColor(winningNumber);
    case "parity":
      if (winningNumber === 0) return null;
      return winningNumber % 2 === 0 ? "even" : "odd";
    case "range":
      if (winningNumber === 0) return null;
      return winningNumber <= 18 ? "low" : "high";
  }
}

function getValueButtonClass(
  betType: RouletteBetType,
  value: string,
  selected: boolean,
  isWinning: boolean,
) {
  const base =
    "rounded-lg border px-1 py-2 text-sm font-medium transition-all sm:px-2";

  let palette: string;
  if (betType === "straight") {
    const color = getRouletteColor(Number(value));
    palette =
      color === "green"
        ? "border-emerald-300/40 bg-emerald-500/20 font-bold text-emerald-50 hover:bg-emerald-500/30"
        : color === "red"
          ? "border-red-300/30 bg-red-600/25 font-bold text-red-50 hover:bg-red-500/35"
          : "border-white/15 bg-black/50 font-bold text-white hover:bg-white/10";
  } else if (betType === "color") {
    palette =
      value === "red"
        ? "border-red-300/30 bg-red-600/25 font-bold text-red-50 hover:bg-red-500/35"
        : "border-white/15 bg-black/50 font-bold text-white hover:bg-white/10";
  } else {
    palette =
      "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20 hover:bg-white/[0.06]";
  }

  return cn(
    base,
    palette,
    selected &&
      "ring-2 ring-amber-300 ring-offset-1 ring-offset-black shadow-[0_0_12px_rgba(245,158,11,0.25)]",
    isWinning &&
      "ring-2 ring-emerald-300/90 shadow-[0_0_16px_rgba(16,185,129,0.45)]",
  );
}

export function BettingPanel({
  betType,
  betValue,
  winningNumber = null,
  onBetTypeChange,
  onBetValueChange,
}: BettingPanelProps) {
  const winningOptionValue =
    betType && winningNumber !== null
      ? getWinningOptionValue(betType, winningNumber)
      : null;

  const betTypeSelector = (
    <div className="grid grid-cols-2 gap-2">
      {BET_TYPE_CONFIG.map(({ type, icon, desc }) => {
        const label = getRouletteBetTypeLabel(type);
        const active = betType === type;
        return (
          <button
            key={type}
            type="button"
            onClick={() => onBetTypeChange(type)}
            className={cn(
              "flex items-center gap-2 rounded-xl border p-2.5 transition-all duration-200 sm:gap-3 sm:p-3",
              active
                ? "border-amber-500/50 bg-amber-500/10 shadow-[0_0_20px_rgba(245,158,11,0.12)]"
                : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]",
            )}
          >
            <span
              className={cn(
                "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-colors",
                active
                  ? "bg-amber-500/20 text-amber-300"
                  : "bg-white/5 text-white/50",
              )}
            >
              {icon}
            </span>
            <div className="min-w-0 text-left">
              <p
                className={cn(
                  "text-sm font-semibold",
                  active ? "text-amber-200" : "text-white/80",
                )}
              >
                {label}
              </p>
              <p className="text-[10px] text-white/40">{desc}</p>
            </div>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-3" data-testid="roulette-bet-panel">
      <div className="hidden rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm md:block">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">
          Typ zakładu
        </p>
        {betTypeSelector}
      </div>

      <Collapsible className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm md:hidden">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 text-left">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/40">
            Typ zakładu
          </span>
          <span className="flex items-center gap-2 text-sm font-semibold text-amber-200">
            {betType ? getRouletteBetTypeLabel(betType) : "Wybierz"}
            <ChevronDown className="h-4 w-4 text-white/40" />
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          {betTypeSelector}
        </CollapsibleContent>
      </Collapsible>

      <div className="overflow-hidden">
        {betType && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={betType}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ type: "spring", stiffness: 760, damping: 44 }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
                    Wartość
                  </p>
                  <p className="text-[10px] font-bold text-amber-200/70">
                    wypłata {betType === "straight" ? "x36" : "x2"}
                  </p>
                </div>
                <div
                  data-testid="roulette-bet-value-grid"
                  className={cn(
                    "grid gap-2",
                    betType === "straight"
                      ? "grid-cols-5 sm:grid-cols-6"
                      : "grid-cols-2",
                  )}
                >
                  {getRouletteBetValueOptions(betType).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onBetValueChange(opt.value)}
                      className={getValueButtonClass(
                        betType,
                        opt.value,
                        betValue === opt.value,
                        winningOptionValue === opt.value,
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
