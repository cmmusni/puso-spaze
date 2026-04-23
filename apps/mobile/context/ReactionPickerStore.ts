// ─────────────────────────────────────────────
// context/ReactionPickerStore.ts
// Global reaction-picker state. The picker overlay is mounted once
// at screen-root level (e.g. HomeScreen, ProfileScreen,
// PostDetailScreen) so it can render outside FlatList row clipping
// and outside any <Modal> — preserving the long-press → drag →
// release continuous gesture across surfaces.
// ─────────────────────────────────────────────

import { create } from "zustand";
import type { ReactionType } from "../../../packages/types";

export interface PickerBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface OpenOptions {
  pickerPos: { top: number; left: number };
  userReaction: ReactionType | null;
  onSelect: (type: ReactionType) => void;
}

interface ReactionPickerStore {
  visible: boolean;
  pickerPos: { top: number; left: number } | null;
  userReaction: ReactionType | null;
  pressedReaction: ReactionType | null;
  /** Bumps every open() so the host knows to remeasure bubble bounds. */
  openVersion: number;

  open: (opts: OpenOptions) => void;
  close: () => void;
  setPressed: (type: ReactionType | null) => void;
}

// Non-reactive refs — these change frequently or hold non-serializable
// values (callbacks, Maps) that should not trigger re-renders.
export const pickerRefs = {
  onSelect: null as ((type: ReactionType) => void) | null,
  bubbleBounds: new Map<ReactionType, PickerBounds>(),
};

export const useReactionPickerStore = create<ReactionPickerStore>((set) => ({
  visible: false,
  pickerPos: null,
  userReaction: null,
  pressedReaction: null,
  openVersion: 0,

  open: ({ pickerPos, userReaction, onSelect }) => {
    pickerRefs.onSelect = onSelect;
    pickerRefs.bubbleBounds.clear();
    set((s) => ({
      visible: true,
      pickerPos,
      userReaction,
      pressedReaction: null,
      openVersion: s.openVersion + 1,
    }));
  },

  close: () => {
    set({ visible: false, pressedReaction: null });
    // Keep onSelect reachable for a tick in case a release event still
    // fires after close — but null it out next microtask to prevent leaks.
    setTimeout(() => {
      pickerRefs.onSelect = null;
      pickerRefs.bubbleBounds.clear();
    }, 0);
  },

  setPressed: (type) => set({ pressedReaction: type }),
}));

/**
 * Hit test by X coordinate (window-coord pageX). Mirrors the
 * PostDetailScreen implementation: bubble whose horizontal range
 * contains pageX, with a 60px fallback to the closest bubble center.
 */
export function findBubbleAt(pageX: number): ReactionType | null {
  const bounds = pickerRefs.bubbleBounds;
  if (bounds.size === 0) return null;

  // 1) Direct horizontal containment.
  for (const [type, b] of bounds) {
    if (pageX >= b.left && pageX <= b.right) return type;
  }

  // 2) Fallback — closest center within 60px.
  let best: { type: ReactionType; dist: number } | null = null;
  for (const [type, b] of bounds) {
    const center = (b.left + b.right) / 2;
    const dist = Math.abs(pageX - center);
    if (!best || dist < best.dist) best = { type, dist };
  }
  return best && best.dist <= 60 ? best.type : null;
}
