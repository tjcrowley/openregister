import { create } from 'zustand';
import type { LocalUser } from '../services/AuthService';

interface AuthState {
  currentUser: LocalUser | null;
  sessionToken: string | null;
  login: (user: LocalUser, token: string) => void;
  logout: () => void;
  setUser: (user: LocalUser) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  currentUser: null,
  sessionToken: null,
  login: (user, token) => set({ currentUser: user, sessionToken: token }),
  logout: () => set({ currentUser: null, sessionToken: null }),
  setUser: (user) => set({ currentUser: user }),
}));
