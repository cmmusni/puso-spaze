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
  fetchPosts: (query?: string) => Promise<void>;
  submitPost: (req: CreatePostRequest & { imageUri?: string }) => Promise<{ flagged: boolean; underReview: boolean; postId?: string }>;
}

export function usePosts(): UsePostsResult {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Fetch posts from the server. Optional search query. */
  const fetchPosts = useCallback(async (query?: string) => {
    setLoading(true);
    setError(null);
    try {
      const { posts: fetched } = await apiFetchPosts(query);
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
    async (req: CreatePostRequest & { imageUri?: string }): Promise<{ flagged: boolean; underReview: boolean; postId?: string }> => {
      const { post, flagged, underReview } = await apiCreatePost(req);
      if (!flagged) {
        // Refresh feed after submission (includes REVIEW posts)
        await fetchPosts();
      }
      return { flagged, underReview, postId: post?.id };
    },
    [fetchPosts]
  );

  return { posts, loading, error, fetchPosts, submitPost };
}
