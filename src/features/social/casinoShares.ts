import type { SocialFeedItem } from '@/types/database';

const CASINO_SHARES_KEY = 'bsplic_casino_shares_v1';

export function getLocalCasinoShares(): SocialFeedItem[] {
  try {
    const raw = localStorage.getItem(CASINO_SHARES_KEY);
    const parsed = raw ? (JSON.parse(raw) as SocialFeedItem[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addLocalCasinoShare(item: SocialFeedItem) {
  const current = getLocalCasinoShares();
  const next = [item, ...current].slice(0, 50);
  localStorage.setItem(CASINO_SHARES_KEY, JSON.stringify(next));
}

export function clearLocalCasinoShares() {
  localStorage.removeItem(CASINO_SHARES_KEY);
}
