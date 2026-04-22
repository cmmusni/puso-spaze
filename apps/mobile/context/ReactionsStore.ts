// ─────────────────────────────────────────────
// context/ReactionsStore.ts
// Global reactions state per post — keeps PostCard
// (HomeScreen feed) and PostDetailScreen in sync.
// ─────────────────────────────────────────────

import { create } from 'zustand';
import type { ReactionType, ReactionCounts } from '../../../packages/types';

export interface PostReactionState {
  counts: ReactionCounts;
  userReaction: ReactionType | null;
  total: number;
  /** Monotonically increases on each set; lets consumers ignore older snapshots. */
  version: number;
}

interface ReactionsStore {
  byPostId: Record<string, PostReactionState>;
  /**
   * Increments on each global refresh request (e.g. pull-to-refresh).
   * PostCards subscribe to this to re-hydrate their reactions from the
   * server without remounting.
   */
  refreshTick: number;
  /** Replace state for a post (used after a fresh server fetch). */
  setReactions: (
    postId: string,
    counts: ReactionCounts,
    userReaction: ReactionType | null,
  ) => void;
  /** Apply an optimistic toggle locally; returns the previous state for rollback. */
  applyToggle: (
    postId: string,
    type: ReactionType,
  ) => PostReactionState | null;
  /** Rollback to a prior snapshot (used when the server request fails). */
  rollback: (postId: string, snapshot: PostReactionState | null) => void;
  /** Get current state synchronously. */
  get: (postId: string) => PostReactionState | undefined;
  /** Bump refreshTick so subscribed PostCards re-fetch their reactions. */
  requestRefresh: () => void;
}

function totalOf(counts: ReactionCounts): number {
  return Object.values(counts).reduce((s, n) => s + (n ?? 0), 0);
}

export const useReactionsStore = create<ReactionsStore>((set, get) => ({
  byPostId: {},
  refreshTick: 0,

  setReactions: (postId, counts, userReaction) => {
    set((state) => {
      const prev = state.byPostId[postId];
      return {
        byPostId: {
          ...state.byPostId,
          [postId]: {
            counts,
            userReaction,
            total: totalOf(counts),
            version: (prev?.version ?? 0) + 1,
          },
        },
      };
    });
  },

  applyToggle: (postId, type) => {
    const prev = get().byPostId[postId] ?? null;
    const prevCounts = prev?.counts ?? {};
    const prevReaction = prev?.userReaction ?? null;
    const newCounts = { ...prevCounts };
    if (prevReaction) {
      newCounts[prevReaction] = Math.max(
        0,
        (newCounts[prevReaction] ?? 1) - 1,
      );
    }
    let newReaction: ReactionType | null;
    if (type === prevReaction) {
      newReaction = null;
    } else {
      newCounts[type] = (newCounts[type] ?? 0) + 1;
      newReaction = type;
    }
    set((state) => ({
      byPostId: {
        ...state.byPostId,
        [postId]: {
          counts: newCounts,
          userReaction: newReaction,
          total: totalOf(newCounts),
          version: (prev?.version ?? 0) + 1,
        },
      },
    }));
    return prev;
  },

  rollback: (postId, snapshot) => {
    set((state) => {
      if (!snapshot) {
        const next = { ...state.byPostId };
        delete next[postId];
        return { byPostId: next };
      }
      return {
        byPostId: {
          ...state.byPostId,
          [postId]: {
            ...snapshot,
            version: (state.byPostId[postId]?.version ?? snapshot.version) + 1,
          },
        },
      };
    });
  },

  get: (postId) => get().byPostId[postId],

  requestRefresh: () => {
    set((state) => ({ refreshTick: state.refreshTick + 1 }));
  },
}));
