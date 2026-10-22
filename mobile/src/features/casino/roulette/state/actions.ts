import { AccessibilityInfo } from 'react-native';

import { authActions, useAuthStore } from '@/features/auth/auth-store';
import { callRpc } from '@/lib/rpc';
import { toast } from '@/lib/toast';
import type { RouletteColor } from '@/types/database';
import { getErrorMessage, isOutcomeUnknown } from '@/lib/errors';

import { casinoHaptics, playCasinoWinChime } from '../../shared/audio';
import { getRouletteColor, validateRouletteBetInput } from '../lib/roulette';
import { getRouletteShareContent } from '../lib/rouletteGame';
import { rouletteSession, useRouletteSession } from './sessionStore';
import type { RouletteTableController } from './tableController';
import { rouletteTableStore } from './tableStore';

/**
 * Player actions of the roulette table (web `RouletteGame` handlers). The
 * mounted table screen registers its controller; the stake bar, the stake
 * sheet, the bets strip and the win banner call these without prop drilling.
 */

let activeController: RouletteTableController | null = null;

export function registerRouletteController(controller: RouletteTableController) {
  activeController = controller;
}

/** Clears the controller only if it is still the registered one. */
export function unregisterRouletteController(controller: RouletteTableController) {
  if (activeController === controller) activeController = null;
}

const balance = () => Number(useAuthStore.getState().profile?.balance ?? 0);

export async function submitRouletteBet() {
  const controller = activeController;
  if (!controller || rouletteTableStore.getState().isPlacingBet) return;
  const { betType, betValue, stake } = useRouletteSession.getState();
  const roundIdAtSubmit = rouletteTableStore.getState().currentRound?.id ?? null;

  try {
    const payload = validateRouletteBetInput({ betType, betValue, stake, balance: balance() });
    const acceptedBet = await controller.placeBet(payload);
    if (acceptedBet?.round_id) {
      rouletteSession.trackBetRound(acceptedBet.round_id);
    }
    const queuedForNextRound =
      roundIdAtSubmit !== null && typeof acceptedBet?.round_id === 'string' && acceptedBet.round_id !== roundIdAtSubmit;
    casinoHaptics.betPlaced();
    toast.success(queuedForNextRound ? 'Zakład czeka na następną rundę!' : 'Zakład przyjęty do wspólnej rundy!');
  } catch (error) {
    casinoHaptics.error();
    if (isOutcomeUnknown(error)) {
      // A timeout or dropped connection may still have placed it: show the table as
      // the server has it and announce a win on this round.
      toast.error('Nie udało się potwierdzić zakładu. Sprawdź swoje zakłady, zanim postawisz go ponownie.');
      if (roundIdAtSubmit) rouletteSession.trackBetRound(roundIdAtSubmit);
      void controller.syncFreshSnapshot().catch(() => undefined);
    } else {
      toast.error(getErrorMessage(error, 'Nie udało się przyjąć zakładu.'));
    }
    // The balance may have changed elsewhere (another device): show the server's.
    void authActions.refreshProfile();
  }
}

export async function repeatRouletteBets() {
  const controller = activeController;
  const { lastSettled, isRepeating } = useRouletteSession.getState();
  if (!controller || !lastSettled || isRepeating) return;

  const totalStake = lastSettled.bets.reduce((sum, bet) => sum + bet.stake, 0);
  if (totalStake > balance()) {
    toast.error('Saldo jest za małe, aby powtórzyć zakłady.');
    return;
  }

  useRouletteSession.setState({ isRepeating: true });
  try {
    for (const bet of lastSettled.bets) {
      const acceptedBet = await controller.placeBet({
        betType: bet.bet_type,
        betValue: bet.bet_value,
        stake: bet.stake,
      });
      if (acceptedBet?.round_id) {
        rouletteSession.trackBetRound(acceptedBet.round_id);
      }
    }
    casinoHaptics.betPlaced();
    toast.success(lastSettled.bets.length === 1 ? 'Zakład powtórzony!' : 'Zakłady powtórzone!');
  } catch (error) {
    casinoHaptics.error();
    toast.error(getErrorMessage(error, 'Nie udało się powtórzyć zakładów.'));
  } finally {
    useRouletteSession.setState({ isRepeating: false });
  }
}

/**
 * Posts the newest win to Social (web `handleShareWin`). The web bails out
 * when no round is open, which is the usual state right after a spin settles;
 * here the round number comes from the settled spin or the win itself.
 */
export async function shareRouletteWin() {
  const userId = useAuthStore.getState().user?.id;
  const { latestWin: winBet, latestWinKey, isSharingWin, dismissedWinKey } = useRouletteSession.getState();
  if (!userId || !winBet || !latestWinKey || isSharingWin) return;

  const previousDismissedWinKey = dismissedWinKey;
  useRouletteSession.setState({ isSharingWin: true });
  rouletteSession.markWinShared(latestWinKey, true);
  rouletteSession.dismissWin(latestWinKey);

  try {
    const { currentRound, recentSpins } = rouletteTableStore.getState();
    const settledRound =
      recentSpins.find((round) => round.id === winBet.round_id) ??
      (currentRound?.id === winBet.round_id ? currentRound : null);
    const winningNumber = settledRound?.winning_number ?? null;
    const winningColor: RouletteColor | null =
      settledRound?.winning_color ?? (winningNumber === null ? null : getRouletteColor(winningNumber));
    const roundNumber =
      settledRound?.round_number ??
      ('round_number' in winBet ? winBet.round_number : null) ??
      currentRound?.round_number ??
      null;

    await callRpc('create_casino_social_share', {
      p_user_id: userId,
      p_roulette_bet_id: winBet.id,
      p_content: getRouletteShareContent(winBet.payout, winningNumber),
      p_casino_bet_type: winBet.bet_type,
      p_casino_bet_value: winBet.bet_value,
      p_casino_stake: winBet.stake,
      p_casino_payout: winBet.payout,
      p_casino_round_number: roundNumber,
      p_casino_winning_number: winningNumber,
      p_casino_winning_color: winningColor,
    });

    rouletteSession.forgetBetRound(winBet.round_id);
    toast.success('Wygrana udostępniona na Socialu!');
  } catch (error) {
    rouletteSession.markWinShared(latestWinKey, false);
    rouletteSession.dismissWin(previousDismissedWinKey);
    toast.error(getErrorMessage(error, 'Nie udało się udostępnić wygranej.'));
  } finally {
    useRouletteSession.setState({ isSharingWin: false });
  }
}

/** Chime, haptic and spoken announcement for a newly settled win (confetti follows `winBurst`). */
export function celebrateRouletteWin() {
  const { latestWin } = useRouletteSession.getState();
  playCasinoWinChime();
  casinoHaptics.win();
  if (latestWin) {
    AccessibilityInfo.announceForAccessibility(`Wygrałeś ${latestWin.payout.toFixed(2)} zł!`);
  }
}
