import { create } from 'zustand';
import type { SyncState } from '@openregister/types';

interface SyncStoreState {
  lastSyncAt: string | null;
  pendingCount: number;
  status: SyncState;
  setSyncStatus: (status: SyncState, lastSyncAt?: string) => void;
  setPendingCount: (count: number) => void;
}

export const useSyncStore = create<SyncStoreState>((set) => ({
  lastSyncAt: null,
  pendingCount: 0,
  status: 'idle',
  setSyncStatus: (status, lastSyncAt) =>
    set((state) => ({ status, lastSyncAt: lastSyncAt ?? state.lastSyncAt })),
  setPendingCount: (count) => set({ pendingCount: count }),
}));
