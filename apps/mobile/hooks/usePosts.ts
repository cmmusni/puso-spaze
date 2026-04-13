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
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  fetchPosts: (query?: string) => Promise<void>;
  loadMore: (query?: string) => Promise<void>;
  submitPost: (req: CreatePostRequest & { imageUri?: string }) => Promise<{ flagged: boolean; underReview: boolean; postId?: string }>;
}

export function usePosts(): UsePostsResult {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Fetch first page of posts. Optional search query. */
  const fetchPosts = useCallback(async (query?: string) => {
    setLoading(true);
    setError(null);
    try {
      const { posts: fetched, nextCursor: cursor } = await apiFetchPosts(query);
      setPosts(fetched);
      setNextCursor(cursor);
      setHasMore(cursor !== null);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to load posts.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Load next page of posts, appending to existing list. */
  const loadMore = useCallback(async (query?: string) => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const { posts: fetched, nextCursor: cursor } = await apiFetchPosts(query, nextCursor);
      setPosts((prev) => [...prev, ...fetched]);
      setNextCursor(cursor);
      setHasMore(cursor !== null);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to load more posts.';
      setError(msg);
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore]);

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

  return { posts, loading, loadingMore, hasMore, error, fetchPosts, loadMore, submitPost };
}
