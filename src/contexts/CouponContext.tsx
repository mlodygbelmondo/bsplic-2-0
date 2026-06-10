import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { CouponItem } from '@/types/database';
import { toast } from 'sonner';

const STORED_ITEMS_KEY = 'bsplic.coupon.items.v1';

function isStorableCouponItem(value: unknown): value is CouponItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as CouponItem;
  return (
    typeof item.selectedOption === 'string' &&
    typeof item.odds === 'number' &&
    Number.isFinite(item.odds) &&
    !!item.bet &&
    typeof item.bet === 'object' &&
    typeof item.bet.id === 'string'
  );
}

function readStoredItems(): CouponItem[] {
  try {
    const raw = window.localStorage.getItem(STORED_ITEMS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isStorableCouponItem).filter((item) => {
      if (!item.bet.is_active) return false;
      const endsAt = new Date(item.bet.ends_at).getTime();
      return Number.isFinite(endsAt) && endsAt > Date.now();
    });
  } catch {
    return [];
  }
}

function writeStoredItems(items: CouponItem[]) {
  try {
    if (items.length === 0) {
      window.localStorage.removeItem(STORED_ITEMS_KEY);
    } else {
      window.localStorage.setItem(STORED_ITEMS_KEY, JSON.stringify(items));
    }
  } catch {
    // Storage unavailable (private mode, quota) — coupon just won't persist.
  }
}

interface CouponContextType {
  items: CouponItem[];
  addItem: (item: CouponItem) => void;
  addItems: (items: CouponItem[]) => void;
  removeItem: (betId: string) => void;
  clearCoupon: () => void;
  preferredCouponType: 'single' | 'ako' | null;
  setPreferredCouponType: (type: 'single' | 'ako' | null) => void;
  totalOdds: number;
  couponType: 'single' | 'ako';
}

const CouponContext = createContext<CouponContextType | undefined>(undefined);

export function CouponProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CouponItem[]>(readStoredItems);
  const [preferredCouponType, setPreferredCouponType] = useState<'single' | 'ako' | null>(null);

  useEffect(() => {
    writeStoredItems(items);
  }, [items]);

  const addItem = (item: CouponItem) => {
    setItems(prev => {
      const exists = prev.find(i => i.bet.id === item.bet.id);
      if (exists) {
        return prev.map(i => i.bet.id === item.bet.id ? item : i);
      }
      return [...prev, item];
    });
    toast.success('Dodano do kuponu');
  };

  const addItems = (incomingItems: CouponItem[]) => {
    if (incomingItems.length === 0) {
      return;
    }

    setItems((previous) => {
      const nextByBetId = new Map(previous.map((item) => [item.bet.id, item]));

      incomingItems.forEach((item) => {
        nextByBetId.set(item.bet.id, item);
      });

      return Array.from(nextByBetId.values());
    });
  };

  const removeItem = (betId: string) => {
    setItems(prev => prev.filter(i => i.bet.id !== betId));
  };

  const clearCoupon = () => {
    setItems([]);
    setPreferredCouponType(null);
  };

  const totalOdds = items.reduce((acc, item) => acc * item.odds, 1);
  const couponType = items.length > 1 ? 'ako' : 'single';

  return (
    <CouponContext.Provider
      value={{
        items,
        addItem,
        addItems,
        removeItem,
        clearCoupon,
        preferredCouponType,
        setPreferredCouponType,
        totalOdds,
        couponType,
      }}
    >
      {children}
    </CouponContext.Provider>
  );
}

export const useCoupon = () => {
  const ctx = useContext(CouponContext);
  if (!ctx) throw new Error('useCoupon must be used within CouponProvider');
  return ctx;
};
