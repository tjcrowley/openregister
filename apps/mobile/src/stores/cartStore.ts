import { create } from 'zustand';
import { computeCartTotals, type CartLine, type CartTotals } from '../utils/money';

interface CartState {
  lines: CartLine[];
  totals: CartTotals;
  addLine: (line: CartLine) => void;
  removeLine: (lineId: string) => void;
  updateQty: (lineId: string, qty: number) => void;
  clearCart: () => void;
}

const emptyTotals: CartTotals = {
  subtotalCents: 0,
  taxCents: 0,
  discountCents: 0,
  totalCents: 0,
};

export const useCartStore = create<CartState>((set, get) => ({
  lines: [],
  totals: emptyTotals,

  addLine: (line) => {
    const lines = [...get().lines];
    const existingIdx = lines.findIndex((l) => l.variantId === line.variantId);
    if (existingIdx >= 0) {
      lines[existingIdx] = { ...lines[existingIdx], qty: lines[existingIdx].qty + line.qty };
    } else {
      lines.push(line);
    }
    set({ lines, totals: computeCartTotals(lines) });
  },

  removeLine: (lineId) => {
    const lines = get().lines.filter((l) => l.id !== lineId);
    set({ lines, totals: computeCartTotals(lines) });
  },

  updateQty: (lineId, qty) => {
    if (qty <= 0) {
      const lines = get().lines.filter((l) => l.id !== lineId);
      set({ lines, totals: computeCartTotals(lines) });
      return;
    }
    const lines = get().lines.map((l) => (l.id === lineId ? { ...l, qty } : l));
    set({ lines, totals: computeCartTotals(lines) });
  },

  clearCart: () => set({ lines: [], totals: emptyTotals }),
}));
