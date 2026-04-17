import { create } from 'zustand';

interface ScrollBarVisibilityStore {
  barsVisible: boolean;
  setBarsVisible: (visible: boolean) => void;
  scrollToTopTrigger: number;
  triggerScrollToTop: () => void;
}

export const useScrollBarVisibility = create<ScrollBarVisibilityStore>((set) => ({
  barsVisible: true,
  setBarsVisible: (visible) => set({ barsVisible: visible }),
  scrollToTopTrigger: 0,
  triggerScrollToTop: () => set((s) => ({ scrollToTopTrigger: s.scrollToTopTrigger + 1 })),
}));
