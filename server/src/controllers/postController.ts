// ─────────────────────────────────────────────
// src/controllers/postController.ts
// Business logic for POST /api/posts and GET /api/posts
// ─────────────────────────────────────────────

import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { moderateContent } from '../services/moderationService';
import { notifyMentionsInPost } from '../services/mentionService';
import { generateAnonUsername } from '../utils/generateAnonUsername';

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
  const bodyIsAnonymous = req.body.isAnonymous;

  const imageFile = (req as any).file as Express.Multer.File | undefined;
  const imageUrl = imageFile ? `/uploads/${imageFile.filename}` : null;

  // ── Verify user exists ────────────────────
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, displayName: true, isAnonymous: true } });
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  // ── Anonymous mode (per-post override or user default) ──
  const postIsAnonymous = bodyIsAnonymous !== undefined
    ? (bodyIsAnonymous === true || bodyIsAnonymous === 'true')
    : user.isAnonymous;
  const anonDisplayName = postIsAnonymous ? generateAnonUsername() : null;

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
      imageUrl,
      isAnonymous: postIsAnonymous,
      anonDisplayName,
    },
    include: { user: { select: { displayName: true } } },
  });

  const flagged = moderationStatus === 'FLAGGED';
  const underReview = moderationStatus === 'REVIEW';

  if (moderationStatus === 'SAFE') {
    // QUALITY.md Scenario 4: Use anonDisplayName for anonymous posts
    const notifyName = postIsAnonymous
      ? (anonDisplayName ?? 'Anonymous')
      : post.user.displayName;

    notifyMentionsInPost({
      postId: post.id,
      authorId: post.userId,
      authorName: notifyName,
      content: post.content,
    }).catch((err) => {
      console.error('Failed to send post mention notifications:', err);
    });
  }

  res.status(201).json({
    post: {
      id: post.id,
      content: post.content,
      imageUrl: post.imageUrl,
      userId: post.userId,
      user: post.isAnonymous
        ? { displayName: post.anonDisplayName ?? 'Anonymous' }
        : post.user,
      createdAt: post.createdAt.toISOString(),
      moderationStatus: post.moderationStatus,
      tags: post.tags,
      pinned: post.pinned,
      isAnonymous: post.isAnonymous,
      anonDisplayName: post.anonDisplayName,
    },
    flagged,
    underReview,
  });
}

// ── GET /api/posts ────────────────────────────
/**
 * Returns all SAFE posts, pinned posts first, then most recent comment activity.
 * Includes author displayName.
 */
