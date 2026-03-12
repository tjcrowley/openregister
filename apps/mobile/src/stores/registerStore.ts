import { create } from 'zustand';
import type { Session } from '../services/RegisterService';

type RegisterStatus = 'closed' | 'open' | 'opening' | 'closing';

interface RegisterState {
  currentSession: Session | null;
  openingCash: number;
  status: RegisterStatus;
  openSession: (session: Session) => void;
  closeSession: () => void;
  setStatus: (status: RegisterStatus) => void;
  setOpeningCash: (cents: number) => void;
}

export const useRegisterStore = create<RegisterState>((set) => ({
  currentSession: null,
  openingCash: 0,
  status: 'closed',
  openSession: (session) => set({ currentSession: session, status: 'open' }),
  closeSession: () => set({ currentSession: null, status: 'closed' }),
  setStatus: (status) => set({ status }),
  setOpeningCash: (cents) => set({ openingCash: cents }),
}));
