import 'expo-sqlite/localStorage/install';

import {
  createContext,
  use,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import type { CouponItem } from '@/types/database';

const STORAGE_KEY = 'bsplic.coupon.items.v1';

type CouponMode = 'single' | 'ako';

interface CouponContextValue {
  items: CouponItem[];
  preferredMode: CouponMode | null;
  couponMode: CouponMode;
  totalOdds: number;
  addItem: (item: CouponItem) => void;
  addItems: (items: CouponItem[]) => void;
  removeItem: (betId: string) => void;
  clearCoupon: () => void;
  setPreferredMode: (mode: CouponMode | null) => void;
}

const CouponContext = createContext<CouponContextValue | null>(null);

function isCouponItem(value: unknown): value is CouponItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<CouponItem>;
  return (
    typeof item.selectedOption === 'string' &&
    typeof item.odds === 'number' &&
    Number.isFinite(item.odds) &&
    Boolean(item.bet) &&
    typeof item.bet?.id === 'string'
  );
}

function readCoupon(): CouponItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isCouponItem).filter((item) => {
      if (!item.bet.is_active) return false;
      const closesAt = new Date(item.bet.ends_at).getTime();
      return Number.isFinite(closesAt) && closesAt > Date.now();
    });
  } catch {
    return [];
  }
}

export function CouponProvider({ children }: PropsWithChildren) {
  const [items, setItems] = useState<CouponItem[]>(readCoupon);
  const [preferredMode, setPreferredMode] = useState<CouponMode | null>(null);

  useEffect(() => {
    try {
      if (items.length === 0) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      }
    } catch {
      // The coupon remains usable in memory when persistence is unavailable.
    }
  }, [items]);

  const value = useMemo<CouponContextValue>(() => {
    const couponMode = items.length > 1 ? 'ako' : 'single';
    const totalOdds = items.reduce((total, item) => total * item.odds, 1);

    return {
      items,
      preferredMode,
      couponMode,
      totalOdds,
      addItem(item) {
        setItems((current) => {
          const withoutSameBet = current.filter(
            (candidate) => candidate.bet.id !== item.bet.id,
          );
          return [...withoutSameBet, item];
        });
      },
      addItems(incoming) {
        if (incoming.length === 0) return;
        setItems((current) => {
          const byBetId = new Map(
            current.map((item) => [item.bet.id, item] as const),
          );
          incoming.forEach((item) => byBetId.set(item.bet.id, item));
          return Array.from(byBetId.values());
        });
      },
      removeItem(betId) {
        setItems((current) =>
          current.filter((item) => item.bet.id !== betId),
        );
      },
      clearCoupon() {
        setItems([]);
        setPreferredMode(null);
      },
      setPreferredMode,
    };
  }, [items, preferredMode]);

  return (
    <CouponContext.Provider value={value}>{children}</CouponContext.Provider>
  );
}

export function useCoupon() {
  const context = use(CouponContext);
  if (!context) {
    throw new Error('useCoupon must be used within CouponProvider');
  }
  return context;
}
