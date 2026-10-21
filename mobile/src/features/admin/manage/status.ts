import type { Bet } from '@/types/database';

import { BET_WINNING_OPTION_FORCED_LOSS, BET_WINNING_OPTION_REFUND } from '../constants';
import { parseWinningOptions } from '../helpers';

export type BetStatusTone = 'refund' | 'lost' | 'resolved' | 'active' | 'closed';

export const BET_STATUS_LABEL: Record<BetStatusTone, string> = {
  refund: 'ZWROT',
  lost: 'PRZEGRANA',
  resolved: 'ROZSTRZYGNIĘTY',
  active: 'AKTYWNY',
  closed: 'ZAMKNIĘTY',
};

/** Web `statusBadge` precedence: refund, forced loss, resolved, active, closed. */
export function getBetStatus(bet: Pick<Bet, 'winning_option' | 'is_active'>): BetStatusTone {
  if (bet.winning_option) {
    const winners = parseWinningOptions(bet.winning_option);
    if (winners.includes(BET_WINNING_OPTION_REFUND)) return 'refund';
    if (winners.includes(BET_WINNING_OPTION_FORCED_LOSS)) return 'lost';
    return 'resolved';
  }
  return bet.is_active ? 'active' : 'closed';
}