export async function getPosts(req: Request, res: Response): Promise<void> {
  const searchQuery = typeof req.query.q === 'string' ? req.query.q.trim() : '';

  // QUALITY.md Scenario 10: Enforce pagination limit
  const limitRaw = parseInt(req.query.limit as string, 10);
  const take = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 50;

  const posts = await prisma.post.findMany({
    where: {
      moderationStatus: { in: ['SAFE', 'REVIEW'] },
      ...(searchQuery
        ? {
            OR: [
              { content: { contains: searchQuery, mode: 'insensitive' } },
              { tags: { hasSome: [searchQuery.toLowerCase()] } },
              { user: { displayName: { contains: searchQuery, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    include: {
      user: { select: { displayName: true, role: true, avatarUrl: true } },
      _count: { select: { reactions: true, comments: true } },
      comments: {
        where: {
          moderationStatus: { in: ['SAFE', 'REVIEW'] },
        },
        select: {
          id: true,
          userId: true,
          content: true,
          createdAt: true,
          user: { select: { displayName: true, role: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    take,
  });

  const sorted = posts.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;

    const aLatestCommentAt = a.comments[0]?.createdAt ?? a.createdAt;
    const bLatestCommentAt = b.comments[0]?.createdAt ?? b.createdAt;

    return bLatestCommentAt.getTime() - aLatestCommentAt.getTime();
  });

  res.json({
    posts: sorted.map((p) => {
      const latestComment = p.comments[0];

      return {
      id: p.id,
      content: p.content,
      imageUrl: p.imageUrl,
      userId: p.userId,
      user: p.isAnonymous
        ? { displayName: p.anonDisplayName ?? 'Anonymous', role: p.user.role }
        : p.user,
      createdAt: p.createdAt.toISOString(),
      moderationStatus: p.moderationStatus,
      tags: p.tags,
      pinned: p.pinned,
      isAnonymous: p.isAnonymous,
      anonDisplayName: p.anonDisplayName,
      commentCount: p._count.comments,
      reactionCount: p._count.reactions,
      latestComment: latestComment
        ? {
            id: latestComment.id,
            userId: latestComment.userId,
            content: latestComment.content,
            createdAt: latestComment.createdAt.toISOString(),
            user: latestComment.user,
          }
        : undefined,
      };
    }),
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
      user: { select: { displayName: true, role: true, avatarUrl: true } },
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
      imageUrl: post.imageUrl,
      userId: post.userId,
      user: post.isAnonymous
        ? { displayName: post.anonDisplayName ?? 'Anonymous', role: post.user.role }
        : post.user,
      createdAt: post.createdAt.toISOString(),
      moderationStatus: post.moderationStatus,
      tags: post.tags,
      pinned: post.pinned,
      isAnonymous: post.isAnonymous,
      anonDisplayName: post.anonDisplayName,
      commentCount: post._count.comments,
      reactionCount: post._count.reactions,
    },
  });
}

// ── DELETE /api/posts/:postId ─────────────────
/**
 * Deletes a post. Requires userId in body.
 * Users can delete their own posts, admins can delete any post.
 */
export async function deletePost(req: Request, res: Response): Promise<void> {
  const { postId } = req.params;
  const { userId } = req.body as { userId: string };

  if (!userId) {
    res.status(400).json({ error: 'userId is required.' });
    return;
  }

  // ── Find the post ────────────────────────
  const post = await prisma.post.findUnique({
    where: { id: postId },
  });

  if (!post) {
    res.status(404).json({ error: 'Post not found.' });
    return;
  }

  // ── Get user role ────────────────────────
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  // ── Permission check ─────────────────────
  // Users can delete their own posts, admins can delete any post
  const isOwner = post.userId === userId;
  const isAdmin = user.role === 'ADMIN';

  if (!isOwner && !isAdmin) {
    res.status(403).json({ error: 'You do not have permission to delete this post.' });
    return;
  }

  // ── Delete the post ──────────────────────
  // Cascade delete will handle reactions and comments
  await prisma.post.delete({
    where: { id: postId },
  });

  res.json({ success: true, message: 'Post deleted successfully.' });
}

export async function updatePost(req: Request, res: Response): Promise<void> {
  const { postId } = req.params;
  const { userId, content, tags } = req.body as {
    userId: string;
    content: string;
    tags?: string[];
  };

  if (!userId || !content?.trim()) {
    res.status(400).json({ error: 'userId and content are required.' });
    return;
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { user: { select: { displayName: true } } },
  });

  if (!post) {
    res.status(404).json({ error: 'Post not found.' });
    return;
  }

  if (post.userId !== userId) {
    res.status(403).json({ error: 'You can only edit your own post.' });
    return;
  }

  let moderationStatus: 'SAFE' | 'FLAGGED' | 'REVIEW';
  try {
    moderationStatus = await moderateContent(content.trim());
  } catch {
    moderationStatus = 'REVIEW';
  }

  if (moderationStatus === 'FLAGGED') {
    res.status(400).json({
      error: 'Your updated post was flagged by our safety system. Please revise it.',
      flagged: true,
    });
    return;
  }

  const updated = await prisma.post.update({
    where: { id: postId },
    data: {
      content: content.trim(),
      tags: tags ?? post.tags,
      moderationStatus,
    },
    include: { user: { select: { displayName: true, role: true, avatarUrl: true } } },
  });

  if (moderationStatus === 'SAFE') {
    notifyMentionsInPost({
      postId: updated.id,
      authorId: updated.userId,
      authorName: updated.user.displayName,
      content: updated.content,
    }).catch((err) => {
      console.error('Failed to send post mention notifications:', err);
    });
  }

  res.json({
    post: {
      id: updated.id,
      content: updated.content,
      imageUrl: updated.imageUrl,
      userId: updated.userId,
      user: updated.user,
      createdAt: updated.createdAt.toISOString(),
      moderationStatus: updated.moderationStatus,
      tags: updated.tags,
      pinned: updated.pinned,
    },
    flagged: false,
    underReview: moderationStatus === 'REVIEW',
  });
}
