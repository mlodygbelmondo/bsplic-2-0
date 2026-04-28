import { useMemo, useState, type CSSProperties } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { RouletteWheel } from "@/features/casino/components/RouletteWheel";
import { getRouletteColor } from "@/features/casino/lib/roulette";
import {
  getRouletteBallAngleOffset,
  type RouletteBallAngleOffsets,
  ROULETTE_WHEEL_NUMBERS,
} from "@/features/casino/lib/rouletteWheel";

type CasinoBackgroundStyle = CSSProperties & {
  "--casino-bg-desktop": string;
  "--casino-bg-mobile": string;
};

type PreviewMode = "fast" | "instant";

const DEV_SPIN_TIMING = {
  settleDelayMs: 0,
  settleDurationMs: 0,
  spinDurationMs: 300,
};

const sortedRouletteNumbers = Array.from({ length: 37 }, (_, index) => index);

function getNumberButtonClass(number: number, selectedNumber: number) {
  const color = getRouletteColor(number);

  return cn(
    "h-10 rounded-lg border text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300",
    color === "green" &&
      "border-emerald-300/60 bg-emerald-500/25 text-emerald-50 hover:bg-emerald-500/35",
    color === "red" &&
      "border-red-300/50 bg-red-600/30 text-red-50 hover:bg-red-500/40",
    color === "black" &&
      "border-white/15 bg-black/55 text-white hover:bg-white/10",
    selectedNumber === number &&
      "ring-2 ring-amber-300 ring-offset-2 ring-offset-black",
  );
}

export default function CasinoRouletteDevPage() {
  const [selectedNumber, setSelectedNumber] = useState(0);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("fast");
  const [spinKey, setSpinKey] = useState(1);
  const [angleOffsetsDeg, setAngleOffsetsDeg] =
    useState<RouletteBallAngleOffsets>({});
  const [offsetInput, setOffsetInput] = useState(() =>
    String(getRouletteBallAngleOffset(0)),
  );

  const parsedOffset = Number(offsetInput);
  const selectedCodeOffset = getRouletteBallAngleOffset(selectedNumber);
  const selectedPreviewOffset = Number.isFinite(parsedOffset)
    ? parsedOffset
    : selectedCodeOffset;
  const selectedWheelIndex = ROULETTE_WHEEL_NUMBERS.indexOf(selectedNumber);
  const phase = previewMode === "instant" ? "settled" : "spinning";
  const roundId = `dev-${previewMode}-${selectedNumber}-${spinKey}`;

  const previewOffsets = useMemo(
    () => ({
      ...angleOffsetsDeg,
      [selectedNumber]: selectedPreviewOffset,
    }),
    [angleOffsetsDeg, selectedNumber, selectedPreviewOffset],
  );

  const handleSelectNumber = (number: number) => {
    setSelectedNumber(number);
    setOffsetInput(
      String(angleOffsetsDeg[number] ?? getRouletteBallAngleOffset(number)),
    );
    setSpinKey((current) => current + 1);
  };

  const handleOffsetChange = (value: string) => {
    setOffsetInput(value);

    const nextOffset = Number(value);
    if (!Number.isFinite(nextOffset)) return;

    setAngleOffsetsDeg((current) => ({
      ...current,
      [selectedNumber]: nextOffset,
    }));
  };

  const handleResetOffset = () => {
    const nextOffset = getRouletteBallAngleOffset(selectedNumber);
    setOffsetInput(String(nextOffset));
    setAngleOffsetsDeg((current) => {
      const next = { ...current };
      delete next[selectedNumber];
      return next;
    });
  };

  return (
    <div
      data-testid="casino-roulette-dev-shell"
      className="casino-responsive-bg relative min-h-full w-full overflow-hidden bg-cover bg-center bg-no-repeat"
      style={
        {
          "--casino-bg-desktop": "url('/casino/roulette-background.webp')",
          "--casino-bg-mobile":
            "url('/casino/roulette-mobile-background.webp')",
        } as CasinoBackgroundStyle
      }
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.14),transparent_35%),linear-gradient(180deg,rgba(8,4,6,0.52),rgba(5,4,7,0.84)_55%,rgba(5,4,7,0.96))]" />
      <div className="relative z-10 mx-auto grid w-full max-w-[1500px] gap-5 p-4 pb-10 pt-6 text-white md:p-6 md:pb-14 xl:grid-cols-[minmax(360px,440px)_1fr]">
        <section className="space-y-5 rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-amber-200/80">
              Ruletka dev
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
              Podgląd lądowania kulki
            </h1>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-black/30 p-1">
            <Button
              type="button"
              variant={previewMode === "fast" ? "default" : "ghost"}
              className={cn(
                "h-10 rounded-xl text-sm font-bold",
                previewMode === "fast"
                  ? "bg-amber-400 text-black hover:bg-amber-300"
                  : "text-white/70 hover:bg-white/10 hover:text-white",
              )}
              onClick={() => {
                setPreviewMode("fast");
                setSpinKey((current) => current + 1);
              }}
            >
              0.3s
            </Button>
            <Button
              type="button"
              variant={previewMode === "instant" ? "default" : "ghost"}
              className={cn(
                "h-10 rounded-xl text-sm font-bold",
                previewMode === "instant"
                  ? "bg-amber-400 text-black hover:bg-amber-300"
                  : "text-white/70 hover:bg-white/10 hover:text-white",
              )}
              onClick={() => setPreviewMode("instant")}
            >
              Instant
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-white/80">Wybrany numer</span>
              <span
                data-testid="roulette-dev-selected-number"
                className="rounded-lg bg-amber-400 px-3 py-1 font-mono text-lg font-black text-black"
              >
                {selectedNumber}
              </span>
            </div>
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
              {sortedRouletteNumbers.map((number) => (
                <button
                  key={number}
                  type="button"
                  className={getNumberButtonClass(number, selectedNumber)}
                  onClick={() => handleSelectNumber(number)}
                >
                  {number}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-white/10 bg-black/25 p-4">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-white/80">
                Offset kulki dla numeru {selectedNumber}
              </span>
              <Input
                data-testid="roulette-dev-offset-input"
                type="number"
                step="0.1"
                value={offsetInput}
                className="border-white/10 bg-black/40 font-mono text-white"
                onChange={(event) => handleOffsetChange(event.target.value)}
              />
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs text-white/55">
              <div>
                Kodowy offset:{" "}
                <span className="font-mono text-white">
                  {selectedCodeOffset}deg
                </span>
              </div>
              <div>
                Indeks na kole:{" "}
                <span className="font-mono text-white">
                  {selectedWheelIndex}
                </span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              onClick={handleResetOffset}
            >
              Reset offsetu
            </Button>
          </div>
        </section>

        <section className="flex min-w-0 items-center justify-center rounded-3xl border border-white/10 bg-black/25 p-4 backdrop-blur-xl md:p-8">
          <RouletteWheel
            angleOffsetsDeg={previewOffsets}
            animationTiming={
              previewMode === "fast" ? DEV_SPIN_TIMING : undefined
            }
            phase={phase}
            winningNumber={selectedNumber}
            spinStartedAt={null}
            roundId={roundId}
          />
        </section>
      </div>
    </div>
  );
}
