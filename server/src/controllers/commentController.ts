// ─────────────────────────────────────────────
// src/controllers/commentController.ts
// POST /api/posts/:postId/comments — add comment
// GET  /api/posts/:postId/comments — list comments
// ─────────────────────────────────────────────

import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { moderateContent } from '../services/moderationService';

// ── POST /api/posts/:postId/comments ─────────
export async function createComment(req: Request, res: Response): Promise<void> {
  const { postId } = req.params;
  const { userId, content } = req.body as { userId: string; content: string };

  if (!userId || !content?.trim()) {
    res.status(400).json({ error: 'userId and content are required.' });
    return;
  }

  if (content.trim().length > 500) {
    res.status(400).json({ error: 'Comment must be 500 characters or fewer.' });
    return;
  }

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) { res.status(404).json({ error: 'Post not found.' }); return; }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) { res.status(404).json({ error: 'User not found.' }); return; }

  // ── AI Moderation ────────────────────────
  let moderationStatus: 'SAFE' | 'FLAGGED' | 'REVIEW';
  try {
    moderationStatus = await moderateContent(content.trim());
  } catch {
    moderationStatus = 'REVIEW';
  }

  const comment = await prisma.comment.create({
    data: { postId, userId, content: content.trim(), moderationStatus },
    include: { user: { select: { displayName: true } } },
  });

  const flagged = moderationStatus === 'FLAGGED';
  const underReview = moderationStatus === 'REVIEW';

  res.status(201).json({
    comment: {
      id: comment.id,
      postId: comment.postId,
      userId: comment.userId,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
      moderationStatus: comment.moderationStatus,
      user: comment.user,
    },
    flagged,
    underReview,
  });
}

// ── GET /api/posts/:postId/comments ──────────
export async function getComments(req: Request, res: Response): Promise<void> {
  const { postId } = req.params;

  const comments = await prisma.comment.findMany({
    where: { postId, moderationStatus: { not: 'FLAGGED' } },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { displayName: true, role: true } } },
  });

  res.json({
    comments: comments.map((c) => ({
      id: c.id,
      postId: c.postId,
      userId: c.userId,
      content: c.content,
      createdAt: c.createdAt.toISOString(),
      moderationStatus: c.moderationStatus,
      user: c.user,
    })),
  });
}
