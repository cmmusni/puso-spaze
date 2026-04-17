import { create } from 'zustand';

interface ScrollBarVisibilityStore {
  barsVisible: boolean;
  setBarsVisible: (visible: boolean) => void;
}

export const useScrollBarVisibility = create<ScrollBarVisibilityStore>((set) => ({
  barsVisible: true,
  setBarsVisible: (visible) => set({ barsVisible: visible }),
}));
