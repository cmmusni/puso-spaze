// ─────────────────────────────────────────────
// hooks/usePosts.ts
// Fetches and caches posts from the backend
// ─────────────────────────────────────────────

import { useState, useCallback } from 'react';
import { apiFetchPosts, apiCreatePost } from '../services/api';
import type { Post, CreatePostRequest } from '../../../packages/types';

export interface UsePostsResult {
  posts: Post[];
  loading: boolean;
  error: string | null;
  fetchPosts: () => Promise<void>;
  submitPost: (req: CreatePostRequest & { imageUri?: string }) => Promise<{ flagged: boolean; underReview: boolean }>;
}

export function usePosts(): UsePostsResult {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Fetch all SAFE posts from the server */
  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { posts: fetched } = await apiFetchPosts();
      setPosts(fetched);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to load posts.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Submit a new post.
   * Returns { flagged: true } if AI moderation rejected the content.
   */
  const submitPost = useCallback(
    async (req: CreatePostRequest & { imageUri?: string }): Promise<{ flagged: boolean; underReview: boolean }> => {
      const { flagged, underReview } = await apiCreatePost(req);
      if (!flagged) {
        // Refresh feed after submission (includes REVIEW posts)
        await fetchPosts();
      }
      return { flagged, underReview };
    },
    [fetchPosts]
  );

  return { posts, loading, error, fetchPosts, submitPost };
}
