import { createContext, useContext, useState, ReactNode } from 'react';
import { CouponItem } from '@/types/database';
import { toast } from 'sonner';

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
  const [items, setItems] = useState<CouponItem[]>([]);
  const [preferredCouponType, setPreferredCouponType] = useState<'single' | 'ako' | null>(null);

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
