import { motion } from 'framer-motion';
import { Check, RotateCcw, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  formatRouletteBetValue,
  getRouletteBetTypeLabel,
  getRouletteColor,
  getRouletteColorLabel,
  getRoulettePayoutMultiplier,
} from '@/features/casino/lib/roulette';
import type {
  RouletteBetRecord,
  RouletteBetType,
  RouletteColor,
} from '@/types/database';

interface MyBetsStripProps {
  liveBets: RouletteBetRecord[];
  settledBets: RouletteBetRecord[];
  resultNumber: number | null;
  resultColor: RouletteColor | null;
  isRepeating: boolean;
  onRepeat: () => void;
}

function getBetChipColor(
  betType: RouletteBetType,
  betValue: string,
): RouletteColor | null {
  if (betType === 'straight') {
    const parsed = Number(betValue);
    return Number.isInteger(parsed) ? getRouletteColor(parsed) : null;
  }
  if (betType === 'color') {
    return betValue === 'red' || betValue === 'black' ? betValue : null;
  }
  return null;
}

const CHIP_COLOR_CLASSES: Record<RouletteColor, string> = {
  red: 'border-rose-400/40 bg-rose-500/10 text-rose-200',
  black: 'border-white/25 bg-white/[0.06] text-stone-200',
  green: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
};
const CHIP_NEUTRAL_CLASS = 'border-amber-300/25 bg-amber-300/10 text-amber-100';

const CHIP_DOT_CLASSES: Record<RouletteColor, string> = {
  red: 'bg-rose-500',
  black: 'border border-stone-500 bg-stone-900',
  green: 'bg-emerald-500',
};

function BetChip({
  bet,
  settled,
}: {
  bet: RouletteBetRecord;
  settled: boolean;
}) {
  const chipColor = getBetChipColor(bet.bet_type, bet.bet_value);
  const isWin = bet.is_win === true;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold',
        chipColor ? CHIP_COLOR_CLASSES[chipColor] : CHIP_NEUTRAL_CLASS,
        settled && !isWin && 'opacity-45',
        settled &&
          isWin &&
          'border-emerald-400/60 bg-emerald-500/15 text-emerald-100 shadow-[0_0_14px_rgba(16,185,129,0.25)]',
      )}
    >
      {settled &&
        (isWin ? (
          <Check className="h-3 w-3 text-emerald-300" aria-hidden="true" />
        ) : (
          <X className="h-3 w-3 text-white/45" aria-hidden="true" />
        ))}
      {!settled && chipColor && (
        <span
          aria-hidden="true"
          className={cn(
            'h-2 w-2 rounded-full',
            CHIP_DOT_CLASSES[chipColor],
          )}
        />
      )}
      <span>
        {getRouletteBetTypeLabel(bet.bet_type)}:{' '}
        {formatRouletteBetValue(bet.bet_type, bet.bet_value)}
      </span>
      <span className="font-mono">
        {settled && isWin
          ? `+${bet.payout.toFixed(2)}`
          : bet.stake.toFixed(2)}
      </span>
    </span>
  );
}

export function MyBetsStrip({
  liveBets,
  settledBets,
  resultNumber,
  resultColor,
  isRepeating,
  onRepeat,
}: MyBetsStripProps) {
  const mode =
    liveBets.length > 0
      ? 'live'
      : settledBets.length > 0
        ? 'result'
        : null;

  if (!mode) return null;

  const maxWin = liveBets.reduce(
    (sum, bet) => sum + bet.stake * getRoulettePayoutMultiplier(bet.bet_type),
    0,
  );
  const totalPayout = settledBets.reduce((sum, bet) => sum + bet.payout, 0);
  const repeatBetCount = settledBets.length;
  const repeatButtonLabel = isRepeating
    ? `Stawianie ${repeatBetCount} ${
        repeatBetCount === 1 ? 'ostatniego zakładu' : 'ostatnich zakładów'
      }`
    : `Powtórz ${repeatBetCount} ${
        repeatBetCount === 1 ? 'ostatni zakład' : 'ostatnich zakładów'
      }`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      data-testid="roulette-my-bets-strip"
      className="rounded-2xl border border-white/10 bg-black/40 px-3.5 py-3 backdrop-blur-sm"
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        {mode === 'live' ? (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/40">
              Grasz w tej rundzie
            </p>
            <p className="font-mono text-xs font-bold text-emerald-300">
              max → {maxWin.toFixed(2)} zł
            </p>
          </>
        ) : (
          <>
            <p
              data-testid="roulette-round-result-label"
              className="text-xs font-bold text-white/85"
            >
              Wypadło{' '}
              <span className="font-mono">{resultNumber ?? '?'}</span>{' '}
              {resultColor ? getRouletteColorLabel(resultColor) : ''}
            </p>
            {totalPayout > 0 ? (
              <p className="font-mono text-xs font-bold text-emerald-300">
                +{totalPayout.toFixed(2)} zł
              </p>
            ) : (
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
                bez trafienia
              </p>
            )}
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {(mode === 'live' ? liveBets : settledBets).map((bet) => (
          <BetChip key={bet.id} bet={bet} settled={mode === 'result'} />
        ))}

        {mode === 'result' && (
          <button
            type="button"
            onClick={onRepeat}
            disabled={isRepeating}
            aria-label={repeatButtonLabel}
            data-testid="roulette-repeat-bets"
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-[11px] font-bold text-amber-200 transition-colors hover:bg-amber-400/20 disabled:opacity-50"
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            {isRepeating ? 'Stawiam…' : 'Powtórz'}
          </button>
        )}
      </div>
    </motion.div>
  );
}
