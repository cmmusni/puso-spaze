// ─────────────────────────────────────────────
// src/controllers/postController.ts
// Business logic for POST /api/posts and GET /api/posts
// ─────────────────────────────────────────────

import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { moderateContent } from '../services/moderationService';

// ── POST /api/posts ───────────────────────────
/**
 * Accepts { userId, content, tags? }
 * Runs AI moderation, saves post, returns { post, flagged }
 */
export async function createPost(req: Request, res: Response): Promise<void> {
  const { userId, content, tags } = req.body as {
    userId: string;
    content: string;
    tags?: string[];
  };

  // ── Verify user exists ────────────────────
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  // ── AI Moderation ────────────────────────
  let moderationStatus: 'SAFE' | 'FLAGGED' | 'REVIEW';
  try {
    moderationStatus = await moderateContent(content);
  } catch {
    moderationStatus = 'REVIEW';
  }

  // ── Save post regardless of status ─────────
  // The GET endpoint filters to only SAFE posts for the feed
  const post = await prisma.post.create({
    data: {
      content,
      userId,
      moderationStatus,
      tags: tags ?? [],
    },
    include: { user: { select: { displayName: true } } },
  });

  const flagged = moderationStatus === 'FLAGGED';
  const underReview = moderationStatus === 'REVIEW';

  res.status(201).json({
    post: {
      id: post.id,
      content: post.content,
      userId: post.userId,
      user: post.user,
      createdAt: post.createdAt.toISOString(),
      moderationStatus: post.moderationStatus,
      tags: post.tags,
    },
    flagged,
    underReview,
  });
}

// ── GET /api/posts ────────────────────────────
/**
 * Returns all SAFE posts, newest first.
 * Includes author displayName.
 */
export async function getPosts(_req: Request, res: Response): Promise<void> {
  const posts = await prisma.post.findMany({
    where: { moderationStatus: { in: ['SAFE', 'REVIEW'] } },
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { displayName: true, role: true } },
      _count: { select: { reactions: true, comments: true } },
    },
  });

  res.json({
    posts: posts.map((p) => ({
      id: p.id,
      content: p.content,
      userId: p.userId,
      user: p.user,
      createdAt: p.createdAt.toISOString(),
      moderationStatus: p.moderationStatus,
      tags: p.tags,
      commentCount: p._count.comments,
      reactionCount: p._count.reactions,
    })),
  });
}

// ── GET /api/posts/:postId ────────────────────
/**
 * Returns a single post by ID with counts.
 */
export async function getPostById(req: Request, res: Response): Promise<void> {
  const { postId } = req.params;

  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      user: { select: { displayName: true, role: true } },
      _count: { select: { reactions: true, comments: true } },
    },
  });

  if (!post) {
    res.status(404).json({ error: 'Post not found.' });
    return;
  }

  // Only return SAFE or REVIEW posts (not FLAGGED)
  if (post.moderationStatus === 'FLAGGED') {
    res.status(404).json({ error: 'Post not found.' });
    return;
  }

  res.json({
    post: {
      id: post.id,
      content: post.content,
      userId: post.userId,
      user: post.user,
      createdAt: post.createdAt.toISOString(),
      moderationStatus: post.moderationStatus,
      tags: post.tags,
      commentCount: post._count.comments,
      reactionCount: post._count.reactions,
    },
  });
}
