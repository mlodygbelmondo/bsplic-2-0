import { motion } from 'framer-motion';
import { Users } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  formatRouletteBetValue,
  getRouletteBetTypeLabel,
  getRouletteColor,
} from '@/features/casino/lib/roulette';
import type {
  RouletteColor,
  RouletteRoundParticipantBet,
  RouletteRoundParticipant,
} from '@/types/database';

const BET_CHIP_COLOR_CLASSES: Record<RouletteColor, string> = {
  red: 'border-rose-400/30 bg-rose-500/10 text-rose-200',
  black: 'border-white/20 bg-white/[0.05] text-stone-200',
  green: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
};
const BET_CHIP_NEUTRAL_CLASS =
  'border-amber-300/15 bg-amber-300/10 text-amber-100/90';

const BET_CHIP_DOT_CLASSES: Record<RouletteColor, string> = {
  red: 'bg-rose-500',
  black: 'border border-stone-500 bg-stone-900',
  green: 'bg-emerald-500',
};

function getParticipantBetColor(
  bet: RouletteRoundParticipantBet,
): RouletteColor | null {
  if (bet.bet_type === 'straight') {
    const parsed = Number(bet.bet_value);
    return Number.isInteger(parsed) ? getRouletteColor(parsed) : null;
  }
  if (bet.bet_type === 'color') {
    return bet.bet_value === 'red' || bet.bet_value === 'black'
      ? bet.bet_value
      : null;
  }
  return null;
}

interface RoundParticipantsListProps {
  participants: RouletteRoundParticipant[];
}

export function RoundParticipantsList({ participants }: RoundParticipantsListProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18 }}
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-amber-400" />
          <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
            Gracze w rundzie
          </p>
        </div>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-white/50">
          {participants.length}
        </span>
      </div>

      {participants.length === 0 ? (
        <p className="text-sm text-white/45">
          Pierwszy zakład otworzy listę graczy tej rundy.
        </p>
      ) : (
        <div className="space-y-2">
          {participants.map((participant) => (
            <div
              key={participant.user_id}
              className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-amber-500/10 text-xs font-bold text-amber-200">
                    {participant.avatar_url ? (
                      <img
                        src={participant.avatar_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      participant.username.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {participant.username}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-white/35">
                      {participant.bet_count}{' '}
                      {participant.bet_count === 1 ? 'zakład' : 'zakłady'}
                    </p>
                  </div>
                </div>
                <span className="flex-shrink-0 font-mono text-sm font-bold text-amber-200">
                  {participant.total_stake.toFixed(2)} zł
                </span>
              </div>
              {participant.bets.length > 0 && (
                <div className="mt-2 space-y-1 pl-12">
                  {participant.bets.map((bet, index) => {
                    const chipColor = getParticipantBetColor(bet);
                    return (
                      <div
                        key={`${bet.bet_type}-${bet.bet_value}-${index}`}
                        className="flex items-center justify-between gap-2"
                      >
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                            chipColor
                              ? BET_CHIP_COLOR_CLASSES[chipColor]
                              : BET_CHIP_NEUTRAL_CLASS,
                          )}
                        >
                          {chipColor && (
                            <span
                              aria-hidden="true"
                              className={cn(
                                'h-1.5 w-1.5 rounded-full',
                                BET_CHIP_DOT_CLASSES[chipColor],
                              )}
                            />
                          )}
                          {getRouletteBetTypeLabel(bet.bet_type)}:{' '}
                          {formatRouletteBetValue(bet.bet_type, bet.bet_value)}
                        </span>
                        {Number.isFinite(bet.stake) && (
                          <span className="font-mono text-[11px] font-semibold text-amber-100/80">
                            {bet.stake.toFixed(2)} zł
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
