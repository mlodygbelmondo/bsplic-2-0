import { router } from 'expo-router';

import { toast } from '@/lib/toast';
import { canClaimTopup } from './polish-day';

export const TOPUP_DENIED_MESSAGE = 'Już doładowano dzisiaj. Wróć jutro!';

/**
 * Web `openTopupDialog` / mobile menu `handleOpenTopup`: opens the top-up
 * sheet, or toasts when today's top-up was already claimed (Warsaw day).
 * `replace` swaps the current sheet (the menu closes, then the dialog opens).
 */
export function openTopupSheet(lastTopupAt: string | null | undefined, mode: 'push' | 'replace' = 'push') {
  if (!canClaimTopup(lastTopupAt)) {
    toast.error(TOPUP_DENIED_MESSAGE);
    return;
  }
  if (mode === 'replace') {
    router.replace('/sheets/topup');
  } else {
    router.push('/sheets/topup');
  }
}
